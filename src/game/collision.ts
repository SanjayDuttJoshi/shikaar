import { DoorKind, EdgeKind, PropKind } from "@/types/world";
import type { Level, Vec2 } from "@/types/world";
import { CELL, DOOR_WIDTH, GATE_WIDTH, WALL_THICKNESS } from "@/world/constants";
import { footprint } from "@/world/geometry";
import type { Box } from "@/world/geometry";

export interface Collider extends Box {
  solid: boolean;
  sight: boolean;
  /** Door panel collider: only active while that door is closed. */
  door: number;
}

export interface CollisionWorld {
  boxes: Collider[];
  /** Box indices per CELL-sized bucket. */
  buckets: number[][];
  width: number;
  height: number;
}

const T = WALL_THICKNESS / 2;

/** Wall pieces for one cell edge; doors leave a gap and get a separate panel collider. */
const edgeBoxes = (vertical: boolean, cx: number, cy: number, gap: number): Box[] => {
  if (vertical) {
    const x = (cx + 1) * CELL;
    const z0 = cy * CELL - T;
    const z1 = (cy + 1) * CELL + T;
    if (gap <= 0) return [{ minX: x - T, maxX: x + T, minZ: z0, maxZ: z1 }];
    const mid = (cy + 0.5) * CELL;
    return [
      { minX: x - T, maxX: x + T, minZ: z0, maxZ: mid - gap / 2 },
      { minX: x - T, maxX: x + T, minZ: mid + gap / 2, maxZ: z1 },
    ];
  }
  const z = (cy + 1) * CELL;
  const x0 = cx * CELL - T;
  const x1 = (cx + 1) * CELL + T;
  if (gap <= 0) return [{ minX: x0, maxX: x1, minZ: z - T, maxZ: z + T }];
  const mid = (cx + 0.5) * CELL;
  return [
    { minX: x0, maxX: mid - gap / 2, minZ: z - T, maxZ: z + T },
    { minX: mid + gap / 2, maxX: x1, minZ: z - T, maxZ: z + T },
  ];
};

export const doorGap = (kind: DoorKind): number => (kind === DoorKind.MainGate ? GATE_WIDTH : DOOR_WIDTH);

/** Collider for the closed door leaf filling the doorway. */
export const doorPanelBox = (door: Level["doors"][number]): Box => {
  const gap = doorGap(door.kind);
  if (door.vertical) {
    const x = (door.cx + 1) * CELL;
    const mid = (door.cy + 0.5) * CELL;
    return { minX: x - T, maxX: x + T, minZ: mid - gap / 2, maxZ: mid + gap / 2 };
  }
  const z = (door.cy + 1) * CELL;
  const mid = (door.cx + 0.5) * CELL;
  return { minX: mid - gap / 2, maxX: mid + gap / 2, minZ: z - T, maxZ: z + T };
};

export const buildCollisionWorld = (level: Level): CollisionWorld => {
  const boxes: Collider[] = [];
  const add = (b: Box, solid: boolean, sight: boolean, door = -1): void => {
    boxes.push({ ...b, solid, sight, door });
  };
  for (let y = 0; y < level.height; y += 1) {
    for (let x = 0; x < level.width; x += 1) {
      const i = y * level.width + x;
      const ex = level.edgeX[i] as EdgeKind;
      const ey = level.edgeY[i] as EdgeKind;
      const hereInside = level.roomOf[i] >= 0;
      const rightInside = x + 1 < level.width && level.roomOf[i + 1] >= 0;
      const downInside = y + 1 < level.height && level.roomOf[i + level.width] >= 0;
      if ((hereInside || rightInside) && ex !== EdgeKind.Open) {
        const door = ex === EdgeKind.Door ? level.doors[level.doorX[i]] : null;
        for (const b of edgeBoxes(true, x, y, door ? doorGap(door.kind) : 0)) add(b, true, true);
      }
      if ((hereInside || downInside) && ey !== EdgeKind.Open) {
        const door = ey === EdgeKind.Door ? level.doors[level.doorY[i]] : null;
        for (const b of edgeBoxes(false, x, y, door ? doorGap(door.kind) : 0)) add(b, true, true);
      }
    }
  }
  for (const door of level.doors) add(doorPanelBox(door), true, true, door.id);
  for (const p of level.props) {
    if (!p.solid && !p.blocksSight) continue;
    const box = p.kind === PropKind.Pillar ? footprint(p.x, p.z, p.w, p.d, 0) : footprint(p.x, p.z, p.w, p.d, p.yaw);
    add(box, p.solid, p.blocksSight);
  }
  const buckets: number[][] = Array.from({ length: level.width * level.height }, () => []);
  boxes.forEach((b, index) => {
    const x0 = Math.max(0, Math.floor((b.minX - 0.5) / CELL));
    const x1 = Math.min(level.width - 1, Math.floor((b.maxX + 0.5) / CELL));
    const z0 = Math.max(0, Math.floor((b.minZ - 0.5) / CELL));
    const z1 = Math.min(level.height - 1, Math.floor((b.maxZ + 0.5) / CELL));
    for (let cz = z0; cz <= z1; cz += 1) for (let cx = x0; cx <= x1; cx += 1) buckets[cz * level.width + cx].push(index);
  });
  return { boxes, buckets, width: level.width, height: level.height };
};

