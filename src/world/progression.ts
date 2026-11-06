import { DoorKind, EdgeKind, KeyColor, RoomKind, Theme } from "@/types/world";
import type { CellRect, Door, Room, Wing } from "@/types/world";
import { WING_CELLS_MAX, WING_CELLS_MIN, WING_LAYOUTS } from "@/world/constants";
import { addDoor, cellAt, inBounds, roomAt } from "@/world/draft";
import type { CellPair, Draft } from "@/world/draft";

export interface WingGrid {
  cols: number;
  rows: number;
  colWidths: number[];
  rowHeights: number[];
  width: number;
  height: number;
  rects: CellRect[];
}

/** Lays wings out on a cols×rows grid with a one-cell void border around the building. */
export const planWingGrid = (d: Pick<Draft, "rng">, players: number, theme: Theme): WingGrid => {
  const layout = WING_LAYOUTS.find((l) => players <= l.maxPlayers) ?? WING_LAYOUTS[WING_LAYOUTS.length - 1];
  const min = theme === Theme.Haveli ? WING_CELLS_MIN + 1 : WING_CELLS_MIN;
  const size = (): number => d.rng.int(min, WING_CELLS_MAX);
  const colWidths = Array.from({ length: layout.cols }, size);
  const rowHeights = Array.from({ length: layout.rows }, size);
  const rects: CellRect[] = [];
  let y = 1;
  for (let r = 0; r < layout.rows; r += 1) {
    let x = 1;
    for (let c = 0; c < layout.cols; c += 1) {
      rects.push({ x, y, w: colWidths[c], h: rowHeights[r] });
      x += colWidths[c];
    }
    y += rowHeights[r];
  }
  return {
    cols: layout.cols,
    rows: layout.rows,
    colWidths,
    rowHeights,
    width: colWidths.reduce((a, b) => a + b, 0) + 2,
    height: rowHeights.reduce((a, b) => a + b, 0) + 2,
    rects,
  };
};

const LOCK_ORDER: KeyColor[] = [KeyColor.Red, KeyColor.Blue, KeyColor.Green, KeyColor.Yellow, KeyColor.Purple];

/** Breadth-first unlock order: each wing opens from a neighbour that is already open. */
export const buildWingTree = (d: Pick<Draft, "rng">, grid: WingGrid): Wing[] => {
  const corners = [0, grid.cols - 1, (grid.rows - 1) * grid.cols, grid.rows * grid.cols - 1];
  const start = d.rng.pick(corners);
  const wings: Wing[] = grid.rects.map((rect, id) => ({ id, rect, parent: -1, lock: null, depth: -1 }));
  wings[start].depth = 0;
  const queue = [start];
  let colour = 0;
  while (queue.length > 0) {
    const id = queue.shift() as number;
    const col = id % grid.cols;
    const row = Math.floor(id / grid.cols);
    const next: number[] = [];
    if (col > 0) next.push(id - 1);
    if (col < grid.cols - 1) next.push(id + 1);
    if (row > 0) next.push(id - grid.cols);
    if (row < grid.rows - 1) next.push(id + grid.cols);
    for (const n of d.rng.shuffle(next)) {
      if (wings[n].depth >= 0) continue;
      wings[n].depth = wings[id].depth + 1;
      wings[n].parent = id;
      wings[n].lock = LOCK_ORDER[colour];
      colour += 1;
      queue.push(n);
    }
  }
  return wings;
};

const wingOfCell = (d: Draft, x: number, y: number): number => {
  const room = roomAt(d, x, y);
  return room >= 0 ? d.rooms[room].wing : -1;
};

const pairsBetweenWings = (d: Draft, a: Wing, b: Wing): CellPair[] => {
  const pairs: CellPair[] = [];
  for (let y = a.rect.y; y < a.rect.y + a.rect.h; y += 1) {
    for (let x = a.rect.x; x < a.rect.x + a.rect.w; x += 1) {
      const steps: Array<[number, number]> = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ];
      for (const [dx, dy] of steps) {
        if (wingOfCell(d, x + dx, y + dy) === b.id) pairs.push({ ax: x, ay: y, bx: x + dx, by: y + dy });
      }
    }
  }
  return pairs;
};

const passageScore = (d: Draft, p: CellPair): number => {
  const ka = d.rooms[roomAt(d, p.ax, p.ay)].kind;
  const kb = d.rooms[roomAt(d, p.bx, p.by)].kind;
  const score = (k: RoomKind): number => (k === RoomKind.Corridor ? 2 : k === RoomKind.Courtyard ? 0 : 1);
  return score(ka) + score(kb);
};

