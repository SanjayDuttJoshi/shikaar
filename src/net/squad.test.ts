import { describe, expect, it } from "vitest";
import { Difficulty, GameEventKind, InteractKind, PlayerStatus, RoundPhase } from "@/types/game";
import type { GameEvent, PlayerInput } from "@/types/game";
import { RoomStatus } from "@/types/net";
import type { RoundStart } from "@/types/net";
import { BuildingChoice } from "@/types/ui";
import { ItemKind } from "@/types/world";
import type { Session } from "@/client/session";
import { createGameContext, createWorldState } from "@/game/context";
import { MemoryHub } from "@/net/memory-hub";
import { createRoom } from "@/net/room";
import type { Room } from "@/net/room";
import { createHostSession } from "@/net/host-session";
import { createClientSession } from "@/net/client-session";
import { MAX_SQUAD } from "@/net/messages";
import { generateLevel } from "@/world/generate-level";
import { mixSeed } from "@/world/rng";

const SETTINGS = { difficulty: Difficulty.Normal, building: BuildingChoice.Asylum };
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

const openRooms = async (names: string[], lostGraceMs = 30): Promise<{ hub: MemoryHub; rooms: Room[]; ids: string[] }> => {
  const hub = new MemoryHub(2);
  const transports = names.map(() => hub.connect());
  const rooms = names.map((name, i) => createRoom(transports[i], { code: "BHOOT", name, host: i === 0, settings: SETTINGS, findTimeoutMs: 2000, lostGraceMs }));
  await sleep(40);
  return { hub, rooms, ids: transports.map((t) => t.selfId) };
};

const idle = (yaw = 0): PlayerInput => ({ moveX: 0, moveZ: 0, yaw, pitch: 0, sprint: false, crouch: false });

/** Builds every peer's copy of the round and its session, the way the game screen does. */
const playRound = (rooms: Room[], start: RoundStart): Session[] =>
  rooms.map((room, i) => {
    const level = generateLevel({ seed: start.seed, theme: start.theme, players: start.players.length });
    const ctx = createGameContext(level, mixSeed(start.seed, 77));
    const state = createWorldState(level, start.players, start.difficulty);
    const link = room.roundLink();
    if (!link) throw new Error("no round link");
    const selfId = room.view().selfId;
    return i === 0 ? createHostSession({ ctx, state, selfId, link, background: false }) : createClientSession({ ctx, state, selfId, link });
  });

/** Runs every session for `frames` frames of 1/30 s, letting messages cross between frames. */
const run = async (sessions: Session[], frames: number, inputs: Array<PlayerInput | null> = [], log: GameEvent[][] = []): Promise<void> => {
  for (let f = 0; f < frames; f += 1) {
    sessions.forEach((s, i) => {
      const events: GameEvent[] = [];
      const me = s.state.players.find((p) => p.id === s.selfId);
      s.step(inputs[i] ?? idle(me?.yaw), 1 / 30, events);
      (log[i] ??= []).push(...events);
    });
    await sleep(3);
  }
};

describe("squad lobby", () => {
  it("lets friends join by code with unique names and colours", async () => {
    const { rooms, ids } = await openRooms(["Raju", "Raju", "Priya"]);
    const lobby = rooms[1].view().lobby;
    expect(rooms[1].view().status).toBe(RoomStatus.Lobby);
    expect(lobby?.hostId).toBe(ids[0]);
    expect(lobby?.members.map((m) => m.name)).toEqual(["Raju", "Raju 2", "Priya"]);
    expect(new Set(lobby?.members.map((m) => m.color)).size).toBe(3);
  });

  it("turns away the seventh player", async () => {
    const { rooms } = await openRooms(Array.from({ length: MAX_SQUAD + 1 }, (_, i) => `P${i}`));
    expect(rooms[0].view().lobby?.members.length).toBe(MAX_SQUAD);
    expect(rooms[MAX_SQUAD].view().status).toBe(RoomStatus.Error);
  });

  it("gives everyone the same round and the same building", async () => {
    const { rooms } = await openRooms(["Raju", "Priya", "Sonu"]);
    rooms[0].startRound(1234);
    await sleep(30);
    const starts = rooms.map((r) => r.view().round);
    expect(starts.every((s) => s?.seed === 1234 && s.players.length === 3)).toBe(true);
    const prints = starts.map((s) => {
      const level = generateLevel({ seed: s?.seed ?? 0, theme: s?.theme ?? starts[0]?.theme ?? ("asylum" as never), players: 3 });
      return level.items.length + level.doors.length * 1000;
    });
    expect(new Set(prints).size).toBe(1);
  });
});

