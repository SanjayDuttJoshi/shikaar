import { GameEventKind, InteractKind, MonsterMode, PlayerStatus, RoundPhase } from "@/types/game";
import type { GameEvent, InteractTarget, PlayerState, WorldState } from "@/types/game";
import { DoorKind, HideKind, ItemKind } from "@/types/world";
import type { KeyColor, Vec2 } from "@/types/world";
import { sightBlocked } from "@/game/collision";
import {
  BATTERY_MAX,
  BATTERY_PICKUP,
  FLASH_CONE_COS,
  FLASH_COOLDOWN,
  FLASH_COST,
  FLASH_RANGE,
  FUSE_BOX_RANGE,
  GATE_OPEN_SECONDS,
  INTERACT_RANGE,
  MAX_HEALTH,
  NOISE_FLASH,
  NOISE_PICKUP,
  REVIVE_RANGE,
  REVIVE_SECONDS,
  STUN_IMMUNITY,
  STUN_SECONDS,
} from "@/game/constants";
import { doorOpenness } from "@/game/context";
import type { GameContext } from "@/game/context";
import { setDoorTarget } from "@/game/doors";
import { hideExit, hideSpotFront } from "@/game/hiding";
import { forwardOf } from "@/game/player-motion";
import { doorCenter } from "@/world/geometry";
import { keyLabel } from "@/lib/labels";

const FACING_MIN = 0.25;
const SAW_HIDE_WINDOW = 0.9;

const facing = (p: PlayerState, at: Vec2): number => {
  const f = forwardOf(p.yaw);
  const dx = at.x - p.x;
  const dz = at.z - p.z;
  const d = Math.hypot(dx, dz);
  return d < 0.2 ? 1 : (f.x * dx + f.z * dz) / d;
};

/** Picking things up wins over doors, and hiding comes last (items often lie on beds). */
const PRIORITY_PENALTY: Record<InteractKind, number> = {
  [InteractKind.None]: 0,
  [InteractKind.PickUp]: -0.6,
  [InteractKind.FuseBox]: -0.4,
  [InteractKind.Revive]: -0.5,
  [InteractKind.Door]: 0,
  [InteractKind.LockedDoor]: 0,
  [InteractKind.Gate]: 0,
  [InteractKind.Hide]: 0.9,
  [InteractKind.Unhide]: 0,
};

const canTakeNow = (p: PlayerState, kind: ItemKind): boolean => {
  if (kind === ItemKind.Battery) return p.battery < BATTERY_MAX - 5;
  if (kind === ItemKind.Medkit) return p.health < MAX_HEALTH;
  if (kind === ItemKind.Fuse) return p.carrying < 0;
  return true;
};

const NONE: InteractTarget = { kind: InteractKind.None, id: -1, label: "", holdSeconds: 0 };

