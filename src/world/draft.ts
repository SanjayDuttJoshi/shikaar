import { CellKind, DoorKind, EdgeKind, RoomKind } from "@/types/world";
import type { CellRect, Door, KeyColor, Room } from "@/types/world";
import type { Rng } from "@/world/rng";

/** Mutable working copy of the grid while the generator lays out a building. */
export interface Draft {
  width: number;
  height: number;
  roomOf: Int16Array;
  kindOf: Uint8Array;
  edgeX: Uint8Array;
  edgeY: Uint8Array;
  doorX: Int16Array;
  doorY: Int16Array;
  rooms: Room[];
  doors: Door[];
  rng: Rng;
}

export interface CellPair {
  ax: number;
  ay: number;
  bx: number;
  by: number;
}

export const createDraft = (width: number, height: number, rng: Rng): Draft => {
  const size = width * height;
  return {
    width,
    height,
    roomOf: new Int16Array(size).fill(-1),
    kindOf: new Uint8Array(size),
    edgeX: new Uint8Array(size),
    edgeY: new Uint8Array(size),
    doorX: new Int16Array(size).fill(-1),
    doorY: new Int16Array(size).fill(-1),
    rooms: [],
    doors: [],
    rng,
  };
};

export const inBounds = (d: { width: number; height: number }, x: number, y: number): boolean =>
  x >= 0 && y >= 0 && x < d.width && y < d.height;

export const cellAt = (d: { width: number }, x: number, y: number): number => y * d.width + x;

export const roomAt = (d: Pick<Draft, "width" | "height" | "roomOf">, x: number, y: number): number =>
  inBounds(d, x, y) ? d.roomOf[cellAt(d, x, y)] : -1;

const CELL_KIND_FOR: Record<RoomKind, CellKind> = {
  [RoomKind.Corridor]: CellKind.Corridor,
  [RoomKind.Courtyard]: CellKind.Courtyard,
  [RoomKind.Ward]: CellKind.Room,
  [RoomKind.Cell]: CellKind.Room,
  [RoomKind.Office]: CellKind.Room,
  [RoomKind.Bathroom]: CellKind.Room,
  [RoomKind.Theatre]: CellKind.Room,
  [RoomKind.Storage]: CellKind.Room,
  [RoomKind.LockerRoom]: CellKind.Room,
  [RoomKind.Baithak]: CellKind.Room,
  [RoomKind.Bedroom]: CellKind.Room,
  [RoomKind.Kitchen]: CellKind.Room,
  [RoomKind.Puja]: CellKind.Room,
  [RoomKind.Store]: CellKind.Room,
};

export const addRoom = (d: Draft, kind: RoomKind, rect: CellRect, wing: number): Room => {
  const room: Room = { id: d.rooms.length, kind, rect: { ...rect }, wing };
  d.rooms.push(room);
  for (let y = rect.y; y < rect.y + rect.h; y += 1) {
    for (let x = rect.x; x < rect.x + rect.w; x += 1) {
      const i = cellAt(d, x, y);
      d.roomOf[i] = room.id;
      d.kindOf[i] = CELL_KIND_FOR[kind];
    }
  }
  return room;
};

/** Normalises a pair of neighbouring cells to the edge-array slot that stores them. */
export const edgeSlot = (d: Draft, p: CellPair): { vertical: boolean; index: number; cx: number; cy: number } => {
  if (p.ay === p.by) {
    const cx = Math.min(p.ax, p.bx);
    return { vertical: true, index: cellAt(d, cx, p.ay), cx, cy: p.ay };
  }
  const cy = Math.min(p.ay, p.by);
  return { vertical: false, index: cellAt(d, p.ax, cy), cx: p.ax, cy };
};

export const setEdge = (d: Draft, p: CellPair, kind: EdgeKind): void => {
  const slot = edgeSlot(d, p);
  (slot.vertical ? d.edgeX : d.edgeY)[slot.index] = kind;
};

export const getEdge = (d: Draft, p: CellPair): EdgeKind => {
  const slot = edgeSlot(d, p);
  return (slot.vertical ? d.edgeX : d.edgeY)[slot.index] as EdgeKind;
};

export const doorOnEdge = (d: Draft, p: CellPair): number => {
  const slot = edgeSlot(d, p);
  return (slot.vertical ? d.doorX : d.doorY)[slot.index];
};

export const addDoor = (
  d: Draft,
  p: CellPair,
  kind: DoorKind,
  lock: KeyColor | null,
  startsOpen: boolean,
): Door => {
  const slot = edgeSlot(d, p);
  const existing = (slot.vertical ? d.doorX : d.doorY)[slot.index];
  if (existing >= 0) {
    const door = d.doors[existing];
    door.kind = kind === DoorKind.MainGate ? kind : door.kind;
    door.lock = lock ?? door.lock;
    return door;
  }
  const door: Door = { id: d.doors.length, cx: slot.cx, cy: slot.cy, vertical: slot.vertical, kind, lock, startsOpen };
  d.doors.push(door);
  (slot.vertical ? d.doorX : d.doorY)[slot.index] = door.id;
  (slot.vertical ? d.edgeX : d.edgeY)[slot.index] = EdgeKind.Door;
  return door;
};

/** Every neighbouring cell pair along the boundary of `room` whose other side satisfies `accept`. */
export const boundaryPairs = (d: Draft, room: Room, accept: (otherRoom: number) => boolean): CellPair[] => {
  const pairs: CellPair[] = [];
  const { x, y, w, h } = room.rect;
  for (let cy = y; cy < y + h; cy += 1) {
    for (let cx = x; cx < x + w; cx += 1) {
      const steps: Array<[number, number]> = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ];
      for (const [dx, dy] of steps) {
        const nx = cx + dx;
        const ny = cy + dy;
        const other = roomAt(d, nx, ny);
        if (other === room.id) continue;
        if (accept(other)) pairs.push({ ax: cx, ay: cy, bx: nx, by: ny });
      }
    }
  }
  return pairs;
};

/** Starts every edge as a wall between different rooms, open inside a room. */
export const initEdges = (d: Draft): void => {
  for (let y = 0; y < d.height; y += 1) {
    for (let x = 0; x < d.width; x += 1) {
      const here = roomAt(d, x, y);
      const right = roomAt(d, x + 1, y);
      const down = roomAt(d, x, y + 1);
      const i = cellAt(d, x, y);
      d.edgeX[i] = here === right ? EdgeKind.Open : EdgeKind.Wall;
      d.edgeY[i] = here === down ? EdgeKind.Open : EdgeKind.Wall;
    }
  }
};

/** Union-find over room ids. */
export const createUnionFind = (size: number) => {
  const parent = Array.from({ length: size }, (_, i) => i);
  const find = (a: number): number => {
    let root = a;
    while (parent[root] !== root) root = parent[root];
    let node = a;
    while (parent[node] !== root) {
      const next = parent[node];
      parent[node] = root;
      node = next;
    }
    return root;
  };
  const union = (a: number, b: number): boolean => {
    const ra = find(a);
    const rb = find(b);
    if (ra === rb) return false;
    parent[ra] = rb;
    return true;
  };
  return { find, union };
};
