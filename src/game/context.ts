import { Difficulty, MonsterMode, PlayerStatus, RoundOutcome, RoundPhase, Stance } from "@/types/game";
import type { MonsterState, PlayerState, WorldState } from "@/types/game";
import { LightKind } from "@/types/world";
import type { Level, Vec2 } from "@/types/world";
import { buildCollisionWorld } from "@/game/collision";
import type { CollisionWorld, DoorOpenness } from "@/game/collision";
import {
  BATTERY_MAX,
  INTRO_SECONDS,
  MAX_HEALTH,
  SCARE_MIN_GAP,
  STAMINA_MAX,
  TAUNT_MIN_GAP,
} from "@/game/constants";
import { buildNavGrid } from "@/game/nav";
import type { NavGrid } from "@/game/nav";
import { roomIdAt } from "@/world/level-queries";
import { CELL } from "@/world/constants";
import { createRng } from "@/world/rng";
import type { Rng } from "@/world/rng";

/** A sound the monster can hear this tick. */
export interface Noise extends Vec2 {
  radius: number;
  player: string | null;
}

/** Static data shared by every system for one round, plus host-only scratch state. */
export interface GameContext {
  level: Level;
  world: CollisionWorld;
  nav: NavGrid;
  rng: Rng;
  noises: Noise[];
  /** Working lamps: standing near one makes you easy to spot. Courtyards count as moonlit. */
  lamps: Vec2[];
}

export const createGameContext = (level: Level, hostSeed: number): GameContext => {
  const world = buildCollisionWorld(level);
  const nav = buildNavGrid(world, (x, z) => roomIdAt(level, Math.floor(x / CELL), Math.floor(z / CELL)) >= 0);
  const lamps = level.lights.filter((l) => !l.dead && l.kind !== LightKind.Moon).map((l) => ({ x: l.x, z: l.z }));
  return { level, world, nav, rng: createRng(hostSeed), noises: [], lamps };
};

export const doorOpenness = (state: WorldState): DoorOpenness => (id) => state.doors[id]?.open ?? 1;

export interface PlayerSeed {
  id: string;
  name: string;
  color: number;
}

export const createPlayer = (seed: PlayerSeed, spawn: Level["spawns"][number]): PlayerState => ({
  id: seed.id,
  name: seed.name,
  color: seed.color,
  x: spawn.x,
  z: spawn.z,
  yaw: spawn.yaw,
  pitch: 0,
  vx: 0,
  vz: 0,
  stance: Stance.Walk,
  status: PlayerStatus.Alive,
  health: MAX_HEALTH,
  stamina: STAMINA_MAX,
  exhausted: false,
  battery: BATTERY_MAX,
  torchOn: true,
  torchBeforeHide: true,
  flashCooldown: 0,
  carrying: -1,
  hideSpot: -1,
  bleed: 0,
  revive: 0,
  noise: 0,
  sinceHit: 99,
});

const createMonster = (id: number, spawn: Level["monsterSpawns"][number]): MonsterState => ({
  id,
  kind: spawn.kind,
  home: spawn.wing,
  rage: 0,
  stare: 0,
  x: spawn.x,
  z: spawn.z,
  yaw: spawn.yaw,
  speed: 0,
  mode: MonsterMode.Patrol,
  timer: 0,
  target: null,
  goal: null,
  lastSeen: null,
  path: [],
  repathIn: 0,
  stepPhase: 0,
  tauntIn: TAUNT_MIN_GAP,
  stunImmunity: 0,
  calm: 0,
  sawHide: -1,
  doorPause: 0,
  stuck: 0,
});

/** Faces the squad toward the middle of the spawn room so the first view isn't a wall. */
const spawnFacing = (level: Level, spot: Vec2): number => {
  const room = level.rooms[roomIdAt(level, Math.floor(spot.x / CELL), Math.floor(spot.z / CELL))];
  if (!room) return 0;
  const cx = (room.rect.x + room.rect.w / 2) * CELL;
  const cz = (room.rect.y + room.rect.h / 2) * CELL;
  const dx = cx - spot.x;
  const dz = cz - spot.z;
  if (Math.hypot(dx, dz) < 0.5) return room.rect.w >= room.rect.h ? -Math.PI / 2 : 0;
  return Math.atan2(-dx, -dz);
};

/** Spawn spots for a squad, side by side (not one behind another, staring into the back of a head). */
const squadSpots = (level: Level, yaw: number): Level["spawns"] => {
  const origin = level.spawns[0];
  // Camera forward for this yaw (same as forwardOf in player-motion, which imports this file).
  const f = { x: -Math.sin(yaw), z: -Math.cos(yaw) };
  const along = (s: Level["spawns"][number]): number => Math.abs((s.x - origin.x) * f.x + (s.z - origin.z) * f.z);
  return [...level.spawns].sort((a, b) => along(a) - along(b) || level.spawns.indexOf(a) - level.spawns.indexOf(b));
};

export const createWorldState = (level: Level, players: PlayerSeed[], difficulty: Difficulty): WorldState => {
  const yaw = spawnFacing(level, level.spawns[0]);
  const spots = squadSpots(level, yaw);
  return {
    time: 0,
    phase: RoundPhase.Intro,
    phaseTimer: INTRO_SECONDS,
    outcome: RoundOutcome.None,
    theme: level.theme,
    seed: level.seed,
    difficulty,
    players: players.map((p, i) => createPlayer(p, { ...spots[i % spots.length], yaw })),
    monsters: level.monsterSpawns.map((s, i) => createMonster(i, s)),
    doors: level.doors.map((d) => ({ open: d.startsOpen && d.lock === null ? 1 : 0, moving: 0, locked: d.lock !== null, monsterHold: 0 })),
    items: level.items.map((it) => ({ taken: false, x: it.x, z: it.z, y: it.y })),
    keys: [],
    fusesInserted: 0,
    fusesNeeded: level.fusesNeeded,
    powerOn: false,
    gateOpen: false,
    director: { nextScare: SCARE_MIN_GAP * 0.6, nextHint: 0, tension: 0, lastChase: -999 },
    lightsBurst: 0,
    lightsBurstAt: { x: 0, z: 0 },
    setPieces: level.setPieces.map(() => ({ fired: false, t: 0, by: null })),
    notesFound: [],
  };
};