/** What the player would use by pressing E right now, best candidate first. */
export const findInteractTarget = (ctx: GameContext, state: WorldState, p: PlayerState): InteractTarget => {
  if (p.status === PlayerStatus.Hiding) return { kind: InteractKind.Unhide, id: p.hideSpot, label: "Bahar niklo", holdSeconds: 0 };
  if (p.status !== PlayerStatus.Alive) return NONE;
  const options: Array<{ score: number; target: InteractTarget }> = [];
  const consider = (at: Vec2, range: number, target: InteractTarget, needsFacing = true): void => {
    const d = Math.hypot(at.x - p.x, at.z - p.z);
    if (d > range) return;
    const f = facing(p, at);
    if (needsFacing && f < FACING_MIN) return;
    options.push({ score: d - f * 0.8 + PRIORITY_PENALTY[target.kind], target });
  };

  for (const [id, item] of state.items.entries()) {
    if (item.taken) continue;
    const spawn = ctx.level.items[id];
    // Don't offer what you can't take right now, or it would hide the door prompt behind it.
    if (!canTakeNow(p, spawn.kind)) continue;
    const label =
      spawn.kind === ItemKind.Key
        ? `${keyLabel(spawn.color)} chaabi uthao`
        : spawn.kind === ItemKind.Fuse
          ? "Fuse uthao"
          : spawn.kind === ItemKind.Battery
            ? "Battery uthao"
            : spawn.kind === ItemKind.Envelope
              ? "Lifafa kholo"
              : "Medkit uthao";
    consider(item, INTERACT_RANGE - 0.2, { kind: InteractKind.PickUp, id, label, holdSeconds: 0 });
  }
  for (const [id, door] of ctx.level.doors.entries()) {
    const at = doorCenter(door);
    const ds = state.doors[id];
    if (door.kind === DoorKind.MainGate) {
      if (!state.gateOpen) consider(at, INTERACT_RANGE + 0.6, { kind: InteractKind.Gate, id, label: "Main gate", holdSeconds: 0 });
      continue;
    }
    if (ds.locked) {
      const has = door.lock !== null && state.keys.includes(door.lock);
      const label = has ? `${keyLabel(door.lock)} chaabi se kholo` : `Band hai: ${keyLabel(door.lock)} chaabi chahiye`;
      consider(at, INTERACT_RANGE, { kind: InteractKind.LockedDoor, id, label, holdSeconds: 0 });
    } else {
      consider(at, INTERACT_RANGE, { kind: InteractKind.Door, id, label: ds.open > 0.5 ? "Darwaza band karo" : "Darwaza kholo", holdSeconds: 0 });
    }
  }
  for (const spot of ctx.level.hideSpots) {
    if (state.players.some((o) => o.hideSpot === spot.id && o.status === PlayerStatus.Hiding)) continue;
    const label = spot.kind === HideKind.UnderBed ? "Bed ke neeche chhupo" : spot.kind === HideKind.Locker ? "Locker mein chhupo" : "Almari mein chhupo";
    consider(hideSpotFront(ctx.level, spot), 1.3, { kind: InteractKind.Hide, id: spot.id, label, holdSeconds: 0 });
  }
  const box = ctx.level.props[ctx.level.fuseBoxPropId];
  if (box && state.fusesInserted < state.fusesNeeded) {
    const label = p.carrying >= 0 ? "Fuse lagao" : `Fuse box (${state.fusesInserted}/${state.fusesNeeded})`;
    consider(box, FUSE_BOX_RANGE, { kind: InteractKind.FuseBox, id: box.id, label, holdSeconds: 0 });
  }
  for (const other of state.players) {
    if (other.id === p.id || other.status !== PlayerStatus.Downed) continue;
    consider(other, REVIVE_RANGE, { kind: InteractKind.Revive, id: other.id, label: `${other.name} ko uthao`, holdSeconds: REVIVE_SECONDS }, false);
  }
  if (options.length === 0) return NONE;
  options.sort((a, b) => a.score - b.score);
  return options[0].target;
};

const enterHide = (ctx: GameContext, state: WorldState, p: PlayerState, spotId: number, events: GameEvent[]): void => {
  const spot = ctx.level.hideSpots[spotId];
  if (!spot || state.players.some((o) => o.hideSpot === spotId && o.status === PlayerStatus.Hiding)) return;
  for (const m of state.monsters) {
    const watching = m.mode === MonsterMode.Chase && m.target === p.id && m.timer < SAW_HIDE_WINDOW;
    const near = Math.hypot(m.x - p.x, m.z - p.z) < 16 && !sightBlocked(ctx.world, m, p, doorOpenness(state));
    if (watching && near) m.sawHide = spotId;
  }
  p.status = PlayerStatus.Hiding;
  p.hideSpot = spotId;
  p.torchBeforeHide = p.torchOn;
  p.torchOn = false;
  p.vx = 0;
  p.vz = 0;
  const prop = ctx.level.props[spot.propId];
  p.x = prop.x;
  p.z = prop.z;
  events.push({ kind: GameEventKind.PlayerHid, player: p.id, x: p.x, z: p.z });
};

