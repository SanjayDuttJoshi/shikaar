import { EdgeKind, FurnishSpot, ItemKind, LightKind, PropKind, RoomKind, Theme } from "@/types/world";
import type { HideSpot, ItemSpawn, KeyColor, LightSpawn, PropSpawn, Room, Vec2 } from "@/types/world";
import { CELL, DOOR_CLEARANCE, WALL_HEIGHT, WALL_THICKNESS } from "@/world/constants";
import { cellAt, roomAt } from "@/world/draft";
import type { Draft } from "@/world/draft";
import { boxInside, boxesOverlap, distanceToBox, doorCenter, footprint, roomInterior } from "@/world/geometry";
import type { Box } from "@/world/geometry";
import { ASYLUM_CORRIDOR_CLUTTER, HAVELI_CORRIDOR_CLUTTER, PROP_SPECS, ROOM_FURNITURE } from "@/world/prop-specs";

enum Side {
  North = 0,
  South = 1,
  West = 2,
  East = 3,
}

const SIDE_YAW: Record<Side, number> = {
  [Side.North]: 0,
  [Side.South]: Math.PI,
  [Side.West]: Math.PI / 2,
  [Side.East]: -Math.PI / 2,
};

export interface FurnishState {
  props: PropSpawn[];
  /** Points that must stay clear (doorways and open passages) per room. */
  clearPoints: Map<number, Vec2[]>;
}

/** Edge kind between a room cell and the cell across the given side. */
const sideEdge = (d: Draft, x: number, y: number, side: Side): EdgeKind => {
  switch (side) {
    case Side.North:
      return d.edgeY[cellAt(d, x, y - 1)] as EdgeKind;
    case Side.South:
      return d.edgeY[cellAt(d, x, y)] as EdgeKind;
    case Side.West:
      return d.edgeX[cellAt(d, x - 1, y)] as EdgeKind;
    default:
      return d.edgeX[cellAt(d, x, y)] as EdgeKind;
  }
};

/** Collects doorway centres and open-edge midpoints on a room's boundary. */
export const collectClearPoints = (d: Draft): Map<number, Vec2[]> => {
  const map = new Map<number, Vec2[]>();
  const add = (room: number, p: Vec2): void => {
    if (room < 0) return;
    map.set(room, [...(map.get(room) ?? []), p]);
  };
  for (const door of d.doors) {
    const c = doorCenter(door);
    add(roomAt(d, door.cx, door.cy), c);
    add(door.vertical ? roomAt(d, door.cx + 1, door.cy) : roomAt(d, door.cx, door.cy + 1), c);
  }
  for (let y = 0; y < d.height; y += 1) {
    for (let x = 0; x < d.width; x += 1) {
      const here = roomAt(d, x, y);
      if (here < 0) continue;
      const right = roomAt(d, x + 1, y);
      if (right >= 0 && right !== here && d.edgeX[cellAt(d, x, y)] === EdgeKind.Open) {
        const p = { x: (x + 1) * CELL, z: (y + 0.5) * CELL };
        add(here, p);
        add(right, p);
      }
      const down = roomAt(d, x, y + 1);
      if (down >= 0 && down !== here && d.edgeY[cellAt(d, x, y)] === EdgeKind.Open) {
        const p = { x: (x + 0.5) * CELL, z: (y + 1) * CELL };
        add(here, p);
        add(down, p);
      }
    }
  }
  return map;
};

/** True when every cell edge the box runs along on `side` is solid wall (no door, no opening). */
const wallBehindIsSolid = (d: Draft, room: Room, side: Side, box: Box): boolean => {
  const { x, y, w, h } = room.rect;
  const along = side === Side.North || side === Side.South;
  const from = along ? Math.floor(box.minX / CELL) : Math.floor(box.minZ / CELL);
  const to = along ? Math.floor((box.maxX - 0.001) / CELL) : Math.floor((box.maxZ - 0.001) / CELL);
  for (let c = from; c <= to; c += 1) {
    const cx = along ? c : side === Side.West ? x : x + w - 1;
    const cy = along ? (side === Side.North ? y : y + h - 1) : c;
    if (sideEdge(d, cx, cy, side) !== EdgeKind.Wall) return false;
  }
  return true;
};

const fits = (state: FurnishState, room: Room, box: Box, ignoreClearance = false): boolean => {
  if (!boxInside(box, roomInterior(room.rect, 0.02))) return false;
  if (state.props.some((p) => p.roomId === room.id && p.kind !== PropKind.Rug && boxesOverlap(box, footprint(p.x, p.z, p.w, p.d, p.yaw), 0.12))) {
    return false;
  }
  if (ignoreClearance) return true;
  return (state.clearPoints.get(room.id) ?? []).every((c) => distanceToBox(c, box) >= DOOR_CLEARANCE);
};

