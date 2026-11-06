import { EdgeKind, KeyColor } from "@/types/world";
import type { Door, Level } from "@/types/world";
import { CELL } from "@/world/constants";

export const levelCell = (level: Pick<Level, "width">, x: number, y: number): number => y * level.width + x;

export const cellOfPoint = (x: number, z: number): [number, number] => [Math.floor(x / CELL), Math.floor(z / CELL)];

export const roomIdAt = (level: Pick<Level, "width" | "height" | "roomOf">, x: number, y: number): number =>
  x >= 0 && y >= 0 && x < level.width && y < level.height ? level.roomOf[y * level.width + x] : -1;

export const doorBetween = (level: Level, ax: number, ay: number, bx: number, by: number): Door | null => {
  if (ay === by) {
    const id = level.doorX[levelCell(level, Math.min(ax, bx), ay)];
    return id >= 0 ? level.doors[id] : null;
  }
  const id = level.doorY[levelCell(level, ax, Math.min(ay, by))];
  return id >= 0 ? level.doors[id] : null;
};

export const edgeBetween = (level: Level, ax: number, ay: number, bx: number, by: number): EdgeKind => {
  if (ay === by) return level.edgeX[levelCell(level, Math.min(ax, bx), ay)] as EdgeKind;
  return level.edgeY[levelCell(level, ax, Math.min(ay, by))] as EdgeKind;
};

/**
 * Cells reachable from (sx,sy) through open edges and doors that are unlocked for `keys`.
 * The main gate counts as closed (it is the goal, not a path).
 */
export const reachableCells = (level: Level, sx: number, sy: number, keys: ReadonlySet<KeyColor>): Uint8Array => {
  const seen = new Uint8Array(level.width * level.height);
  const queue = [levelCell(level, sx, sy)];
  seen[queue[0]] = 1;
  let head = 0;
  while (head < queue.length) {
    const i = queue[head];
    head += 1;
    const x = i % level.width;
    const y = Math.floor(i / level.width);
    const neighbours: Array<[number, number]> = [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ];
    for (const [nx, ny] of neighbours) {
      if (roomIdAt(level, nx, ny) < 0) continue;
      const edge = edgeBetween(level, x, y, nx, ny);
      if (edge === EdgeKind.Wall) continue;
      if (edge === EdgeKind.Door) {
        const door = doorBetween(level, x, y, nx, ny);
        if (door && door.lock !== null && !keys.has(door.lock)) continue;
      }
      const ni = levelCell(level, nx, ny);
      if (seen[ni]) continue;
      seen[ni] = 1;
      queue.push(ni);
    }
  }
  return seen;
};

export const KEY_COLORS: KeyColor[] = [KeyColor.Red, KeyColor.Blue, KeyColor.Green, KeyColor.Yellow, KeyColor.Purple];
