import { GameEventKind, MonsterMode, PlayerStatus, RoundOutcome, RoundPhase, ScareKind, Stance } from "@/types/game";
import type { GameEvent, WorldState } from "@/types/game";
import { KeyColor } from "@/types/world";
import { isEnumValue, isFiniteNumber, isNumberArray, isRecord, isString } from "@/lib/guards";

/**
 * The host's view of the world as it travels to the squad, about 15 times a second.
 * Players and monsters go by index (every peer builds them in the same order from the round's roster),
 * enums go as their index, doors and items only when they changed (plus a full copy every few seconds).
 */
export interface SnapshotWire {
  /** Sequence number; older snapshots that arrive late are dropped. */
  n: number;
  t: number;
  ph: number;
  pt: number;
  oc: number;
  /** Names the host is still waiting for (loading the round). */
  w: string[];
  /** One row per player, see PLAYER_FIELDS. */
  p: number[][];
  /** One row per monster: x, z, yaw, speed, mode, target index (-1 none), rage, stare. */
  m: number[][];
  /** fusesInserted, fusesNeeded, powerOn, gateOpen, lightsBurst, lightsBurstAt.x, lightsBurstAt.z */
  g: number[];
  k: KeyColor[];
  nf: number[];
  /** Per set piece: fired, by (player index or -1), seconds since it fired. */
  s: number[];
  /** Changed doors, flat: id, open (0..100), moving, locked. */
  d: number[];
  /** Changed items, flat: id, taken, x, z, y. */
  i: number[];
  e: GameEvent[];
}

export const PHASES = Object.values(RoundPhase);
export const OUTCOMES = Object.values(RoundOutcome);
export const STATUSES = Object.values(PlayerStatus);
export const MODES = Object.values(MonsterMode);
const KEY_COLORS: readonly KeyColor[] = [KeyColor.Red, KeyColor.Blue, KeyColor.Green, KeyColor.Yellow, KeyColor.Purple];
const isKeyColor = (v: unknown): v is KeyColor => typeof v === "number" && (KEY_COLORS as readonly number[]).includes(v);
const EVENT_KINDS = Object.values(GameEventKind);
const SCARES = Object.values(ScareKind);

/** Player row layout (host → clients). */
export const PLAYER_FIELDS = 20;
const DOOR_FIELDS = 4;
const ITEM_FIELDS = 5;
const MAX_EVENTS = 64;

const r2 = (v: number): number => Math.round(v * 100) / 100;
const r3 = (v: number): number => Math.round(v * 1000) / 1000;
const flag = (b: boolean): number => (b ? 1 : 0);

const compactEvent = (e: GameEvent): GameEvent => {
  const out: GameEvent = { kind: e.kind };
  if (e.player !== undefined) out.player = e.player;
  if (e.monster !== undefined) out.monster = e.monster;
  if (e.door !== undefined) out.door = e.door;
  if (e.item !== undefined) out.item = e.item;
  if (e.color !== undefined) out.color = e.color;
  if (e.scare !== undefined) out.scare = e.scare;
  if (e.setPiece !== undefined) out.setPiece = e.setPiece;
  if (e.note !== undefined) out.note = e.note;
  if (e.x !== undefined) out.x = r2(e.x);
  if (e.z !== undefined) out.z = r2(e.z);
  return out;
};

export interface SnapshotEncoder {
  /** Builds the next snapshot. `full` sends every door and item, not just the changed ones. */
  encode: (events: GameEvent[], waiting: string[], full: boolean, epochs: number[]) => SnapshotWire;
}

export const createSnapshotEncoder = (state: WorldState): SnapshotEncoder => {
  let seq = 0;
  const sentDoors = state.doors.map(() => "");
  const sentItems = state.items.map(() => "");
  const playerIndex = (id: string | null): number => (id === null ? -1 : state.players.findIndex((p) => p.id === id));
  return {
    encode: (events, waiting, full, epochs) => {
      seq += 1;
      const d: number[] = [];
      state.doors.forEach((door, id) => {
        const row = [id, Math.round(door.open * 100), door.moving, flag(door.locked)];
        const key = row.join(",");
        if (!full && key === sentDoors[id]) return;
        sentDoors[id] = key;
        d.push(...row);
      });
      const i: number[] = [];
      state.items.forEach((item, id) => {
        const row = [id, flag(item.taken), r2(item.x), r2(item.z), r2(item.y)];
        const key = row.join(",");
        if (!full && key === sentItems[id]) return;
        sentItems[id] = key;
        i.push(...row);
      });
      return {
        n: seq,
        t: r2(state.time),
        ph: PHASES.indexOf(state.phase),
        pt: r2(state.phaseTimer),
        oc: OUTCOMES.indexOf(state.outcome),
        w: waiting,
        p: state.players.map((p, idx) => [
          r2(p.x),
          r2(p.z),
          r3(p.yaw),
          r3(p.pitch),
          r2(p.vx),
          r2(p.vz),
          p.stance,
          STATUSES.indexOf(p.status),
          r2(p.health),
          r2(p.battery),
          flag(p.torchOn),
          r2(p.flashCooldown),
          p.carrying,
          p.hideSpot,
          r2(p.bleed),
          r2(p.revive),
          r2(Math.min(p.sinceHit, 99)),
          epochs[idx] ?? 0,
          r2(p.noise),
          r2(p.stamina),
        ]),
        m: state.monsters.map((m) => [r2(m.x), r2(m.z), r3(m.yaw), r2(m.speed), MODES.indexOf(m.mode), playerIndex(m.target), r2(m.rage), r2(m.stare)]),
        g: [state.fusesInserted, state.fusesNeeded, flag(state.powerOn), flag(state.gateOpen), r2(state.lightsBurst), r2(state.lightsBurstAt.x), r2(state.lightsBurstAt.z)],
        k: [...state.keys],
        nf: [...state.notesFound],
        s: state.setPieces.flatMap((sp) => [flag(sp.fired), playerIndex(sp.by), r2(Math.min(sp.t, 99))]),
        d,
        i,
        e: events.slice(-MAX_EVENTS).map(compactEvent),
      };
    },
  };
};

