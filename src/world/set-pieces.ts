import { PropKind, RoomKind, SetPieceKind, Theme } from "@/types/world";
import type { PropSpawn, Room, SetPiece, Vec2, Wing } from "@/types/world";
import { CELL, WALL_HEIGHT } from "@/world/constants";
import type { Draft } from "@/world/draft";
import { boxesOverlap, footprint, roomInterior } from "@/world/geometry";
import type { FurnishState } from "@/world/furnish";
import { freeFloorPoint } from "@/world/furnish";

const FIGURE_SIZE = 0.75;
const CAT_PERCHES = new Set([PropKind.Shelf, PropKind.MetalLocker, PropKind.Wardrobe, PropKind.MetalCabinet]);
const PERCH_HEIGHT: Partial<Record<PropKind, number>> = {
  [PropKind.Shelf]: 1.9,
  [PropKind.MetalLocker]: 1.98,
  [PropKind.Wardrobe]: 2.1,
  [PropKind.MetalCabinet]: 1.33,
};

const isLiving = (r: Room): boolean => r.kind !== RoomKind.Corridor && r.kind !== RoomKind.Courtyard;

const clearOfProps = (state: FurnishState, room: Room, at: Vec2, size: number): boolean => {
  const box = { minX: at.x - size / 2, minZ: at.z - size / 2, maxX: at.x + size / 2, maxZ: at.z + size / 2 };
  return !state.props.some((p) => p.roomId === room.id && p.kind !== PropKind.Rug && boxesOverlap(box, footprint(p.x, p.z, p.w, p.d, p.yaw), 0.05));
};

/** A free corner of the room; the figure faces into the corner, back to the door. */
const cornerSpot = (d: Draft, state: FurnishState, room: Room): { at: Vec2; yaw: number } | null => {
  const box = roomInterior(room.rect, 0.5);
  const corners = d.rng.shuffle([
    { x: box.minX, z: box.minZ },
    { x: box.maxX, z: box.minZ },
    { x: box.minX, z: box.maxZ },
    { x: box.maxX, z: box.maxZ },
  ]);
  const cx = (box.minX + box.maxX) / 2;
  const cz = (box.minZ + box.maxZ) / 2;
  for (const c of corners) {
    if (!clearOfProps(state, room, c, FIGURE_SIZE)) continue;
    const doorNear = (state.clearPoints.get(room.id) ?? []).some((p) => Math.hypot(p.x - c.x, p.z - c.z) < 1.8);
    if (doorNear) continue;
    return { at: c, yaw: Math.atan2(c.x - cx, c.z - cz) };
  }
  return null;
};

const piece = (kind: SetPieceKind, room: Room, at: Vec2, yaw: number, radius: number, y = 0, trigger: Vec2 = at): Omit<SetPiece, "id"> => ({
  kind,
  roomId: room.id,
  x: at.x,
  z: at.z,
  yaw,
  y,
  tx: trigger.x,
  tz: trigger.z,
  radius,
});

/**
 * Scripted scares, a few per wing: a sobbing figure in a corner, a body that drops in a corridor,
 * a cat on a cupboard, and (haveli) a rooster and a rocking chair, (asylum) a radio.
 * Never in the room you wake up in, so the first minute stays quiet.
 */
export const placeSetPieces = (d: Draft, state: FurnishState, theme: Theme, wings: Wing[], spawnRoom: number): SetPiece[] => {
  const pieces: SetPiece[] = [];
  const add = (p: Omit<SetPiece, "id">): void => {
    pieces.push({ ...p, id: pieces.length });
  };
  const usedRooms = new Set<number>([spawnRoom]);
  for (const wing of wings) {
    const rooms = d.rng.shuffle(d.rooms.filter((r) => r.wing === wing.id && !usedRooms.has(r.id)));
    const living = rooms.filter(isLiving);
    for (const room of living) {
      const spot = cornerSpot(d, state, room);
      if (!spot) continue;
      add(piece(SetPieceKind.CryingFigure, room, spot.at, spot.yaw, 3.2));
      usedRooms.add(room.id);
      break;
    }
    const corridors = rooms.filter((r) => r.kind === RoomKind.Corridor && !usedRooms.has(r.id));
    for (const room of corridors) {
      const at = { x: (room.rect.x + room.rect.w / 2) * CELL, z: (room.rect.y + room.rect.h / 2) * CELL };
      if (!clearOfProps(state, room, at, 1.2)) continue;
      add(piece(SetPieceKind.FallingBody, room, at, d.rng.range(-Math.PI, Math.PI), 4.2, WALL_HEIGHT - 0.05));
      usedRooms.add(room.id);
      break;
    }
  }
  const perches = d.rng.shuffle(state.props.filter((p) => CAT_PERCHES.has(p.kind) && !usedRooms.has(p.roomId)));
  const cats = Math.min(perches.length, Math.max(1, Math.ceil(wings.length / 2)));
  for (const perch of perches.slice(0, cats)) {
    const room = d.rooms[perch.roomId];
    add(piece(SetPieceKind.Cat, room, perch, perch.yaw, 3, PERCH_HEIGHT[perch.kind] ?? perch.h));
    usedRooms.add(room.id);
  }
  if (theme === Theme.Haveli) {
    const yards = d.rng.shuffle(d.rooms.filter((r) => (r.kind === RoomKind.Kitchen || r.kind === RoomKind.Store || r.kind === RoomKind.Courtyard) && !usedRooms.has(r.id)));
    for (const room of yards.slice(0, Math.max(1, Math.ceil(wings.length / 2)))) {
      const at = freeFloorPoint(d, state, room, 0.5);
      if (!at) continue;
      add(piece(SetPieceKind.Rooster, room, at, d.rng.range(-Math.PI, Math.PI), 3.4));
      usedRooms.add(room.id);
    }
    for (const chair of state.props.filter((p) => p.kind === PropKind.Cradle)) {
      add(piece(SetPieceKind.RockingChair, d.rooms[chair.roomId], chair, chair.yaw, 5.5));
    }
  } else {
    const desks = d.rng.shuffle(state.props.filter((p) => p.kind === PropKind.Desk && !usedRooms.has(p.roomId)));
    for (const desk of desks.slice(0, Math.max(1, Math.ceil(wings.length / 2)))) {
      add(piece(SetPieceKind.Radio, d.rooms[desk.roomId], { x: desk.x + 0.35, z: desk.z }, desk.yaw, 5, desk.h + 0.02));
    }
  }
  return pieces;
};

/** Props that a set piece animates itself, so the static furniture view must skip them. */
export const animatedProps = (pieces: SetPiece[], props: PropSpawn[]): Set<number> => {
  const ids = new Set<number>();
  for (const p of pieces) {
    if (p.kind !== SetPieceKind.RockingChair) continue;
    const chair = props.find((q) => q.kind === PropKind.Cradle && q.x === p.x && q.z === p.z);
    if (chair) ids.add(chair.id);
  }
  return ids;
};
