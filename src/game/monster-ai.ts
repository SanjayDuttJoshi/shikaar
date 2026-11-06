import { GameEventKind, MonsterMode, PlayerStatus, RoundPhase, Stance } from "@/types/game";
import type { GameEvent, MonsterState, PlayerState, WorldState } from "@/types/game";
import { MonsterKind, RoomKind } from "@/types/world";
import type { Vec2 } from "@/types/world";
import { moveCircle, sightBlocked } from "@/game/collision";
import {
  BLEED_SECONDS,
  DOOR_BASH_SECONDS,
  GRACE_SECONDS,
  INTRO_SECONDS,
  MERCY_SECONDS,
  MONSTER_RADIUS,
  MONSTER_TUNING,
  TAUNT_MAX_GAP,
  TAUNT_MIN_GAP,
} from "@/game/constants";
import type { MonsterTuning } from "@/game/constants";
import { doorOpenness } from "@/game/context";
import type { GameContext } from "@/game/context";
import { monsterPushDoors } from "@/game/doors";
import { hideExit, hideSpotFront } from "@/game/hiding";
import { findPath, randomOpenPoint, walkable } from "@/game/nav";
import { CELL } from "@/world/constants";
import { roomInterior } from "@/world/geometry";
import { roomIdAt } from "@/world/level-queries";
import { BLIND_TOUCH_RANGE, KIND_PROFILES, RAGE_SECONDS, STARE_CONE_COS, STARE_LIMIT, STARE_RANGE } from "@/game/monster-kinds";
import { forwardOf } from "@/game/player-motion";

const ARRIVE = 0.55;
const STEP_LENGTH = 0.95;
const TURN_RATE = 7;
const LAMP_RADIUS = 3.2;
const PULL_RANGE = 1.35;
const SNIFF_RANGE = 2.6;
const ENRAGED_HINT_SECONDS = 6;
const STUCK_GIVE_UP = 1.5;
const INVESTIGATE_MAX = 14;

export const monsterForward = (yaw: number): Vec2 => ({ x: Math.sin(yaw), z: Math.cos(yaw) });

const dist = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.z - b.z);

const isExposed = (ctx: GameContext, p: PlayerState): boolean => {
  if (p.torchOn) return true;
  const room = ctx.level.rooms[roomIdAt(ctx.level, Math.floor(p.x / CELL), Math.floor(p.z / CELL))];
  if (room?.kind === RoomKind.Courtyard) return true;
  return ctx.lamps.some((l) => Math.abs(l.x - p.x) < LAMP_RADIUS && Math.abs(l.z - p.z) < LAMP_RADIUS);
};

const sightRange = (ctx: GameContext, tune: MonsterTuning, m: MonsterState, p: PlayerState): number => {
  const profile = KIND_PROFILES[m.kind];
  if (isExposed(ctx, p)) return tune.sightLit * profile.sightLit;
  return (p.stance === Stance.Crouch ? tune.sightSneak : tune.sightDark) * profile.sightDark;
};

const wingAt = (ctx: GameContext, at: Vec2): number =>
  ctx.level.rooms[roomIdAt(ctx.level, Math.floor(at.x / CELL), Math.floor(at.z / CELL))]?.wing ?? -1;

/** Can this monster see the player right now (cone, range, light, walls, closed doors)? */
export const monsterSees = (ctx: GameContext, state: WorldState, m: MonsterState, p: PlayerState): boolean => {
  if (p.status !== PlayerStatus.Alive) return false;
  const tune = MONSTER_TUNING[state.difficulty];
  const d = dist(m, p);
  if (KIND_PROFILES[m.kind].blind) return d <= BLIND_TOUCH_RANGE;
  if (d > Math.max(sightRange(ctx, tune, m, p), tune.senseRange)) return false;
  if (d > tune.senseRange) {
    const f = monsterForward(m.yaw);
    const dot = (f.x * (p.x - m.x) + f.z * (p.z - m.z)) / Math.max(d, 1e-6);
    if (dot < tune.fovCos) return false;
  }
  return !sightBlocked(ctx.world, m, p, doorOpenness(state));
};

const planTo = (ctx: GameContext, m: MonsterState, goal: Vec2): void => {
  m.goal = goal;
  m.path = walkable(ctx.nav, m, goal) ? [goal] : findPath(ctx.nav, m, goal);
};

const turnToward = (m: MonsterState, dx: number, dz: number, dt: number): void => {
  const want = Math.atan2(dx, dz);
  let delta = want - m.yaw;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  m.yaw += Math.max(-TURN_RATE * dt, Math.min(TURN_RATE * dt, delta));
};

