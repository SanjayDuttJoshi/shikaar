import { describe, expect, it } from "vitest";
import { Difficulty, GameEventKind, InteractKind, MonsterMode, PlayerStatus, RoundOutcome, RoundPhase } from "@/types/game";
import type { GameEvent, PlayerInput, WorldState } from "@/types/game";
import { ItemKind, Theme } from "@/types/world";
import type { Level } from "@/types/world";
import { MERCY_SECONDS, TICK_DT } from "@/game/constants";
import { createGameContext, createWorldState } from "@/game/context";
import type { GameContext } from "@/game/context";
import { applyFlash, applyInteract, findInteractTarget } from "@/game/interact";
import { monsterSees } from "@/game/monster-ai";
import { findPath, nearestOpen } from "@/game/nav";
import { stepPlayerMotion } from "@/game/player-motion";
import { hostStep } from "@/game/round";
import { generateLevel } from "@/world/generate-level";
import { roomInterior } from "@/world/geometry";

const setup = (seed = 11, players = 1, theme = Theme.Asylum): { level: Level; ctx: GameContext; state: WorldState } => {
  const level = generateLevel({ seed, theme, players });
  const ctx = createGameContext(level, seed + 1);
  const state = createWorldState(
    level,
    Array.from({ length: players }, (_, i) => ({ id: `p${i}`, name: `P${i}`, color: i })),
    Difficulty.Normal,
  );
  state.phase = RoundPhase.Playing;
  return { level, ctx, state };
};

const IDLE: PlayerInput = { moveX: 0, moveZ: 0, yaw: 0, pitch: 0, sprint: false, crouch: false };

/** Puts the monster 4 m in front of the player in open floor, facing them. */
const faceOff = (ctx: GameContext, state: WorldState): void => {
  const p = state.players[0];
  const m = state.monsters[0];
  const room = ctx.level.rooms.find((r) => r.rect.w >= 3 && r.rect.h >= 2 && r.kind !== "corridor") ?? ctx.level.rooms[0];
  const box = roomInterior(room.rect, 0.6);
  const open = (x: number, z: number) => {
    const i = nearestOpen(ctx.nav, { x, z });
    return { x: ((i % ctx.nav.w) + 0.5) * 0.5, z: (Math.floor(i / ctx.nav.w) + 0.5) * 0.5 };
  };
  const a = open(box.minX + 0.8, (box.minZ + box.maxZ) / 2);
  p.x = a.x;
  p.z = a.z;
  m.x = Math.min(box.maxX, a.x + 4);
  m.z = a.z;
  m.yaw = -Math.PI / 2;
  p.torchOn = true;
};