export const leaveHide = (ctx: GameContext, p: PlayerState, events: GameEvent[]): void => {
  if (p.status !== PlayerStatus.Hiding) return;
  const spot = ctx.level.hideSpots[p.hideSpot];
  const out = hideExit(ctx.level, spot);
  p.status = PlayerStatus.Alive;
  p.hideSpot = -1;
  p.torchOn = p.torchBeforeHide && p.battery > 0;
  p.x = out.x;
  p.z = out.z;
  events.push({ kind: GameEventKind.PlayerUnhid, player: p.id, x: out.x, z: out.z });
};

const pickUp = (ctx: GameContext, state: WorldState, p: PlayerState, id: number, events: GameEvent[]): void => {
  const item = state.items[id];
  const spawn = ctx.level.items[id];
  if (!item || item.taken || Math.hypot(item.x - p.x, item.z - p.z) > INTERACT_RANGE + 0.6) return;
  const at = { x: item.x, z: item.z };
  switch (spawn.kind) {
    case ItemKind.Key:
      if (spawn.color !== null && !state.keys.includes(spawn.color)) state.keys.push(spawn.color);
      events.push({ kind: GameEventKind.KeyFound, player: p.id, item: id, color: spawn.color, ...at });
      break;
    case ItemKind.Fuse:
      if (p.carrying >= 0) {
        events.push({ kind: GameEventKind.DoorLocked, player: p.id, item: id, ...at });
        return;
      }
      p.carrying = id;
      events.push({ kind: GameEventKind.FuseFound, player: p.id, item: id, ...at });
      break;
    case ItemKind.Envelope: {
      // Films always play in story order, whichever envelope you happen to open first.
      const film = state.notesFound.length;
      state.notesFound.push(film);
      events.push({ kind: GameEventKind.EnvelopeOpened, player: p.id, item: id, note: film, ...at });
      break;
    }
    case ItemKind.Battery:
      if (p.battery >= BATTERY_MAX - 5) return;
      p.battery = Math.min(BATTERY_MAX, p.battery + BATTERY_PICKUP);
      events.push({ kind: GameEventKind.BatteryFound, player: p.id, item: id, ...at });
      break;
    default:
      if (p.health >= MAX_HEALTH) return;
      p.health = MAX_HEALTH;
      events.push({ kind: GameEventKind.MedkitUsed, player: p.id, item: id, ...at });
  }
  item.taken = true;
  ctx.noises.push({ ...at, radius: NOISE_PICKUP, player: p.id });
};

const applyLockedDoor = (ctx: GameContext, state: WorldState, p: PlayerState, id: number, events: GameEvent[]): void => {
  const door = ctx.level.doors[id];
  const at = doorCenter(door);
  if (door.lock !== null && state.keys.includes(door.lock as KeyColor)) {
    for (const [otherId, other] of ctx.level.doors.entries()) {
      if (other.lock === door.lock) state.doors[otherId].locked = false;
    }
    events.push({ kind: GameEventKind.DoorUnlocked, player: p.id, door: id, color: door.lock, ...at });
    setDoorTarget(ctx, state, id, true, events, true);
    return;
  }
  events.push({ kind: GameEventKind.DoorLocked, player: p.id, door: id, color: door.lock, ...at });
};

const applyFuseBox = (ctx: GameContext, state: WorldState, p: PlayerState, events: GameEvent[]): void => {
  const box = ctx.level.props[ctx.level.fuseBoxPropId];
  if (p.carrying < 0 || Math.hypot(box.x - p.x, box.z - p.z) > FUSE_BOX_RANGE + 0.6) return;
  p.carrying = -1;
  state.fusesInserted += 1;
  events.push({ kind: GameEventKind.FuseInserted, player: p.id, x: box.x, z: box.z });
  if (state.fusesInserted >= state.fusesNeeded && !state.powerOn) {
    state.powerOn = true;
    state.phase = RoundPhase.GateOpening;
    state.phaseTimer = GATE_OPEN_SECONDS;
    events.push({ kind: GameEventKind.PowerRestored, player: p.id, x: box.x, z: box.z });
  }
};