/** Walks the current path. Returns true once the end is reached. */
const followPath = (ctx: GameContext, state: WorldState, m: MonsterState, speed: number, dt: number, events: GameEvent[]): boolean => {
  if (m.doorPause > 0) {
    m.doorPause -= dt;
    m.speed = 0;
    return false;
  }
  while (m.path.length > 0 && dist(m, m.path[0]) < ARRIVE) m.path.shift();
  if (m.path.length === 0) {
    m.speed = 0;
    return true;
  }
  const wp = m.path[0];
  const dx = wp.x - m.x;
  const dz = wp.z - m.z;
  const d = Math.hypot(dx, dz);
  turnToward(m, dx, dz, dt);
  const step = Math.min(d, speed * dt);
  const next = moveCircle(ctx.world, m, (dx / d) * step, (dz / d) * step, MONSTER_RADIUS, doorOpenness(state));
  const moved = dist(next, m);
  m.x = next.x;
  m.z = next.z;
  m.speed = moved / Math.max(dt, 1e-6);
  m.stepPhase += moved;
  if (m.stepPhase >= STEP_LENGTH) {
    m.stepPhase -= STEP_LENGTH;
    events.push({ kind: GameEventKind.MonsterStep, monster: m.id, x: m.x, z: m.z });
  }
  if (monsterPushDoors(ctx, state, m, events)) m.doorPause = DOOR_BASH_SECONDS;
  if (moved < step * 0.25) {
    m.repathIn = 0;
    m.stuck += dt;
    if (m.stuck > STUCK_GIVE_UP) {
      m.stuck = 0;
      m.path = [];
      m.speed = 0;
      return true;
    }
  } else m.stuck = Math.max(0, m.stuck - dt);
  return false;
};

const randomPointNear = (ctx: GameContext, at: Vec2, radius: number): Vec2 =>
  randomOpenPoint(ctx.nav, at.x - radius, at.z - radius, at.x + radius, at.z + radius, ctx.rng.next) ?? at;

const pointInRoom = (ctx: GameContext, room: (typeof ctx.level.rooms)[number]): Vec2 => {
  const box = roomInterior(room.rect, 0.5);
  return randomOpenPoint(ctx.nav, box.minX, box.minZ, box.maxX, box.maxZ, ctx.rng.next) ?? { x: room.rect.x * CELL + 1.5, z: room.rect.y * CELL + 1.5 };
};

const patrolGoal = (ctx: GameContext, state: WorldState, m: MonsterState): Vec2 => {
  if (m.home >= 0) {
    const own = ctx.level.rooms.filter((r) => r.wing === m.home);
    if (own.length > 0) return pointInRoom(ctx, ctx.rng.pick(own));
  }
  const huntable = state.players.filter((p) => p.status === PlayerStatus.Alive || p.status === PlayerStatus.Hiding);
  if (state.time < INTRO_SECONDS + GRACE_SECONDS[state.difficulty]) {
    const far = ctx.level.rooms.filter((r) => {
      const c = { x: (r.rect.x + r.rect.w / 2) * CELL, z: (r.rect.y + r.rect.h / 2) * CELL };
      return huntable.every((p) => dist(p, c) > 24);
    });
    if (far.length > 0) {
      const room = ctx.rng.pick(far);
      const box = roomInterior(room.rect, 0.5);
      const p = randomOpenPoint(ctx.nav, box.minX, box.minZ, box.maxX, box.maxZ, ctx.rng.next);
      if (p) return p;
    }
  }
  const nearPlayers = huntable.length > 0 && ctx.rng.chance(0.45);
  const wing = nearPlayers
    ? ctx.level.rooms[roomIdAt(ctx.level, Math.floor(ctx.rng.pick(huntable).x / CELL), Math.floor(ctx.rng.pick(huntable).z / CELL))]?.wing
    : undefined;
  const rooms = ctx.level.rooms.filter((r) => wing === undefined || r.wing === wing);
  const room = ctx.rng.pick(rooms.length > 0 ? rooms : ctx.level.rooms);
  const box = roomInterior(room.rect, 0.5);
  return randomOpenPoint(ctx.nav, box.minX, box.minZ, box.maxX, box.maxZ, ctx.rng.next) ?? { x: room.rect.x * CELL + 1.5, z: room.rect.y * CELL + 1.5 };
};