const pushProp = (state: FurnishState, room: Room, kind: PropKind, x: number, z: number, yaw: number): PropSpawn => {
  const spec = PROP_SPECS[kind];
  const prop: PropSpawn = {
    id: state.props.length,
    kind,
    roomId: room.id,
    x,
    z,
    yaw,
    w: spec.w,
    d: spec.d,
    h: spec.h,
    solid: spec.solid,
    blocksSight: spec.blocksSight,
  };
  state.props.push(prop);
  return prop;
};

/** Tries to stand a prop with its back against one of the room's solid walls. */
export const placeAgainstWall = (
  d: Draft,
  state: FurnishState,
  room: Room,
  kind: PropKind,
  attempts = 14,
  prefer?: Vec2,
): PropSpawn | null => {
  const spec = PROP_SPECS[kind];
  const inner = roomInterior(room.rect);
  for (let i = 0; i < attempts; i += 1) {
    const side = d.rng.int(0, 3) as Side;
    const yaw = SIDE_YAW[side];
    const along = side === Side.North || side === Side.South;
    const half = spec.w / 2;
    const lo = (along ? inner.minX : inner.minZ) + half + 0.05;
    const hi = (along ? inner.maxX : inner.maxZ) - half - 0.05;
    if (hi < lo) continue;
    let t = d.rng.range(lo, hi);
    if (prefer && i < attempts / 2) t = Math.min(hi, Math.max(lo, (along ? prefer.x : prefer.z) + d.rng.range(-2.5, 2.5)));
    const offset = spec.d / 2 + 0.03;
    const px = along ? t : side === Side.West ? inner.minX + offset : inner.maxX - offset;
    const pz = along ? (side === Side.North ? inner.minZ + offset : inner.maxZ - offset) : t;
    const box = footprint(px, pz, spec.w, spec.d, yaw);
    if (!fits(state, room, box) || !wallBehindIsSolid(d, room, side, box)) continue;
    return pushProp(state, room, kind, px, pz, yaw);
  }
  return null;
};

const placeInCenter = (d: Draft, state: FurnishState, room: Room, kind: PropKind): PropSpawn | null => {
  const spec = PROP_SPECS[kind];
  const inner = roomInterior(room.rect);
  const cx = (inner.minX + inner.maxX) / 2;
  const cz = (inner.minZ + inner.maxZ) / 2;
  const yaw = inner.maxX - inner.minX > inner.maxZ - inner.minZ ? Math.PI / 2 : 0;
  for (let i = 0; i < 6; i += 1) {
    const x = cx + d.rng.range(-0.6, 0.6);
    const z = cz + d.rng.range(-0.6, 0.6);
    const box = footprint(x, z, spec.w, spec.d, yaw);
    if (kind === PropKind.Rug ? boxInside(box, inner) : fits(state, room, box)) return pushProp(state, room, kind, x, z, yaw);
  }
  return null;
};

const themedKind = (theme: Theme, kind: PropKind): PropKind => {
  if (theme === Theme.Haveli && kind === PropKind.HospitalBed) return PropKind.Charpai;
  if (theme === Theme.Haveli && kind === PropKind.MetalLocker) return PropKind.Wardrobe;
  return kind;
};

export const furnishRooms = (d: Draft, theme: Theme, state: FurnishState): void => {
  for (const room of d.rooms) {
    if (room.kind === RoomKind.Corridor) {
      if (!d.rng.chance(0.35)) continue;
      const clutter = theme === Theme.Asylum ? ASYLUM_CORRIDOR_CLUTTER : HAVELI_CORRIDOR_CLUTTER;
      placeAgainstWall(d, state, room, d.rng.pick(clutter), 6);
      continue;
    }
    for (const entry of ROOM_FURNITURE[room.kind]) {
      const count = d.rng.int(entry.min, entry.max);
      for (let i = 0; i < count; i += 1) {
        const kind = themedKind(theme, entry.kind);
        if (entry.where === FurnishSpot.Center) placeInCenter(d, state, room, kind);
        else placeAgainstWall(d, state, room, kind);
      }
    }
  }
};

/** Pillars at every corner along the courtyard edge (the verandah's arches rest on them). */
export const placeCourtyardPillars = (d: Draft, state: FurnishState): void => {
  for (const court of d.rooms.filter((r) => r.kind === RoomKind.Courtyard)) {
    const { x, y, w, h } = court.rect;
    const corners: Vec2[] = [];
    for (let i = 0; i <= w; i += 1) {
      corners.push({ x: (x + i) * CELL, z: y * CELL }, { x: (x + i) * CELL, z: (y + h) * CELL });
    }
    for (let j = 1; j < h; j += 1) {
      corners.push({ x: x * CELL, z: (y + j) * CELL }, { x: (x + w) * CELL, z: (y + j) * CELL });
    }
    for (const c of corners) pushProp(state, court, PropKind.Pillar, c.x, c.z, 0);
  }
};