const isRows = (value: unknown, maxRows: number, width: number): value is number[][] =>
  Array.isArray(value) && value.length <= maxRows && value.every((row) => isNumberArray(row, width) && row.length === width);

const parseEvent = (value: unknown): GameEvent | null => {
  if (!isRecord(value) || !isEnumValue(EVENT_KINDS, value.kind)) return null;
  const e: GameEvent = { kind: value.kind };
  if (isString(value.player, 64)) e.player = value.player;
  if (isFiniteNumber(value.monster)) e.monster = value.monster;
  if (isFiniteNumber(value.door)) e.door = value.door;
  if (isFiniteNumber(value.item)) e.item = value.item;
  if (value.color === null || isKeyColor(value.color)) e.color = value.color;
  if (isEnumValue(SCARES, value.scare)) e.scare = value.scare;
  if (isFiniteNumber(value.setPiece)) e.setPiece = value.setPiece;
  if (isFiniteNumber(value.note)) e.note = value.note;
  if (isFiniteNumber(value.x)) e.x = value.x;
  if (isFiniteNumber(value.z)) e.z = value.z;
  return e;
};

/** Checks a snapshot from the wire. Anything malformed is dropped whole. */
export const parseSnapshot = (value: unknown): SnapshotWire | null => {
  if (!isRecord(value)) return null;
  const { n, t, ph, pt, oc, w, p, m, g, k, nf, s, d, i, e } = value;
  if (![n, t, ph, pt, oc].every(isFiniteNumber)) return null;
  if (!Array.isArray(w) || !w.every((x) => isString(x, 32)) || w.length > 16) return null;
  if (!isRows(p, 16, PLAYER_FIELDS) || !isRows(m, 16, 8)) return null;
  if (!isNumberArray(g, 8) || g.length !== 7 || !isNumberArray(nf, 32) || !isNumberArray(s, 600)) return null;
  if (!Array.isArray(k) || k.length > 8 || !k.every(isKeyColor)) return null;
  if (!isNumberArray(d, 4000) || d.length % DOOR_FIELDS !== 0 || !isNumberArray(i, 4000) || i.length % ITEM_FIELDS !== 0) return null;
  if (!Array.isArray(e) || e.length > MAX_EVENTS) return null;
  const events = e.map(parseEvent).filter((x): x is GameEvent => x !== null);
  return { n: n as number, t: t as number, ph: ph as number, pt: pt as number, oc: oc as number, w: w as string[], p, m, g, k, nf, s, d, i, e: events };
};

/** Copies the shared world (doors, items, progress, set pieces) from a snapshot. Bodies are left to the client session. */
export const applyWorld = (state: WorldState, wire: SnapshotWire): void => {
  const phase = PHASES[wire.ph];
  if (phase) state.phase = phase;
  state.phaseTimer = wire.pt;
  state.outcome = OUTCOMES[wire.oc] ?? state.outcome;
  state.time = wire.t;
  for (let j = 0; j + DOOR_FIELDS - 1 < wire.d.length; j += DOOR_FIELDS) {
    const door = state.doors[wire.d[j]];
    if (!door) continue;
    door.open = wire.d[j + 1] / 100;
    door.moving = wire.d[j + 2];
    door.locked = wire.d[j + 3] === 1;
  }
  for (let j = 0; j + ITEM_FIELDS - 1 < wire.i.length; j += ITEM_FIELDS) {
    const item = state.items[wire.i[j]];
    if (!item) continue;
    item.taken = wire.i[j + 1] === 1;
    item.x = wire.i[j + 2];
    item.z = wire.i[j + 3];
    item.y = wire.i[j + 4];
  }
  const [fusesInserted, fusesNeeded, powerOn, gateOpen, burst, bx, bz] = wire.g;
  state.fusesInserted = fusesInserted;
  state.fusesNeeded = fusesNeeded;
  state.powerOn = powerOn === 1;
  state.gateOpen = gateOpen === 1;
  state.lightsBurst = burst;
  state.lightsBurstAt = { x: bx, z: bz };
  state.keys = [...wire.k];
  state.notesFound = [...wire.nf];
  state.setPieces.forEach((sp, idx) => {
    const fired = wire.s[idx * 3] === 1;
    if (fired && !sp.fired) sp.t = wire.s[idx * 3 + 2] ?? 0;
    sp.fired = fired;
    const by = wire.s[idx * 3 + 1] ?? -1;
    sp.by = by >= 0 ? (state.players[by]?.id ?? null) : null;
  });
};

/** Stance from the wire, falling back to walking. */
export const stanceOf = (v: number): Stance => (v === Stance.Sprint || v === Stance.Crouch ? v : Stance.Walk);