/** Host-side: validates and applies one interaction request from a player. */
export const applyInteract = (
  ctx: GameContext,
  state: WorldState,
  playerId: string,
  target: InteractTarget,
  events: GameEvent[],
): void => {
  const p = state.players.find((q) => q.id === playerId);
  if (!p || state.phase === RoundPhase.Ended || state.phase === RoundPhase.Intro) return;
  if (target.kind === InteractKind.Unhide) {
    leaveHide(ctx, p, events);
    return;
  }
  if (p.status !== PlayerStatus.Alive) return;
  switch (target.kind) {
    case InteractKind.PickUp:
      pickUp(ctx, state, p, Number(target.id), events);
      break;
    case InteractKind.Door: {
      const id = Number(target.id);
      const ds = state.doors[id];
      if (ds && !ds.locked) setDoorTarget(ctx, state, id, ds.open < 0.5, events, true);
      break;
    }
    case InteractKind.LockedDoor:
      applyLockedDoor(ctx, state, p, Number(target.id), events);
      break;
    case InteractKind.Gate: {
      const at = doorCenter(ctx.level.doors[Number(target.id)]);
      events.push({ kind: GameEventKind.DoorLocked, player: p.id, door: Number(target.id), color: null, ...at });
      break;
    }
    case InteractKind.Hide:
      enterHide(ctx, state, p, Number(target.id), events);
      break;
    case InteractKind.FuseBox:
      applyFuseBox(ctx, state, p, events);
      break;
    default:
      break;
  }
};

/** Host-side: a teammate holding E next to a downed player. */
export const applyRevive = (state: WorldState, helperId: string, targetId: string, dt: number, events: GameEvent[]): void => {
  const helper = state.players.find((q) => q.id === helperId);
  const target = state.players.find((q) => q.id === targetId);
  if (!helper || !target || helper.status !== PlayerStatus.Alive || target.status !== PlayerStatus.Downed) return;
  if (Math.hypot(helper.x - target.x, helper.z - target.z) > REVIVE_RANGE + 0.5) return;
  target.revive += dt;
  if (target.revive < REVIVE_SECONDS) return;
  target.status = PlayerStatus.Alive;
  target.health = 1;
  target.revive = 0;
  target.sinceHit = 0;
  events.push({ kind: GameEventKind.PlayerRevived, player: target.id, x: target.x, z: target.z });
};

export const toggleTorch = (p: PlayerState): void => {
  if (p.status !== PlayerStatus.Alive) return;
  p.torchOn = p.battery > 0 ? !p.torchOn : false;
};

/** Burst of light that freezes a monster in front of you for a moment. Costs battery. */
export const applyFlash = (ctx: GameContext, state: WorldState, playerId: string, events: GameEvent[]): void => {
  const p = state.players.find((q) => q.id === playerId);
  if (!p || p.status !== PlayerStatus.Alive || p.flashCooldown > 0 || p.battery < FLASH_COST) return;
  p.battery -= FLASH_COST;
  p.flashCooldown = FLASH_COOLDOWN;
  events.push({ kind: GameEventKind.Flash, player: p.id, x: p.x, z: p.z });
  ctx.noises.push({ x: p.x, z: p.z, radius: NOISE_FLASH, player: p.id });
  const f = forwardOf(p.yaw);
  for (const m of state.monsters) {
    const dx = m.x - p.x;
    const dz = m.z - p.z;
    const d = Math.hypot(dx, dz);
    if (d > FLASH_RANGE || m.stunImmunity > 0) continue;
    if ((f.x * dx + f.z * dz) / Math.max(d, 1e-6) < FLASH_CONE_COS) continue;
    if (sightBlocked(ctx.world, p, m, doorOpenness(state))) continue;
    m.mode = MonsterMode.Stunned;
    m.timer = STUN_SECONDS;
    m.stunImmunity = STUN_IMMUNITY;
    m.lastSeen = { x: p.x, z: p.z };
    m.path = [];
    m.sawHide = -1;
    events.push({ kind: GameEventKind.MonsterStunned, monster: m.id, player: p.id, x: m.x, z: m.z });
  }
};