describe("monster", () => {
  it("can walk from its spawn to every room in many buildings", () => {
    for (const theme of [Theme.Asylum, Theme.Haveli]) {
      for (const seed of [3, 17, 29, 41, 53]) {
        const { level, ctx } = setup(seed, 6, theme);
        const from = level.monsterSpawns[0];
        for (const room of level.rooms) {
          const box = roomInterior(room.rect, 0.6);
          const to = { x: (box.minX + box.maxX) / 2, z: (box.minZ + box.maxZ) / 2 };
          const path = findPath(ctx.nav, from, to);
          expect(path.length, `${theme} seed ${seed} room ${room.id} (${room.kind})`).toBeGreaterThan(0);
        }
      }
    }
  });

  it("sees a torch-lit player in front but not through a wall", () => {
    const { ctx, state } = setup();
    faceOff(ctx, state);
    expect(monsterSees(ctx, state, state.monsters[0], state.players[0])).toBe(true);
    state.monsters[0].yaw = Math.PI / 2;
    expect(monsterSees(ctx, state, state.monsters[0], state.players[0])).toBe(false);
    state.monsters[0].x = state.players[0].x;
    state.monsters[0].z = state.players[0].z + 40;
    expect(monsterSees(ctx, state, state.monsters[0], state.players[0])).toBe(false);
  });

  it("chases, hits twice, and a solo player dies", () => {
    const { ctx, state } = setup();
    faceOff(ctx, state);
    const events: GameEvent[] = [];
    for (let t = 0; t < 20 * 30 && state.players[0].status === PlayerStatus.Alive; t += 1) {
      stepPlayerMotion(ctx, state, state.players[0], { ...IDLE, yaw: state.players[0].yaw }, TICK_DT);
      hostStep(ctx, state, TICK_DT, events);
    }
    const kinds = events.map((e) => e.kind);
    expect(kinds).toContain(GameEventKind.MonsterSpotted);
    expect(kinds.filter((k) => k === GameEventKind.PlayerHit).length).toBe(2);
    expect(state.players[0].status).toBe(PlayerStatus.Dead);
    for (let t = 0; t < 5 * 30; t += 1) hostStep(ctx, state, TICK_DT, events);
    expect(state.outcome).toBe(RoundOutcome.AllCaught);
    expect(state.phase).toBe(RoundPhase.Ended);
  });

  it("gives a mercy window after each hit", () => {
    const { ctx, state } = setup();
    faceOff(ctx, state);
    const events: GameEvent[] = [];
    let firstHit = -1;
    let secondHit = -1;
    for (let t = 0; t < 20 * 30 && secondHit < 0; t += 1) {
      hostStep(ctx, state, TICK_DT, events);
      state.players[0].sinceHit += TICK_DT;
      const hits = events.filter((e) => e.kind === GameEventKind.PlayerHit).length;
      if (hits === 1 && firstHit < 0) firstHit = state.time;
      if (hits === 2) secondHit = state.time;
    }
    expect(secondHit - firstHit).toBeGreaterThanOrEqual(MERCY_SECONDS - 0.05);
  });

  it("is frozen by a flash and immune for a while after", () => {
    const { ctx, state } = setup();
    faceOff(ctx, state);
    const p = state.players[0];
    p.yaw = -Math.PI / 2;
    const events: GameEvent[] = [];
    applyFlash(ctx, state, p.id, events);
    expect(state.monsters[0].mode).toBe(MonsterMode.Stunned);
    expect(events.map((e) => e.kind)).toContain(GameEventKind.MonsterStunned);
    state.monsters[0].mode = MonsterMode.Chase;
    p.flashCooldown = 0;
    applyFlash(ctx, state, p.id, events);
    expect(state.monsters[0].mode).toBe(MonsterMode.Chase);
  });

  it("pulls out a player it watched hide, but walks past an unseen hider", () => {
    const { ctx, state, level } = setup(5);
    const p = state.players[0];
    const spot = level.hideSpots.find((h) => h.kind !== "under-bed") ?? level.hideSpots[0];
    const prop = level.props[spot.propId];
    const front = { x: prop.x + Math.sin(prop.yaw) * 1.3, z: prop.z + Math.cos(prop.yaw) * 1.3 };
    p.x = front.x;
    p.z = front.z;
    const m = state.monsters[0];
    m.x = prop.x + Math.sin(prop.yaw) * 6;
    m.z = prop.z + Math.cos(prop.yaw) * 6;
    m.mode = MonsterMode.Chase;
    m.target = p.id;
    m.timer = 0;
    m.lastSeen = { x: p.x, z: p.z };
    const events: GameEvent[] = [];
    applyInteract(ctx, state, p.id, { kind: InteractKind.Hide, id: spot.id, label: "", holdSeconds: 0 }, events);
    expect(p.status).toBe(PlayerStatus.Hiding);
    const watched = m.sawHide === spot.id;
    for (let t = 0; t < 15 * 30; t += 1) hostStep(ctx, state, TICK_DT, events);
    if (watched) expect(events.map((e) => e.kind)).toContain(GameEventKind.PlayerPulledOut);

    const fresh = setup(5);
    const q = fresh.state.players[0];
    q.x = front.x;
    q.z = front.z;
    const mm = fresh.state.monsters[0];
    mm.mode = MonsterMode.Patrol;
    const ev2: GameEvent[] = [];
    applyInteract(fresh.ctx, fresh.state, q.id, { kind: InteractKind.Hide, id: spot.id, label: "", holdSeconds: 0 }, ev2);
    expect(mm.sawHide).toBe(-1);
    for (let t = 0; t < 10 * 30; t += 1) hostStep(fresh.ctx, fresh.state, TICK_DT, ev2);
    expect(ev2.map((e) => e.kind)).not.toContain(GameEventKind.PlayerPulledOut);
  });
});

describe("monster never gets stuck", () => {
  it("gives up investigating a sound that came from inside a locker", () => {
    const { ctx, state, level } = setup(12);
    const m = state.monsters[0];
    const spot = level.hideSpots.find((h) => h.kind === "locker") ?? level.hideSpots[0];
    const prop = level.props[spot.propId];
    m.x = prop.x + Math.sin(prop.yaw) * 3;
    m.z = prop.z + Math.cos(prop.yaw) * 3;
    m.mode = MonsterMode.Investigate;
    m.timer = 0;
    m.goal = { x: prop.x, z: prop.z };
    m.path = findPath(ctx.nav, m, m.goal);
    state.players[0].x = -100;
    state.players[0].z = -100;
    const events: GameEvent[] = [];
    for (let t = 0; t < 20 * 30; t += 1) hostStep(ctx, state, TICK_DT, events);
    expect(m.mode).not.toBe(MonsterMode.Investigate);
  });

  it("keeps moving over a long patrol in every building", () => {
    for (const theme of [Theme.Asylum, Theme.Haveli]) {
      const { ctx, state } = setup(31, 4, theme);
      for (const p of state.players) {
        p.x = -100;
        p.z = -100;
      }
      const events: GameEvent[] = [];
      const visited = state.monsters.map(() => new Set<string>());
      for (let t = 0; t < 240 * 30; t += 1) {
        hostStep(ctx, state, TICK_DT, events);
        state.monsters.forEach((m, i) => visited[i].add(`${Math.floor(m.x / 3)},${Math.floor(m.z / 3)}`));
      }
      for (const cells of visited) expect(cells.size, `${theme}: cells visited`).toBeGreaterThan(25);
    }
  });
});

