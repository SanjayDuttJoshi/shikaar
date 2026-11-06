import { GameEventKind, MonsterMode, PlayerStatus, RoundPhase, ScareKind } from "@/types/game";
import type { GameEvent, PlayerState, WorldState } from "@/types/game";
import { DoorKind } from "@/types/world";
import type { Vec2 } from "@/types/world";
import { MONSTER_TUNING, SCARE_MAX_GAP, SCARE_MIN_GAP } from "@/game/constants";
import type { GameContext } from "@/game/context";
import { setDoorTarget } from "@/game/doors";
import { findPath, randomOpenPoint } from "@/game/nav";
import { forwardOf } from "@/game/player-motion";
import { doorCenter } from "@/world/geometry";

const QUIET_AFTER_CHASE = 14;
const TENSION_RANGE = 26;
const BURST_SECONDS = 2.4;

const SCARE_POOL: ScareKind[] = [
  ScareKind.DoorSlam,
  ScareKind.DoorSlam,
  ScareKind.DistantScream,
  ScareKind.Whisper,
  ScareKind.Whisper,
  ScareKind.LightsBurst,
  ScareKind.ObjectFall,
  ScareKind.MetalScrape,
  ScareKind.ChildLaugh,
  ScareKind.FootstepsAbove,
  ScareKind.Knock,
  ScareKind.GlassBreak,
  ScareKind.BreathBehind,
  ScareKind.Whistle,
  ScareKind.BabyCry,
  ScareKind.MusicBox,
];

const dist = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.z - b.z);

const pointAround = (ctx: GameContext, p: PlayerState, min: number, max: number): Vec2 => {
  for (let i = 0; i < 12; i += 1) {
    const angle = ctx.rng.range(-Math.PI, Math.PI);
    const r = ctx.rng.range(min, max);
    const q = { x: p.x + Math.cos(angle) * r, z: p.z + Math.sin(angle) * r };
    const hit = randomOpenPoint(ctx.nav, q.x - 1, q.z - 1, q.x + 1, q.z + 1, ctx.rng.next);
    if (hit) return hit;
  }
  return { x: p.x, z: p.z };
};

/** Picks a closed-able door some way off the player and bangs it shut. */
const slamDoor = (ctx: GameContext, state: WorldState, p: PlayerState, events: GameEvent[]): Vec2 | null => {
  const candidates = ctx.level.doors
    .map((door, id) => ({ id, at: doorCenter(door), door }))
    .filter((c) => c.door.kind !== DoorKind.MainGate && !state.doors[c.id].locked)
    .filter((c) => {
      const d = dist(c.at, p);
      return d > 7 && d < 24;
    });
  if (candidates.length === 0) return null;
  const pick = ctx.rng.pick(candidates);
  if (state.doors[pick.id].open > 0.5) setDoorTarget(ctx, state, pick.id, false, events);
  else {
    state.doors[pick.id].open = 0.6;
    setDoorTarget(ctx, state, pick.id, false, events);
  }
  return pick.at;
};

/**
 * Pacing: keeps the building alive between encounters (slams, whispers, flickers),
 * stays quiet right after a chase, and nudges a bored monster toward the squad.
 */
export const stepDirector = (ctx: GameContext, state: WorldState, dt: number, events: GameEvent[]): void => {
  if (state.phase !== RoundPhase.Playing && state.phase !== RoundPhase.GateOpening) return;
  const dir = state.director;
  const alive = state.players.filter((p) => p.status === PlayerStatus.Alive || p.status === PlayerStatus.Hiding);
  if (alive.length === 0) return;
  const chasing = state.monsters.some((m) => m.mode === MonsterMode.Chase || m.mode === MonsterMode.Attack);
  if (chasing) dir.lastChase = state.time;
  let nearest = Number.POSITIVE_INFINITY;
  for (const m of state.monsters) for (const p of alive) nearest = Math.min(nearest, dist(m, p));
  const target = chasing ? 1 : Math.max(0, 1 - nearest / TENSION_RANGE);
  dir.tension += (target - dir.tension) * Math.min(1, dt * 1.5);
  state.lightsBurst = Math.max(0, state.lightsBurst - dt);

  dir.nextScare -= dt;
  if (dir.nextScare <= 0) {
    const quiet = state.time - dir.lastChase > QUIET_AFTER_CHASE && dir.tension < 0.45;
    if (quiet) {
      const victim = ctx.rng.pick(alive.filter((p) => p.status === PlayerStatus.Alive).length > 0 ? alive.filter((p) => p.status === PlayerStatus.Alive) : alive);
      const kind = ctx.rng.pick(SCARE_POOL);
      let at: Vec2 | null;
      if (kind === ScareKind.DoorSlam) at = slamDoor(ctx, state, victim, events);
      else if (kind === ScareKind.Whisper || kind === ScareKind.BreathBehind) {
        const f = forwardOf(victim.yaw);
        at = { x: victim.x - f.x * 1.4, z: victim.z - f.z * 1.4 };
      } else if (kind === ScareKind.LightsBurst) {
        state.lightsBurst = BURST_SECONDS;
        state.lightsBurstAt = { x: victim.x, z: victim.z };
        at = { x: victim.x, z: victim.z };
      } else if (kind === ScareKind.Knock) {
        const near = ctx.level.doors.map((d) => doorCenter(d)).filter((c) => dist(c, victim) > 3 && dist(c, victim) < 12);
        at = near.length > 0 ? ctx.rng.pick(near) : pointAround(ctx, victim, 6, 12);
      } else if (kind === ScareKind.MusicBox) {
        at = pointAround(ctx, victim, 5, 10);
      } else at = pointAround(ctx, victim, 12, 26);
      if (at) events.push({ kind: GameEventKind.Scare, scare: kind, player: victim.id, x: at.x, z: at.z });
      dir.nextScare = ctx.rng.range(SCARE_MIN_GAP, SCARE_MAX_GAP);
    } else {
      dir.nextScare = 6;
    }
  }

  const hintAfter = MONSTER_TUNING[state.difficulty].hintAfter;
  for (const m of state.monsters) {
    // Guardians keep to their own wing; only the roaming Shikari gets nudged toward the squad.
    if (m.home >= 0 || m.mode !== MonsterMode.Patrol || m.calm < hintAfter) continue;
    const victim = ctx.rng.pick(alive);
    const goal = pointAround(ctx, victim, 4, 9);
    m.mode = MonsterMode.Investigate;
    m.timer = 0;
    m.goal = goal;
    m.path = findPath(ctx.nav, m, goal);
    m.calm = hintAfter * 0.4;
  }
};
