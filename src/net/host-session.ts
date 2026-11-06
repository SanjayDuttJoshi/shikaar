import { PlayerStatus, RoundPhase, Stance } from "@/types/game";
import { GameEventKind } from "@/types/game";
import type { GameEvent, PlayerInput, PlayerState } from "@/types/game";
import { ActionKind, Channel } from "@/types/net";
import { MAX_STEP } from "@/client/session";
import type { Session } from "@/client/session";
import { TICK_DT } from "@/game/constants";
import type { GameContext } from "@/game/context";
import type { WorldState } from "@/types/game";
import { applyFlash, applyInteract, applyRevive, toggleTorch } from "@/game/interact";
import { stepPlayerMotion, stepVitals } from "@/game/player-motion";
import { hostStep } from "@/game/round";
import { createTicker } from "@/lib/ticker";
import { parseAct, parsePose } from "@/net/messages";
import type { ActMessage } from "@/net/messages";
import type { RoundLink } from "@/net/round-link";
import { advance, createTrack, retarget, snapTrack } from "@/net/smoother";
import { createSnapshotEncoder } from "@/net/snapshot";
import { stanceOf } from "@/net/snapshot";
import { CELL } from "@/world/constants";

/** Snapshots per second to the squad. */
const SNAP_INTERVAL = 1 / 15;
/** Every door and item is resent this often, in case a change was missed. */
const FULL_INTERVAL = 2;
/** The intro waits this long at most for slow loaders. */
const MAX_WAIT = 45;
/** A revive hold counts only while that player's poses keep coming. */
const REVIVE_FRESH = 0.4;
/** Hidden tab: the world keeps running from a worker beat instead of animation frames. */
const BACKGROUND_BEAT_MS = 50;
const BACKGROUND_AFTER = 0.25;
const BACKLOG_MAX = 120;

const moves = (s: PlayerStatus): boolean => s === PlayerStatus.Alive || s === PlayerStatus.Downed;
const inGame = (s: PlayerStatus): boolean => s === PlayerStatus.Alive || s === PlayerStatus.Hiding || s === PlayerStatus.Downed;

export interface HostSessionOptions {
  ctx: GameContext;
  state: WorldState;
  selfId: string;
  link: RoundLink;
  /** Keep the world running from a worker when the tab is hidden (off in unit tests). */
  background?: boolean;
}