/** Puts locked gates between wings. Returns the gate doors per wing that they lead into. */
export const placeWingGates = (d: Draft, wings: Wing[], gateKind: DoorKind): Map<number, Door[]> => {
  const gates = new Map<number, Door[]>();
  for (const child of wings) {
    for (const other of wings) {
      if (other.id >= child.id) continue;
      const pairs = pairsBetweenWings(d, child, other);
      if (pairs.length === 0) continue;
      const tree = child.parent === other.id || other.parent === child.id;
      if (!tree && !d.rng.chance(0.6)) continue;
      const deeper = child.depth >= other.depth ? child : other;
      const best = Math.max(...pairs.map((p) => passageScore(d, p)));
      const candidates = d.rng.shuffle(pairs.filter((p) => passageScore(d, p) === best));
      const count = tree && pairs.length >= 9 && d.rng.chance(0.5) ? 2 : 1;
      const chosen: CellPair[] = [];
      for (const p of candidates) {
        if (chosen.length >= count) break;
        if (chosen.some((c) => Math.abs(c.ax - p.ax) + Math.abs(c.ay - p.ay) < 4)) continue;
        chosen.push(p);
      }
      for (const p of chosen) {
        const door = addDoor(d, p, gateKind, deeper.lock, false);
        gates.set(deeper.id, [...(gates.get(deeper.id) ?? []), door]);
      }
    }
  }
  return gates;
};

/** Distance in cells from `sources` to every cell of the given wing, walking through open edges and doors. */
export const cellDistances = (d: Draft, sources: Array<[number, number]>, allowedWings: Set<number>): Int32Array => {
  const dist = new Int32Array(d.width * d.height).fill(-1);
  const queue: number[] = [];
  for (const [x, y] of sources) {
    if (!inBounds(d, x, y) || !allowedWings.has(wingOfCell(d, x, y))) continue;
    const i = cellAt(d, x, y);
    if (dist[i] === 0) continue;
    dist[i] = 0;
    queue.push(i);
  }
  let head = 0;
  while (head < queue.length) {
    const i = queue[head];
    head += 1;
    const x = i % d.width;
    const y = Math.floor(i / d.width);
    const tryStep = (nx: number, ny: number, edge: EdgeKind): void => {
      if (!inBounds(d, nx, ny) || edge === EdgeKind.Wall) return;
      if (!allowedWings.has(wingOfCell(d, nx, ny))) return;
      const ni = cellAt(d, nx, ny);
      if (dist[ni] >= 0) return;
      dist[ni] = dist[i] + 1;
      queue.push(ni);
    };
    if (x + 1 < d.width) tryStep(x + 1, y, d.edgeX[i] as EdgeKind);
    if (x > 0) tryStep(x - 1, y, d.edgeX[cellAt(d, x - 1, y)] as EdgeKind);
    if (y + 1 < d.height) tryStep(x, y + 1, d.edgeY[i] as EdgeKind);
    if (y > 0) tryStep(x, y - 1, d.edgeY[cellAt(d, x, y - 1)] as EdgeKind);
  }
  return dist;
};

const roomDistance = (d: Draft, room: Room, dist: Int32Array): number => {
  let best = Number.POSITIVE_INFINITY;
  for (let y = room.rect.y; y < room.rect.y + room.rect.h; y += 1) {
    for (let x = room.rect.x; x < room.rect.x + room.rect.w; x += 1) {
      const v = dist[cellAt(d, x, y)];
      if (v >= 0) best = Math.min(best, v);
    }
  }
  return best;
};

const isLivingRoom = (room: Room): boolean => room.kind !== RoomKind.Corridor && room.kind !== RoomKind.Courtyard;

/** Rooms of a wing ordered from farthest to nearest relative to `sources`. */
export const roomsByDistance = (d: Draft, wing: number, sources: Array<[number, number]>): Room[] => {
  const dist = cellDistances(d, sources, new Set([wing]));
  return d.rooms
    .filter((r) => r.wing === wing && isLivingRoom(r))
    .map((r) => ({ r, v: roomDistance(d, r, dist) }))
    .filter((e) => Number.isFinite(e.v))
    .sort((a, b) => b.v - a.v)
    .map((e) => e.r);
};

