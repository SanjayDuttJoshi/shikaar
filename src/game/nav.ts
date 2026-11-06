import type { Vec2 } from "@/types/world";
import type { CollisionWorld } from "@/game/collision";
import { CELL, NAV_RES } from "@/world/constants";

/** Fine walkability grid for the monster's pathfinding (doors never block it). */
export interface NavGrid {
  w: number;
  h: number;
  blocked: Uint8Array;
}

const CLEARANCE = 0.32;

export const buildNavGrid = (world: CollisionWorld, inside: (x: number, z: number) => boolean): NavGrid => {
  const w = Math.round((world.width * CELL) / NAV_RES);
  const h = Math.round((world.height * CELL) / NAV_RES);
  const blocked = new Uint8Array(w * h);
  for (let j = 0; j < h; j += 1) {
    for (let i = 0; i < w; i += 1) {
      const x = (i + 0.5) * NAV_RES;
      const z = (j + 0.5) * NAV_RES;
      if (!inside(x, z)) {
        blocked[j * w + i] = 1;
        continue;
      }
      const bucket = world.buckets[Math.floor(z / CELL) * world.width + Math.floor(x / CELL)];
      for (const index of bucket) {
        const b = world.boxes[index];
        if (!b.solid || b.door >= 0) continue;
        const dx = Math.max(b.minX - x, 0, x - b.maxX);
        const dz = Math.max(b.minZ - z, 0, z - b.maxZ);
        if (Math.hypot(dx, dz) < CLEARANCE) {
          blocked[j * w + i] = 1;
          break;
        }
      }
    }
  }
  return { w, h, blocked };
};

export const navIndexOf = (nav: NavGrid, p: Vec2): number => {
  const i = Math.min(nav.w - 1, Math.max(0, Math.floor(p.x / NAV_RES)));
  const j = Math.min(nav.h - 1, Math.max(0, Math.floor(p.z / NAV_RES)));
  return j * nav.w + i;
};

const navPoint = (nav: NavGrid, index: number): Vec2 => ({
  x: ((index % nav.w) + 0.5) * NAV_RES,
  z: (Math.floor(index / nav.w) + 0.5) * NAV_RES,
});

/** Nearest walkable nav cell to a point (searches outward a few rings). */
export const nearestOpen = (nav: NavGrid, p: Vec2): number => {
  const start = navIndexOf(nav, p);
  if (!nav.blocked[start]) return start;
  const si = start % nav.w;
  const sj = Math.floor(start / nav.w);
  for (let r = 1; r < 8; r += 1) {
    let best = -1;
    let bestD = Number.POSITIVE_INFINITY;
    for (let dj = -r; dj <= r; dj += 1) {
      for (let di = -r; di <= r; di += 1) {
        if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
        const i = si + di;
        const j = sj + dj;
        if (i < 0 || j < 0 || i >= nav.w || j >= nav.h) continue;
        const idx = j * nav.w + i;
        if (nav.blocked[idx]) continue;
        const d = di * di + dj * dj;
        if (d < bestD) {
          bestD = d;
          best = idx;
        }
      }
    }
    if (best >= 0) return best;
  }
  return -1;
};

/** True when a straight walk between two points stays on open nav cells. */
export const walkable = (nav: NavGrid, a: Vec2, b: Vec2): boolean => {
  const length = Math.hypot(b.x - a.x, b.z - a.z);
  const steps = Math.max(1, Math.ceil(length / (NAV_RES * 0.5)));
  for (let s = 0; s <= steps; s += 1) {
    const t = s / steps;
    if (nav.blocked[navIndexOf(nav, { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t })]) return false;
  }
  return true;
};

class MinHeap {
  private items: number[] = [];
  private keys: number[] = [];

  get size(): number {
    return this.items.length;
  }