const startChase = (m: MonsterState, target: PlayerState, events: GameEvent[]): void => {
  if (m.mode !== MonsterMode.Chase) {
    events.push({ kind: GameEventKind.MonsterSpotted, monster: m.id, player: target.id, x: m.x, z: m.z });
    events.push({ kind: GameEventKind.MonsterRoar, monster: m.id, x: m.x, z: m.z });
    m.tauntIn = 2.5;
  }
  m.mode = MonsterMode.Chase;
  m.target = target.id;
  m.timer = 0;
  m.lastSeen = { x: target.x, z: target.z };
  m.repathIn = 0;
  m.calm = 0;
};

const startSearch = (ctx: GameContext, m: MonsterState, at: Vec2, seconds: number): void => {
  m.mode = MonsterMode.Search;
  m.timer = seconds;
  m.lastSeen = at;
  m.path = [];
  m.goal = null;
  m.target = null;
  m.repathIn = 0;
  planTo(ctx, m, randomPointNear(ctx, at, 2));
};

const huntablesAlive = (state: WorldState): PlayerState[] =>
  state.players.filter((p) => p.status === PlayerStatus.Alive || p.status === PlayerStatus.Hiding);

/** The monster lands a hit. Second hit drops you; with nobody left to revive you, it's over. */
export const hitPlayer = (state: WorldState, target: PlayerState, events: GameEvent[]): void => {
  target.health -= 1;
  target.sinceHit = 0;
  events.push({ kind: GameEventKind.PlayerHit, player: target.id, x: target.x, z: target.z });
  if (target.health > 0) return;
  target.status = PlayerStatus.Downed;
  target.bleed = BLEED_SECONDS;
  target.revive = 0;
  target.torchOn = false;
  if (target.carrying >= 0) {
    const item = state.items[target.carrying];
    item.taken = false;
    item.x = target.x;
    item.z = target.z;
    item.y = 0.03;
    target.carrying = -1;
  }
  events.push({ kind: GameEventKind.PlayerDowned, player: target.id, x: target.x, z: target.z });
  const othersUp = huntablesAlive(state).filter((p) => p.id !== target.id);
  if (othersUp.length === 0) {
    target.status = PlayerStatus.Dead;
    events.push({ kind: GameEventKind.PlayerDied, player: target.id, x: target.x, z: target.z });
  }
};

/** Guardians only care about sounds in (or right next to) their own wing. */
const caresAbout = (ctx: GameContext, m: MonsterState, at: Vec2): boolean =>
  m.home < 0 || wingAt(ctx, at) === m.home || dist(m, at) < 8;

const heardNoise = (ctx: GameContext, state: WorldState, m: MonsterState, tune: MonsterTuning): Vec2 | null => {
  let best: Vec2 | null = null;
  let bestD = Number.POSITIVE_INFINITY;
  const scale = tune.hearingScale * KIND_PROFILES[m.kind].hearing;
  for (const p of state.players) {
    if (p.status !== PlayerStatus.Alive || p.noise <= 0) continue;
    const d = dist(m, p);
    if (d <= p.noise * scale && d < bestD && caresAbout(ctx, m, p)) {
      best = { x: p.x, z: p.z };
      bestD = d;
    }
  }
  for (const n of ctx.noises) {
    const d = dist(m, n);
    if (d <= n.radius * scale && d < bestD && caresAbout(ctx, m, n)) {
      best = { x: n.x, z: n.z };
      bestD = d;
    }
  }
  return best;
};