describe("squad round", () => {
  it("waits for loaders, mirrors the world and carries pickups from client to host", async () => {
    const { rooms } = await openRooms(["Raju", "Priya"]);
    rooms[0].startRound(77);
    await sleep(30);
    const start = rooms[0].view().round as RoundStart;
    const [host, client] = playRound(rooms, start);
    await run([host, client], 10);
    expect(host.waitingFor()).toEqual(["Priya"]);
    expect(client.waitingFor()).toEqual(["Priya"]);
    rooms[1].markReady();
    await run([host, client], 10);
    expect(host.waitingFor()).toEqual([]);

    // Walk the client's body next to a key: the host must see it there.
    const keyId = client.state.items.findIndex((_, id) => client.ctx.level.items[id].kind === ItemKind.Key);
    const key = client.ctx.level.items[keyId];
    const me = client.state.players[1];
    me.x = key.x + 0.4;
    me.z = key.z;
    await run([host, client], 12);
    const hostCopy = host.state.players[1];
    expect(Math.hypot(hostCopy.x - me.x, hostCopy.z - me.z)).toBeLessThan(0.3);

    // Wait for the intro to finish, then pick the key up.
    await run([host, client], 200);
    expect(client.state.phase).toBe(RoundPhase.Playing);
    const log: GameEvent[][] = [];
    me.x = key.x + 0.4;
    me.z = key.z;
    client.interact({ kind: InteractKind.PickUp, id: keyId, label: "", holdSeconds: 0 }, []);
    await run([host, client], 12, [], log);
    expect(host.state.items[keyId].taken).toBe(true);
    expect(client.state.items[keyId].taken).toBe(true);
    expect(client.state.keys).toContain(key.color);
    expect(log[1].some((e) => e.kind === GameEventKind.KeyFound && e.player === me.id)).toBe(true);
  });

  it("shows monsters moving on the client where the host has them", async () => {
    const { rooms } = await openRooms(["Raju", "Priya"]);
    rooms[0].startRound(91);
    await sleep(30);
    const [host, client] = playRound(rooms, rooms[0].view().round as RoundStart);
    rooms[1].markReady();
    await run([host, client], 330);
    host.state.monsters.forEach((m, i) => {
      const seen = client.state.monsters[i];
      expect(Math.hypot(seen.x - m.x, seen.z - m.z)).toBeLessThan(1.5);
      expect(seen.mode).toBe(m.mode);
    });
  });

  it("keeps a player whose connection blips and comes back quickly", async () => {
    const { hub, rooms, ids } = await openRooms(["Raju", "Priya"], 400);
    rooms[0].startRound(5);
    await sleep(30);
    const [host, a] = playRound(rooms, rooms[0].view().round as RoundStart);
    rooms[1].markReady();
    await run([host, a], 5);
    hub.blip(ids[1], 150);
    await sleep(250);
    await run([host, a], 10);
    expect(host.state.players[1].status).toBe(PlayerStatus.Alive);
    expect(rooms[1].view().round).not.toBeNull();
  });

  it("marks a player who drops out as gone, and ends the round for clients when the host leaves", async () => {
    const { hub, rooms, ids } = await openRooms(["Raju", "Priya", "Sonu"]);
    rooms[0].startRound(5);
    await sleep(30);
    const [host, a, b] = playRound(rooms, rooms[0].view().round as RoundStart);
    rooms[1].markReady();
    rooms[2].markReady();
    const log: GameEvent[][] = [];
    await run([host, a, b], 5);
    hub.drop(ids[2]);
    await sleep(60);
    await run([host, a], 5, [], log);
    expect(host.state.players[2].status).toBe(PlayerStatus.Dead);
    expect(log[1].some((e) => e.kind === GameEventKind.PlayerLeft && e.player === ids[2])).toBe(true);

    hub.drop(ids[0]);
    await sleep(60);
    const view = rooms[1].view();
    expect(view.round).toBeNull();
    expect(view.isHost).toBe(true);
    expect(view.notice).toMatch(/Host/);
  });
});