  push(item: number, key: number): void {
    this.items.push(item);
    this.keys.push(key);
    let i = this.items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.keys[parent] <= this.keys[i]) break;
      this.swap(i, parent);
      i = parent;
    }
  }

  pop(): number {
    const top = this.items[0];
    const lastItem = this.items.pop() as number;
    const lastKey = this.keys.pop() as number;
    if (this.items.length > 0) {
      this.items[0] = lastItem;
      this.keys[0] = lastKey;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < this.items.length && this.keys[l] < this.keys[m]) m = l;
        if (r < this.items.length && this.keys[r] < this.keys[m]) m = r;
        if (m === i) break;
        this.swap(i, m);
        i = m;
      }
    }
    return top;
  }

  private swap(a: number, b: number): void {
    [this.items[a], this.items[b]] = [this.items[b], this.items[a]];
    [this.keys[a], this.keys[b]] = [this.keys[b], this.keys[a]];
  }
}

const NEIGHBOURS: Array<[number, number, number]> = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, Math.SQRT2],
  [1, -1, Math.SQRT2],
  [-1, 1, Math.SQRT2],
  [-1, -1, Math.SQRT2],
];

/** A* over the nav grid, then string-pulled into a short list of waypoints. Empty if unreachable. */
export const findPath = (nav: NavGrid, from: Vec2, to: Vec2, maxNodes = 40000): Vec2[] => {
  const start = nearestOpen(nav, from);
  const goal = nearestOpen(nav, to);
  if (start < 0 || goal < 0) return [];
  if (start === goal) return [to];
  const gi = goal % nav.w;
  const gj = Math.floor(goal / nav.w);
  const g = new Float32Array(nav.w * nav.h).fill(Number.POSITIVE_INFINITY);
  const came = new Int32Array(nav.w * nav.h).fill(-1);
  const closed = new Uint8Array(nav.w * nav.h);
  const heap = new MinHeap();
  g[start] = 0;
  heap.push(start, 0);
  let expanded = 0;
  while (heap.size > 0 && expanded < maxNodes) {
    const cur = heap.pop();
    if (cur === goal) break;
    if (closed[cur]) continue;
    closed[cur] = 1;
    expanded += 1;
    const ci = cur % nav.w;
    const cj = Math.floor(cur / nav.w);
    for (const [di, dj, cost] of NEIGHBOURS) {
      const ni = ci + di;
      const nj = cj + dj;
      if (ni < 0 || nj < 0 || ni >= nav.w || nj >= nav.h) continue;
      const n = nj * nav.w + ni;
      if (nav.blocked[n] || closed[n]) continue;
      if (di !== 0 && dj !== 0 && (nav.blocked[cj * nav.w + ni] || nav.blocked[nj * nav.w + ci])) continue;
      const ng = g[cur] + cost;
      if (ng >= g[n]) continue;
      g[n] = ng;
      came[n] = cur;
      const hx = Math.abs(ni - gi);
      const hz = Math.abs(nj - gj);
      heap.push(n, ng + Math.max(hx, hz) + (Math.SQRT2 - 1) * Math.min(hx, hz));
    }
  }
  if (came[goal] < 0) return [];
  const raw: Vec2[] = [];
  for (let n = goal; n !== start && n >= 0; n = came[n]) raw.push(navPoint(nav, n));
  raw.reverse();
  if (!nav.blocked[navIndexOf(nav, to)]) raw[raw.length - 1] = to;
  const smooth: Vec2[] = [];
  let anchor = from;
  let i = 0;
  while (i < raw.length) {
    let j = raw.length - 1;
    while (j > i && !walkable(nav, anchor, raw[j])) j -= 1;
    smooth.push(raw[j]);
    anchor = raw[j];
    i = j + 1;
  }
  return smooth;
};

/** A random walkable point inside an axis-aligned area (for patrol goals). */
export const randomOpenPoint = (nav: NavGrid, minX: number, minZ: number, maxX: number, maxZ: number, rand: () => number): Vec2 | null => {
  for (let k = 0; k < 20; k += 1) {
    const p = { x: minX + rand() * (maxX - minX), z: minZ + rand() * (maxZ - minZ) };
    if (!nav.blocked[navIndexOf(nav, p)]) return p;
  }
  return null;
};