export const stepMonster = (ctx: GameContext, state: WorldState, m: MonsterState, dt: number, events: GameEvent[]): void => {
  if (state.phase === RoundPhase.Intro || state.phase === RoundPhase.Ended) return;
  const tune = MONSTER_TUNING[state.difficulty];
  const enraged = state.phase === RoundPhase.GateOpening || state.gateOpen;
  const profile = KIND_PROFILES[m.kind];
  m.rage = Math.max(0, m.rage - dt);
  const boost = (enraged ? 1 + tune.enragedBonus : 1) * (m.rage > 0 ? profile.rage : 1);
  const chaseSpeed = tune.chaseSpeed * profile.chase;
  const investigateSpeed = tune.investigateSpeed * profile.investigate;
  const patrolSpeed = tune.patrolSpeed * profile.patrol;
  const loseAfter = tune.loseAfter * profile.lose;
  m.stunImmunity = Math.max(0, m.stunImmunity - dt);
  m.repathIn -= dt;
  m.calm = m.mode === MonsterMode.Chase ? 0 : m.calm + dt;

  if (m.mode === MonsterMode.Stunned) {
    m.timer -= dt;
    m.speed = 0;
    if (m.timer <= 0) startSearch(ctx, m, m.lastSeen ?? m, tune.searchSeconds);
    return;
  }
  if (m.mode === MonsterMode.Recover) {
    m.timer -= dt;
    m.speed = 0;
    if (m.timer <= 0) startSearch(ctx, m, m.lastSeen ?? m, tune.searchSeconds * 0.6);
    return;
  }
  if (m.mode === MonsterMode.Attack) {
    m.timer -= dt;
    m.speed = 0;
    const target = state.players.find((p) => p.id === m.target);
    if (target) turnToward(m, target.x - m.x, target.z - m.z, dt);
    if (m.timer > 0) return;
    if (target && target.status === PlayerStatus.Alive && dist(m, target) <= tune.attackRange * 1.4 && target.sinceHit >= MERCY_SECONDS) {
      events.push({ kind: GameEventKind.MonsterRoar, monster: m.id, x: m.x, z: m.z });
      hitPlayer(state, target, events);
    }
    m.mode = MonsterMode.Recover;
    m.timer = tune.recoverSeconds;
    m.lastSeen = target ? { x: target.x, z: target.z } : m.lastSeen;
    return;
  }

  const hearsClose = (p: PlayerState): boolean =>
    p.status === PlayerStatus.Alive && p.noise > 0 && dist(m, p) <= p.noise * tune.hearingScale * profile.hearing * 0.55;
  const visible = state.players
    .filter((p) => p.sinceHit >= MERCY_SECONDS && (monsterSees(ctx, state, m, p) || (profile.blind && hearsClose(p))))
    .sort((a, b) => dist(m, a) - dist(m, b));
  if (visible.length > 0) startChase(m, visible[0], events);

  if (m.sawHide >= 0) {
    const spot = ctx.level.hideSpots[m.sawHide];
    const hider = state.players.find((p) => p.status === PlayerStatus.Hiding && p.hideSpot === m.sawHide);
    if (!hider) {
      m.sawHide = -1;
    } else {
      const front = hideSpotFront(ctx.level, spot);
      if (dist(m, front) < PULL_RANGE) {
        const out = hideExit(ctx.level, spot);
        hider.status = PlayerStatus.Alive;
        hider.hideSpot = -1;
        hider.x = out.x;
        hider.z = out.z;
        m.sawHide = -1;
        events.push({ kind: GameEventKind.PlayerPulledOut, player: hider.id, monster: m.id, x: out.x, z: out.z });
        m.mode = MonsterMode.Attack;
        m.target = hider.id;
        m.timer = 0.3;
        return;
      }
      if (m.repathIn <= 0 || m.path.length === 0) {
        planTo(ctx, m, front);
        m.repathIn = 0.5;
      }
      followPath(ctx, state, m, chaseSpeed * boost, dt, events);
      return;
    }
  }

  switch (m.mode) {
    case MonsterMode.Chase: {
      const target = state.players.find((p) => p.id === m.target);
      if (!target || (target.status !== PlayerStatus.Alive && target.status !== PlayerStatus.Hiding)) {
        startSearch(ctx, m, m.lastSeen ?? m, tune.searchSeconds);
        return;
      }
      const seen = visible.includes(target);
      if (!seen) {
        m.timer += dt;
        if (m.timer > loseAfter || target.status === PlayerStatus.Hiding) {
          events.push({ kind: GameEventKind.MonsterLost, monster: m.id, player: target.id, x: m.x, z: m.z });
          startSearch(ctx, m, m.lastSeen ?? m, tune.searchSeconds);
          return;
        }
      }
      if (seen && dist(m, target) <= tune.attackRange) {
        m.mode = MonsterMode.Attack;
        m.timer = tune.attackWindup;
        return;
      }
      m.tauntIn -= dt;
      if (m.tauntIn <= 0) {
        events.push({ kind: GameEventKind.MonsterTaunt, monster: m.id, x: m.x, z: m.z });
        m.tauntIn = ctx.rng.range(TAUNT_MIN_GAP, TAUNT_MAX_GAP);
      }
      const goal = m.lastSeen ?? target;
      if (m.repathIn <= 0 || m.path.length === 0) {
        planTo(ctx, m, goal);
        m.repathIn = 0.3;
      }
      if (followPath(ctx, state, m, chaseSpeed * boost, dt, events) && !seen) m.timer += dt;
      return;
    }
    case MonsterMode.Investigate: {
      m.timer += dt;
      const heard = heardNoise(ctx, state, m, tune);
      if (heard && (!m.goal || dist(heard, m) < dist(m.goal, m) - 2)) planTo(ctx, m, heard);
      const arrived = followPath(ctx, state, m, investigateSpeed * boost, dt, events);
      if (arrived || m.timer > INVESTIGATE_MAX) startSearch(ctx, m, m, 4 + ctx.rng.range(0, 3));
      return;
    }
    case MonsterMode.Search: {
      m.timer -= dt;
      const heard = heardNoise(ctx, state, m, tune);
      if (heard) {
        m.mode = MonsterMode.Investigate;
        m.timer = 0;
        planTo(ctx, m, heard);
        return;
      }
      if (m.timer <= 0) {
        m.mode = MonsterMode.Patrol;
        m.path = [];
        m.timer = 0;
        return;
      }
      if (followPath(ctx, state, m, investigateSpeed * 0.8 * boost, dt, events)) {
        planTo(ctx, m, randomPointNear(ctx, m.lastSeen ?? m, 5));
        m.tauntIn -= 2;
        const sniffable = ctx.level.hideSpots.find((h) => dist(hideSpotFront(ctx.level, h), m) < SNIFF_RANGE);
        if (sniffable) events.push({ kind: GameEventKind.MonsterSniff, monster: m.id, x: m.x, z: m.z });
      }
      m.tauntIn -= dt;
      if (m.tauntIn <= 0) {
        events.push({ kind: GameEventKind.MonsterTaunt, monster: m.id, x: m.x, z: m.z });
        m.tauntIn = ctx.rng.range(TAUNT_MIN_GAP, TAUNT_MAX_GAP);
      }
      return;
    }
    default: {
      const heard = heardNoise(ctx, state, m, tune);
      if (heard) {
        m.mode = MonsterMode.Investigate;
        m.timer = 0;
        planTo(ctx, m, heard);
        return;
      }
      if (enraged && m.calm > ENRAGED_HINT_SECONDS) {
        const alive = huntablesAlive(state);
        if (alive.length > 0) {
          const victim = alive.reduce((a, b) => (dist(a, m) < dist(b, m) ? a : b));
          m.mode = MonsterMode.Investigate;
          m.timer = 0;
          m.calm = 0;
          planTo(ctx, m, randomPointNear(ctx, victim, 3));
          return;
        }
      }
      if (m.timer > 0) {
        m.timer -= dt;
        m.speed = 0;
        return;
      }
      if (m.path.length === 0 || m.repathIn < -20) {
        planTo(ctx, m, patrolGoal(ctx, state, m));
        m.repathIn = 0;
      }
      if (followPath(ctx, state, m, patrolSpeed * boost, dt, events)) m.timer = ctx.rng.range(1, 3.5);
    }
  }
};