const gateSideCell = (d: Draft, door: Door, wing: number): [number, number] => {
  const bx = door.vertical ? door.cx + 1 : door.cx;
  const by = door.vertical ? door.cy : door.cy + 1;
  return wingOfCell(d, door.cx, door.cy) === wing ? [door.cx, door.cy] : [bx, by];
};

/** For each locked wing, the room in its parent wing that hides the key: as far from the gate as possible. */
export const chooseKeyRooms = (d: Draft, wings: Wing[], gates: Map<number, Door[]>): Map<KeyColor, Room> => {
  const keyRooms = new Map<KeyColor, Room>();
  for (const wing of wings) {
    if (wing.lock === null || wing.parent < 0) continue;
    const sources = (gates.get(wing.id) ?? [])
      .filter((g) => g.lock === wing.lock)
      .map((g) => gateSideCell(d, g, wing.parent));
    const ranked = roomsByDistance(d, wing.parent, sources);
    const used = new Set([...keyRooms.values()].map((r) => r.id));
    const options = ranked.filter((r) => !used.has(r.id)).slice(0, 3);
    if (options.length > 0) keyRooms.set(wing.lock, d.rng.pick(options));
  }
  return keyRooms;
};

const exteriorPairs = (d: Draft, wing: Wing): CellPair[] => {
  const pairs: CellPair[] = [];
  const { x, y, w, h } = wing.rect;
  for (let cy = y; cy < y + h; cy += 1) {
    for (let cx = x; cx < x + w; cx += 1) {
      const steps: Array<[number, number]> = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ];
      for (const [dx, dy] of steps) {
        if (inBounds(d, cx + dx, cy + dy) && roomAt(d, cx + dx, cy + dy) === -1) {
          pairs.push({ ax: cx, ay: cy, bx: cx + dx, by: cy + dy });
        }
      }
    }
  }
  return pairs;
};

/** The deepest wing gets the main gate on its outside wall, far from where you came in. */
export const placeExit = (d: Draft, wings: Wing[], gates: Map<number, Door[]>): Door => {
  const startCenter = wings.find((w) => w.parent < 0)?.rect ?? wings[0].rect;
  const deepest = [...wings].sort((a, b) => {
    if (b.depth !== a.depth) return b.depth - a.depth;
    const da = Math.abs(a.rect.x - startCenter.x) + Math.abs(a.rect.y - startCenter.y);
    const db = Math.abs(b.rect.x - startCenter.x) + Math.abs(b.rect.y - startCenter.y);
    return db - da;
  })[0];
  const sources = (gates.get(deepest.id) ?? []).map((g) => gateSideCell(d, g, deepest.id));
  const dist = cellDistances(d, sources, new Set([deepest.id]));
  const pairs = exteriorPairs(d, deepest).filter((p) => d.rooms[roomAt(d, p.ax, p.ay)].kind !== RoomKind.Courtyard);
  const scored = pairs
    .map((p) => {
      const kind = d.rooms[roomAt(d, p.ax, p.ay)].kind;
      return { p, v: dist[cellAt(d, p.ax, p.ay)] + (kind === RoomKind.Corridor ? 3 : 0) };
    })
    .sort((a, b) => b.v - a.v);
  const top = scored.slice(0, 3).map((s) => s.p);
  return addDoor(d, d.rng.pick(top), DoorKind.MainGate, null, false);
};

/** Where the squad wakes up: a passage cell of the start wing on the outside wall (the way in, now jammed). */
export const chooseStartCell = (d: Draft, wings: Wing[], theme: Theme): [number, number] => {
  const start = wings.find((w) => w.parent < 0) ?? wings[0];
  if (theme === Theme.Haveli) {
    const court = d.rooms.find((r) => r.wing === start.id && r.kind === RoomKind.Courtyard);
    if (court) return [court.rect.x + Math.floor(court.rect.w / 2), court.rect.y + Math.floor(court.rect.h / 2)];
  }
  const pairs = exteriorPairs(d, start).filter((p) => d.rooms[roomAt(d, p.ax, p.ay)].kind === RoomKind.Corridor);
  if (pairs.length > 0) {
    const p = d.rng.pick(pairs);
    return [p.ax, p.ay];
  }
  const corridor = d.rooms.find((r) => r.wing === start.id && r.kind === RoomKind.Corridor) ?? d.rooms[0];
  return [corridor.rect.x, corridor.rect.y];
};