describe("objectives", () => {
  it("keys open their doors, fuses power the gate, and walking out ends the round", () => {
    const { ctx, state, level } = setup(21, 1);
    state.monsters.length = 0;
    const p = state.players[0];
    const events: GameEvent[] = [];
    for (const [id, item] of level.items.entries()) {
      if (item.kind !== ItemKind.Key) continue;
      p.x = item.x;
      p.z = item.z;
      applyInteract(ctx, state, p.id, { kind: InteractKind.PickUp, id, label: "", holdSeconds: 0 }, events);
    }
    expect(state.keys.length).toBe(level.wings.filter((w) => w.lock !== null).length);
    const locked = level.doors.findIndex((d) => d.lock !== null);
    applyInteract(ctx, state, p.id, { kind: InteractKind.LockedDoor, id: locked, label: "", holdSeconds: 0 }, events);
    expect(state.doors[locked].locked).toBe(false);

    const box = level.props[level.fuseBoxPropId];
    for (const [id, item] of level.items.entries()) {
      if (item.kind !== ItemKind.Fuse) continue;
      p.x = item.x;
      p.z = item.z;
      applyInteract(ctx, state, p.id, { kind: InteractKind.PickUp, id, label: "", holdSeconds: 0 }, events);
      expect(p.carrying).toBe(id);
      p.x = box.x;
      p.z = box.z;
      applyInteract(ctx, state, p.id, { kind: InteractKind.FuseBox, id: box.id, label: "", holdSeconds: 0 }, events);
    }
    expect(state.powerOn).toBe(true);
    expect(state.phase).toBe(RoundPhase.GateOpening);
    for (let t = 0; t < 16 * 30; t += 1) hostStep(ctx, state, TICK_DT, events);
    expect(state.gateOpen).toBe(true);

    const gate = level.doors[level.exitDoorId];
    const insideA = level.roomOf[gate.cy * level.width + gate.cx] >= 0;
    const out = gate.vertical
      ? { x: (gate.cx + (insideA ? 1.5 : 0.5)) * 3, z: (gate.cy + 0.5) * 3 }
      : { x: (gate.cx + 0.5) * 3, z: (gate.cy + (insideA ? 1.5 : 0.5)) * 3 };
    const inside = gate.vertical
      ? { x: (gate.cx + (insideA ? 0.5 : 1.5)) * 3, z: (gate.cy + 0.5) * 3 }
      : { x: (gate.cx + 0.5) * 3, z: (gate.cy + (insideA ? 0.5 : 1.5)) * 3 };
    p.x = inside.x;
    p.z = inside.z;
    const yaw = Math.atan2(-(out.x - inside.x), -(out.z - inside.z));
    for (let t = 0; t < 4 * 30 && p.status === PlayerStatus.Alive; t += 1) {
      stepPlayerMotion(ctx, state, p, { ...IDLE, yaw, moveZ: 1 }, TICK_DT);
      hostStep(ctx, state, TICK_DT, events);
    }
    expect(p.status).toBe(PlayerStatus.Escaped);
    for (let t = 0; t < 4 * 30; t += 1) hostStep(ctx, state, TICK_DT, events);
    expect(state.outcome).toBe(RoundOutcome.AllEscaped);
  });

  it("doesn't let a full battery hide the door prompt", () => {
    const { ctx, state, level } = setup(21, 1);
    const p = state.players[0];
    const battery = level.items.findIndex((i) => i.kind === ItemKind.Battery);
    p.x = level.items[battery].x + 0.8;
    p.z = level.items[battery].z;
    p.yaw = Math.PI / 2;
    p.battery = 100;
    expect(findInteractTarget(ctx, state, p).kind).not.toBe(InteractKind.PickUp);
    p.battery = 30;
    expect(findInteractTarget(ctx, state, p).kind).toBe(InteractKind.PickUp);
  });

  it("offers the right prompt for what you face", () => {
    const { ctx, state, level } = setup(21, 1);
    const p = state.players[0];
    const key = level.items.findIndex((i) => i.kind === ItemKind.Key);
    p.x = level.items[key].x + 0.8;
    p.z = level.items[key].z;
    p.yaw = Math.PI / 2;
    const target = findInteractTarget(ctx, state, p);
    expect(target.kind).toBe(InteractKind.PickUp);
    expect(target.label).toContain("chaabi");
  });
});