/**
 * The Chudail hates being looked at. Hold her in your torchlight too long and she shrieks
 * and comes for you at a speed you can't outrun; break line of sight to survive.
 */
export const stepStare = (ctx: GameContext, state: WorldState, dt: number, events: GameEvent[]): void => {
  if (state.phase !== RoundPhase.Playing && state.phase !== RoundPhase.GateOpening) return;
  for (const m of state.monsters) {
    if (!KIND_PROFILES[m.kind].stare || m.mode === MonsterMode.Stunned) continue;
    let watcher: PlayerState | null = null;
    let nearest = Number.POSITIVE_INFINITY;
    for (const p of state.players) {
      if (p.status !== PlayerStatus.Alive) continue;
      const d = dist(m, p);
      if (d > STARE_RANGE || d >= nearest) continue;
      const f = forwardOf(p.yaw);
      if (((m.x - p.x) * f.x + (m.z - p.z) * f.z) / Math.max(d, 1e-6) < STARE_CONE_COS) continue;
      if (!p.torchOn && d > 4) continue;
      if (sightBlocked(ctx.world, p, m, doorOpenness(state))) continue;
      watcher = p;
      nearest = d;
    }
    m.stare = watcher ? m.stare + dt : Math.max(0, m.stare - dt * 0.6);
    if (!watcher || m.stare < STARE_LIMIT || m.rage > 0) continue;
    m.stare = 0;
    m.rage = RAGE_SECONDS;
    events.push({ kind: GameEventKind.MonsterScream, monster: m.id, player: watcher.id, x: m.x, z: m.z });
    startChase(m, watcher, events);
  }
};

export const isGuardian = (m: MonsterState): boolean => m.kind !== MonsterKind.Shikari;
