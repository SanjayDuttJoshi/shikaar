import type { CellRect, Door, Vec2 } from "@/types/world";
import { CELL, WALL_THICKNESS } from "@/world/constants";

export interface Box {
  minX: number;
  minZ: number;
  maxX: number;
  maxZ: number;
}

export const cellCenter = (x: number, y: number): Vec2 => ({ x: (x + 0.5) * CELL, z: (y + 0.5) * CELL });

export const rectCenter = (r: CellRect): Vec2 => ({ x: (r.x + r.w / 2) * CELL, z: (r.y + r.h / 2) * CELL });

/** Walkable interior of a room in metres (inside the wall faces). */
export const roomInterior = (r: CellRect, inset = 0): Box => {
  const pad = WALL_THICKNESS / 2 + inset;
  return {
    minX: r.x * CELL + pad,
    minZ: r.y * CELL + pad,
    maxX: (r.x + r.w) * CELL - pad,
    maxZ: (r.y + r.h) * CELL - pad,
  };
};

/** Centre of the doorway in world metres. */
export const doorCenter = (door: Pick<Door, "cx" | "cy" | "vertical">): Vec2 =>
  door.vertical ? { x: (door.cx + 1) * CELL, z: (door.cy + 0.5) * CELL } : { x: (door.cx + 0.5) * CELL, z: (door.cy + 1) * CELL };

/** Axis-aligned footprint of a w×d box rotated by a multiple of 90°. */
export const footprint = (x: number, z: number, w: number, d: number, yaw: number): Box => {
  const quarter = Math.round(yaw / (Math.PI / 2));
  const turned = Math.abs(quarter) % 2 === 1;
  const hx = (turned ? d : w) / 2;
  const hz = (turned ? w : d) / 2;
  return { minX: x - hx, minZ: z - hz, maxX: x + hx, maxZ: z + hz };
};

export const boxesOverlap = (a: Box, b: Box, margin = 0): boolean =>
  a.minX < b.maxX + margin && a.maxX > b.minX - margin && a.minZ < b.maxZ + margin && a.maxZ > b.minZ - margin;

export const boxInside = (inner: Box, outer: Box): boolean =>
  inner.minX >= outer.minX && inner.maxX <= outer.maxX && inner.minZ >= outer.minZ && inner.maxZ <= outer.maxZ;

export const distanceToBox = (p: Vec2, b: Box): number => {
  const dx = Math.max(b.minX - p.x, 0, p.x - b.maxX);
  const dz = Math.max(b.minZ - p.z, 0, p.z - b.maxZ);
  return Math.hypot(dx, dz);
};

export const pointInBox = (p: Vec2, b: Box): boolean => p.x >= b.minX && p.x <= b.maxX && p.z >= b.minZ && p.z <= b.maxZ;