/** The squad host: runs the monsters, doors and round for everyone and moves its own player. */
export const createHostSession = ({ ctx, state, selfId, link, background = true }: HostSessionOptions): Session => {
  const indexOf = (id: string): number => state.players.findIndex((p) => p.id === id);
  const selfIndex = indexOf(selfId);
  const epochs = state.players.map(() => 0);
  const lastStatus = state.players.map((p) => p.status);
  const tracks = state.players.map((p) => createTrack(p.x, p.z, p.yaw));
  const poseAt = state.players.map(() => -1);
  const reviveOf = state.players.map(() => -1);
  const waiting = new Set(state.players.filter((p) => p.id !== selfId).map((p) => p.id));
  const actions: Array<{ index: number; act: ActMessage }> = [];
  const pending: GameEvent[] = [];
  const outbox: GameEvent[] = [];
  /** Events from while the tab was hidden, for this tab's own HUD and sounds when it comes back. */
  const backlog: GameEvent[] = [];
  const encoder = createSnapshotEncoder(state);
  const limitX = ctx.level.width * CELL;
  const limitZ = ctx.level.height * CELL;
  let clock = 0;
  let accumulator = 0;
  let snapTimer = 0;
  let fullTimer = 0;
  let waited = 0;
  let forceFull = true;
  /** Last frame from the game loop, and last time the world moved at all (loop or background beat). */
  let lastStepWall = performance.now();
  let lastSimWall = lastStepWall;

  const dropPlayer = (id: string, events: GameEvent[]): void => {
    waiting.delete(id);
    const p = state.players[indexOf(id)];
    if (!p || !inGame(p.status)) return;
    if (p.carrying >= 0) {
      const item = state.items[p.carrying];
      if (item) Object.assign(item, { taken: false, x: p.x, z: p.z, y: 0.03 });
      p.carrying = -1;
    }
    p.status = PlayerStatus.Dead;
    p.torchOn = false;
    events.push({ kind: GameEventKind.PlayerLeft, player: id, x: p.x, z: p.z });
  };

  link.on(Channel.Pose, (data, peer) => {
    const pose = parsePose(data);
    const idx = indexOf(peer);
    if (!pose || idx < 0 || idx === selfIndex) return;
    const p = state.players[idx];
    const [x, z, yaw, pitch, vx, vz, stance, stamina, exhausted, noise, epoch, revive] = pose;
    p.pitch = pitch;
    reviveOf[idx] = revive;
    const interval = poseAt[idx] < 0 ? 0.05 : clock - poseAt[idx];
    poseAt[idx] = clock;
    if (epoch !== epochs[idx] || !moves(p.status)) {
      if (p.status === PlayerStatus.Hiding) p.yaw = yaw;
      return;
    }
    if (x < 0 || z < 0 || x > limitX || z > limitZ) return;
    retarget(tracks[idx], x, z, yaw, interval);
    p.vx = vx;
    p.vz = vz;
    p.stance = stanceOf(stance);
    p.stamina = Math.max(0, Math.min(100, stamina));
    p.exhausted = exhausted === 1;
    p.noise = Math.max(0, Math.min(20, noise));
  });

  link.on(Channel.Act, (data, peer) => {
    const act = parseAct(data);
    const index = indexOf(peer);
    if (act && index >= 0 && index !== selfIndex) actions.push({ index, act });
  });

  link.onPeerLeave((peer) => dropPlayer(peer, pending));

  const applyAct = (p: PlayerState, act: ActMessage, events: GameEvent[]): void => {
    if (act.a === ActionKind.Interact && act.k && act.id !== undefined) applyInteract(ctx, state, p.id, { kind: act.k, id: act.id, label: "", holdSeconds: 0 }, events);
    else if (act.a === ActionKind.Flash) applyFlash(ctx, state, p.id, events);
    else if (act.a === ActionKind.Torch) toggleTorch(p);
    else if (act.a === ActionKind.Quit) dropPlayer(p.id, events);
  };

  const noticeChanges = (): void => {
    state.players.forEach((p, idx) => {
      if (p.status === lastStatus[idx]) return;
      lastStatus[idx] = p.status;
      epochs[idx] += 1;
      snapTrack(tracks[idx], p.x, p.z, p.yaw);
    });
  };

  const runWorld = (dt: number, events: GameEvent[]): void => {
    for (const id of link.readyPeers()) {
      if (waiting.delete(id)) forceFull = true;
    }
    const holding = state.phase === RoundPhase.Intro && waiting.size > 0 && waited < MAX_WAIT;
    if (holding) {
      waited += dt;
      return;
    }
    accumulator += dt;
    while (accumulator >= TICK_DT) {
      state.players.forEach((p, idx) => {
        const target = state.players[reviveOf[idx]];
        if (idx !== selfIndex && target && clock - poseAt[idx] < REVIVE_FRESH) applyRevive(state, p.id, target.id, TICK_DT, events);
      });
      hostStep(ctx, state, TICK_DT, events);
      accumulator -= TICK_DT;
    }
  };

  const simulate = (input: PlayerInput, dt: number, events: GameEvent[]): void => {
    clock += dt;
    lastSimWall = performance.now();
    events.push(...pending.splice(0));
    for (const { index, act } of actions.splice(0)) applyAct(state.players[index], act, events);
    const me = state.players[selfIndex];
    let left = dt;
    while (left > 1e-6 && me) {
      const slice = Math.min(MAX_STEP, left);
      stepPlayerMotion(ctx, state, me, input, slice);
      left -= slice;
    }
    state.players.forEach((p, idx) => {
      if (idx === selfIndex) return;
      stepVitals(p, dt);
      if (!moves(p.status)) return;
      const pose = advance(tracks[idx], dt);
      p.x = pose.x;
      p.z = pose.z;
      p.yaw = pose.yaw;
    });
    runWorld(dt, events);
    noticeChanges();
    outbox.push(...events);
    snapTimer += dt;
    fullTimer += dt;
    if (snapTimer < SNAP_INTERVAL) return;
    snapTimer = 0;
    const full = forceFull || fullTimer >= FULL_INTERVAL;
    if (full) fullTimer = 0;
    forceFull = false;
    const names = state.players.filter((p) => waiting.has(p.id)).map((p) => p.name);
    link.send(Channel.Snap, encoder.encode(outbox.splice(0), names, full, epochs));
  };

  const step = (input: PlayerInput, dt: number, events: GameEvent[]): void => {
    lastStepWall = performance.now();
    simulate(input, dt, events);
    events.push(...backlog.splice(0));
  };

  const idleInput = (): PlayerInput => {
    const me = state.players[selfIndex];
    return { moveX: 0, moveZ: 0, yaw: me?.yaw ?? 0, pitch: me?.pitch ?? 0, sprint: false, crouch: me?.stance === Stance.Crouch };
  };
  const ticker = background
    ? createTicker(() => {
        const now = performance.now();
        if ((now - lastStepWall) / 1000 <= BACKGROUND_AFTER) return;
        const events: GameEvent[] = [];
        simulate(idleInput(), Math.min((now - lastSimWall) / 1000, 0.25), events);
        backlog.push(...events.filter((e) => e.kind !== GameEventKind.MonsterStep));
        backlog.splice(0, Math.max(0, backlog.length - BACKLOG_MAX));
      })
    : null;
  ticker?.start(BACKGROUND_BEAT_MS);

  return {
    ctx,
    state,
    selfId,
    online: true,
    waitingFor: () => state.players.filter((p) => waiting.has(p.id)).map((p) => p.name),
    step,
    interact: (target, events) => applyInteract(ctx, state, selfId, target, events),
    revive: (targetId, dt, events) => applyRevive(state, selfId, targetId, dt, events),
    flash: (events) => applyFlash(ctx, state, selfId, events),
    toggleTorch: () => {
      const me = state.players[selfIndex];
      if (me) toggleTorch(me);
    },
    dispose: () => {
      ticker?.dispose();
      link.dispose();
    },
  };
};
