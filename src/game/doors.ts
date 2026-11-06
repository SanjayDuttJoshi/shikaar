import { GameEventKind } from "@/types/game";
import type { GameEvent, WorldState } from "@/types/game";
import { DoorKind } from "@/types/world";
import type { Vec2 } from "@/types/world";
import { NOISE_DOOR } from "@/game/constants";
import type { GameContext } from "@/game/context";
import { doorCenter } from "@/world/geometry";

const DOOR_SPEED = 2.4;
const MONSTER_DOOR_RANGE = 1.9;
const MONSTER_HOLD_SECONDS = 1.6;

/** Starts a door moving. Only doors a player handles make a noise the monster can hear. */
export const setDoorTarget = (
  ctx: GameContext,
  state: WorldState,
  id: number,
  open: boolean,
  events: GameEvent[],
  byPlayer = false,
): void => {
  const door = state.doors[id];
  if (!door) return;
  door.moving = open ? 1 : -1;
  const at = doorCenter(ctx.level.doors[id]);
  events.push({ kind: open ? GameEventKind.DoorOpened : GameEventKind.DoorClosed, door: id, x: at.x, z: at.z });
  if (byPlayer) ctx.noises.push({ x: at.x, z: at.z, radius: NOISE_DOOR, player: null });
};

export const isDoorOpenFor = (state: WorldState, id: number): boolean => (state.doors[id]?.open ?? 0) > 0.5;

/** Animates door leaves and lets monsters shove through any door, locked or not. */
export const stepDoors = (ctx: GameContext, state: WorldState, dt: number, events: GameEvent[]): void => {
  for (const [id, door] of state.doors.entries()) {
    if (door.monsterHold > 0) {
      door.monsterHold -= dt;
      if (door.monsterHold <= 0 && door.locked) setDoorTarget(ctx, state, id, false, events);
    }
    if (door.moving !== 0) {
      door.open = Math.max(0, Math.min(1, door.open + door.moving * DOOR_SPEED * dt));
      if (door.open === 0 || door.open === 1) door.moving = 0;
    }
  }
};

/** Opens any door the monster reaches. Returns true if it had to bash a shut one (it pauses for that). */
export const monsterPushDoors = (ctx: GameContext, state: WorldState, at: Vec2, events: GameEvent[]): boolean => {
  let bashed = false;
  for (const [id, door] of state.doors.entries()) {
    if (ctx.level.doors[id].kind === DoorKind.MainGate) continue;
    const c = doorCenter(ctx.level.doors[id]);
    if (Math.hypot(c.x - at.x, c.z - at.z) > MONSTER_DOOR_RANGE) continue;
    if (door.locked) door.monsterHold = MONSTER_HOLD_SECONDS;
    if (door.open < 0.6 && door.moving !== 1) {
      bashed = bashed || door.open < 0.1;
      setDoorTarget(ctx, state, id, true, events);
    }
  }
  return bashed;
};