/** A free floor point in the room that is clear of furniture and doorways. */
export const freeFloorPoint = (d: Draft, state: FurnishState, room: Room, radius = 0.45): Vec2 | null => {
  const inner = roomInterior(room.rect, radius);
  for (let i = 0; i < 40; i += 1) {
    const x = d.rng.range(inner.minX, inner.maxX);
    const z = d.rng.range(inner.minZ, inner.maxZ);
    const box = { minX: x - radius, minZ: z - radius, maxX: x + radius, maxZ: z + radius };
    const blocked = state.props.some(
      (p) => p.roomId === room.id && p.kind !== PropKind.Rug && boxesOverlap(box, footprint(p.x, p.z, p.w, p.d, p.yaw)),
    );
    if (!blocked) return { x, z };
  }
  return null;
};

export const placeItem = (
  d: Draft,
  state: FurnishState,
  items: ItemSpawn[],
  room: Room,
  kind: ItemKind,
  color: KeyColor | null,
  note = -1,
): ItemSpawn | null => {
  const taken = (x: number, z: number): boolean => items.some((it) => Math.hypot(it.x - x, it.z - z) < 0.6);
  const surfaces = d.rng.shuffle(state.props.filter((p) => p.roomId === room.id && PROP_SPECS[p.kind].surface));
  for (const s of surfaces) {
    const x = s.x + d.rng.range(-0.15, 0.15);
    const z = s.z + d.rng.range(-0.15, 0.15);
    if (taken(x, z)) continue;
    const item: ItemSpawn = { id: items.length, kind, x, z, y: s.h + 0.02, color, roomId: room.id, note };
    items.push(item);
    return item;
  }
  for (let i = 0; i < 6; i += 1) {
    const p = freeFloorPoint(d, state, room, 0.35);
    if (!p || taken(p.x, p.z)) continue;
    const item: ItemSpawn = { id: items.length, kind, x: p.x, z: p.z, y: 0.02, color, roomId: room.id, note };
    items.push(item);
    return item;
  }
  return null;
};

export const hideSpotsFrom = (props: PropSpawn[]): HideSpot[] =>
  props
    .filter((p) => PROP_SPECS[p.kind].hide !== null)
    .map((p, i) => ({ id: i, kind: PROP_SPECS[p.kind].hide as HideSpot["kind"], propId: p.id, x: p.x, z: p.z, yaw: p.yaw }));

/** Ceiling tubes in the asylum, wall lanterns and diyas in the haveli, moonlight over courtyards. Many are dead. */
export const placeLights = (d: Draft, theme: Theme, state: FurnishState): LightSpawn[] => {
  const lights: LightSpawn[] = [];
  const add = (room: Room, kind: LightKind, x: number, z: number, y: number): void => {
    const dead = kind !== LightKind.Moon && d.rng.chance(theme === Theme.Asylum ? 0.42 : 0.4);
    const flicker = dead ? 0 : kind === LightKind.Moon ? 1 : d.rng.chance(0.4) ? d.rng.range(0.25, 0.8) : 1;
    lights.push({ id: lights.length, kind, x, z, y, flicker, dead, roomId: room.id });
  };
  for (const room of d.rooms) {
    const inner = roomInterior(room.rect);
    const cx = (inner.minX + inner.maxX) / 2;
    const cz = (inner.minZ + inner.maxZ) / 2;
    if (room.kind === RoomKind.Courtyard) {
      add(room, LightKind.Moon, cx, cz, WALL_HEIGHT + 9);
      continue;
    }
    if (theme === Theme.Asylum) {
      if (room.kind === RoomKind.Corridor && room.id % 2 === 1) continue;
      const long = room.rect.w * room.rect.h >= 6;
      if (long) {
        const alongX = room.rect.w >= room.rect.h;
        const off = (alongX ? inner.maxX - inner.minX : inner.maxZ - inner.minZ) / 4;
        add(room, LightKind.TubeLight, alongX ? cx - off : cx, alongX ? cz : cz - off, WALL_HEIGHT - 0.12);
        add(room, LightKind.TubeLight, alongX ? cx + off : cx, alongX ? cz : cz + off, WALL_HEIGHT - 0.12);
      } else {
        add(room, room.kind === RoomKind.Cell ? LightKind.Bulb : LightKind.TubeLight, cx, cz, WALL_HEIGHT - 0.12);
      }
      continue;
    }
    if (room.kind === RoomKind.Puja) {
      add(room, LightKind.Diya, cx - 0.5, inner.minZ + 0.3, 0.75);
      add(room, LightKind.Diya, cx + 0.5, inner.minZ + 0.3, 0.75);
      continue;
    }
    if (room.kind === RoomKind.Corridor && room.id % 2 === 0) continue;
    const lantern = placeAgainstWall(d, state, room, PropKind.Lantern, 8);
    if (lantern) {
      const back = WALL_THICKNESS;
      add(room, LightKind.Lantern, lantern.x - Math.sin(lantern.yaw) * back, lantern.z - Math.cos(lantern.yaw) * back, 2.1);
    } else {
      add(room, LightKind.Bulb, cx, cz, WALL_HEIGHT - 0.4);
    }
  }
  return lights;
};