/** Door open amount lookup so collision can ignore open door leaves. */
export type DoorOpenness = (doorId: number) => number;

const DOOR_BLOCKS_BELOW = 0.35;

const nearbyBoxes = (world: CollisionWorld, x: number, z: number): number[] => {
  const cx = Math.floor(x / CELL);
  const cz = Math.floor(z / CELL);
  if (cx < 0 || cz < 0 || cx >= world.width || cz >= world.height) return [];
  return world.buckets[cz * world.width + cx];
};

/** Pushes a circle out of every solid box it overlaps. Returns the corrected position. */
export const resolveCircle = (world: CollisionWorld, p: Vec2, radius: number, doorOpen: DoorOpenness, passDoors = false): Vec2 => {
  let { x, z } = p;
  for (let iter = 0; iter < 3; iter += 1) {
    let moved = false;
    for (const index of nearbyBoxes(world, x, z)) {
      const b = world.boxes[index];
      if (!b.solid) continue;
      if (b.door >= 0 && (passDoors || doorOpen(b.door) > DOOR_BLOCKS_BELOW)) continue;
      const qx = Math.max(b.minX, Math.min(x, b.maxX));
      const qz = Math.max(b.minZ, Math.min(z, b.maxZ));
      const dx = x - qx;
      const dz = z - qz;
      const dist = Math.hypot(dx, dz);
      if (dist >= radius) continue;
      if (dist > 1e-6) {
        x = qx + (dx / dist) * radius;
        z = qz + (dz / dist) * radius;
      } else {
        const pushes = [
          { d: x - b.minX + radius, x: b.minX - radius, z },
          { d: b.maxX - x + radius, x: b.maxX + radius, z },
          { d: z - b.minZ + radius, x, z: b.minZ - radius },
          { d: b.maxZ - z + radius, x, z: b.maxZ + radius },
        ].sort((a, c) => a.d - c.d)[0];
        x = pushes.x;
        z = pushes.z;
      }
      moved = true;
    }
    if (!moved) break;
  }
  return { x, z };
};

/** Moves a circle by (dx,dz) with sliding, in small substeps so fast movers never tunnel through walls. */
export const moveCircle = (
  world: CollisionWorld,
  p: Vec2,
  dx: number,
  dz: number,
  radius: number,
  doorOpen: DoorOpenness,
  passDoors = false,
): Vec2 => {
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / (radius * 0.5)));
  let pos = p;
  for (let i = 0; i < steps; i += 1) {
    pos = resolveCircle(world, { x: pos.x + dx / steps, z: pos.z + dz / steps }, radius, doorOpen, passDoors);
  }
  return pos;
};

const segmentHitsBox = (a: Vec2, b: Vec2, box: Box): boolean => {
  let t0 = 0;
  let t1 = 1;
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const clip = (p: number, q: number): boolean => {
    if (Math.abs(p) < 1e-9) return q >= 0;
    const r = q / p;
    if (p < 0) {
      if (r > t1) return false;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return false;
      if (r < t1) t1 = r;
    }
    return true;
  };
  return (
    clip(-dx, a.x - box.minX) &&
    clip(dx, box.maxX - a.x) &&
    clip(-dz, a.z - box.minZ) &&
    clip(dz, box.maxZ - a.z) &&
    t0 <= t1
  );
};

/** True if walls, closed doors or tall furniture block the straight line between two points. */
export const sightBlocked = (world: CollisionWorld, a: Vec2, b: Vec2, doorOpen: DoorOpenness): boolean => {
  const length = Math.hypot(b.x - a.x, b.z - a.z);
  const steps = Math.max(1, Math.ceil(length / (CELL * 0.5)));
  const checked = new Set<number>();
  for (let s = 0; s <= steps; s += 1) {
    const t = s / steps;
    for (const index of nearbyBoxes(world, a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t)) {
      if (checked.has(index)) continue;
      checked.add(index);
      const box = world.boxes[index];
      if (!box.sight) continue;
      if (box.door >= 0 && doorOpen(box.door) > DOOR_BLOCKS_BELOW) continue;
      if (segmentHitsBox(a, b, box)) return true;
    }
  }
  return false;
};
