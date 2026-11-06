import * as THREE from "three";
import { Surface } from "@/types/render";
import { CellKind, EdgeKind, Theme } from "@/types/world";
import type { Level } from "@/types/world";
import { doorGap } from "@/game/collision";
import { CELL, DOOR_HEIGHT, WALL_HEIGHT, WALL_THICKNESS } from "@/world/constants";
import { createGeometryBuilder } from "@/render3d/geometry-builder";
import type { GeometryBuilder } from "@/render3d/geometry-builder";
import type { SurfaceMaterials } from "@/render3d/materials";

const T = WALL_THICKNESS / 2;
const DADO: Record<Theme, number> = { [Theme.Asylum]: 1.35, [Theme.Haveli]: 0.55 };
const TRIM = 0.07;
const ARCH_DROP = 0.55;
const PARAPET = 0.9;
const OUTSIDE_MARGIN = 60;

interface Span {
  vertical: boolean;
  /** Fixed coordinate of the wall line (x for vertical, z for horizontal). */
  line: number;
  from: number;
  to: number;
}

/** Emits a wall run split into a lower band (tiles / sandstone) and an upper band (plaster). */
const wallRun = (g: GeometryBuilder, span: Span, y0: number, y1: number, dado: number): void => {
  const piece = (s: Surface, a: number, b: number): void => {
    if (b <= a) return;
    if (span.vertical) g.box(s, span.line - T, a, span.from, span.line + T, b, span.to, { py: b < WALL_HEIGHT, ny: a > 0 });
    else g.box(s, span.from, a, span.line - T, span.to, b, span.line + T, { py: b < WALL_HEIGHT, ny: a > 0 });
  };
  piece(Surface.WallLower, y0, Math.min(y1, dado));
  piece(Surface.WallUpper, Math.max(y0, dado), y1);
};

const doorFrame = (g: GeometryBuilder, span: Span, mid: number, gap: number): void => {
  const w = T + 0.035;
  const post = (c: number): void => {
    if (span.vertical) g.box(Surface.Trim, span.line - w, 0, c - TRIM / 2, span.line + w, DOOR_HEIGHT + TRIM, c + TRIM / 2);
    else g.box(Surface.Trim, c - TRIM / 2, 0, span.line - w, c + TRIM / 2, DOOR_HEIGHT + TRIM, span.line + w);
  };
  post(mid - gap / 2 - TRIM / 2);
  post(mid + gap / 2 + TRIM / 2);
  if (span.vertical) g.box(Surface.Trim, span.line - w, DOOR_HEIGHT, mid - gap / 2 - TRIM, span.line + w, DOOR_HEIGHT + TRIM, mid + gap / 2 + TRIM);
  else g.box(Surface.Trim, mid - gap / 2 - TRIM, DOOR_HEIGHT, span.line - w, mid + gap / 2 + TRIM, DOOR_HEIGHT + TRIM, span.line + w);
};

const emitEdge = (g: GeometryBuilder, level: Level, vertical: boolean, x: number, y: number, dado: number): void => {
  const i = y * level.width + x;
  const kind = (vertical ? level.edgeX[i] : level.edgeY[i]) as EdgeKind;
  const line = vertical ? (x + 1) * CELL : (y + 1) * CELL;
  const from = (vertical ? y : x) * CELL - T;
  const to = (vertical ? y + 1 : x + 1) * CELL + T;
  const span: Span = { vertical, line, from, to };
  if (kind === EdgeKind.Wall) {
    wallRun(g, span, 0, WALL_HEIGHT, dado);
    return;
  }
  const doorId = vertical ? level.doorX[i] : level.doorY[i];
  if (kind !== EdgeKind.Door || doorId < 0) return;
  const gap = doorGap(level.doors[doorId].kind);
  const mid = (vertical ? y + 0.5 : x + 0.5) * CELL;
  wallRun(g, { ...span, to: mid - gap / 2 }, 0, WALL_HEIGHT, dado);
  wallRun(g, { ...span, from: mid + gap / 2 }, 0, WALL_HEIGHT, dado);
  wallRun(g, { ...span, from: mid - gap / 2, to: mid + gap / 2 }, DOOR_HEIGHT, WALL_HEIGHT, dado);
  doorFrame(g, span, mid, gap);
};

/** Beam over each opening between verandah and courtyard (arcade), with a low parapet on the roof. */
const emitArcade = (g: GeometryBuilder, level: Level, vertical: boolean, x: number, y: number): void => {
  const line = vertical ? (x + 1) * CELL : (y + 1) * CELL;
  const from = (vertical ? y : x) * CELL;
  const to = from + CELL;
  const y0 = WALL_HEIGHT - ARCH_DROP;
  if (vertical) {
    g.box(Surface.Stone, line - 0.16, y0, from, line + 0.16, WALL_HEIGHT, to, { ny: true });
    g.box(Surface.Stone, line - 0.14, WALL_HEIGHT, from - 0.14, line + 0.14, WALL_HEIGHT + PARAPET, to + 0.14);
  } else {
    g.box(Surface.Stone, from, y0, line - 0.16, to, WALL_HEIGHT, line + 0.16, { ny: true });
    g.box(Surface.Stone, from - 0.14, WALL_HEIGHT, line - 0.14, to + 0.14, WALL_HEIGHT + PARAPET, line + 0.14);
  }
};

export const buildLevelMesh = (level: Level, materials: SurfaceMaterials): THREE.Group => {
  const g = createGeometryBuilder(materials.scale);
  const dado = DADO[level.theme];
  const inside = (x: number, y: number): boolean =>
    x >= 0 && y >= 0 && x < level.width && y < level.height && level.roomOf[y * level.width + x] >= 0;
  const isCourt = (x: number, y: number): boolean => inside(x, y) && level.kindOf[y * level.width + x] === CellKind.Courtyard;

  for (let y = 0; y < level.height; y += 1) {
    for (let x = 0; x < level.width; x += 1) {
      const here = inside(x, y);
      if (here) {
        const court = isCourt(x, y);
        g.floorQuad(court ? Surface.CourtyardFloor : Surface.Floor, x * CELL, y * CELL, (x + 1) * CELL, (y + 1) * CELL, 0, true);
        if (!court) {
          g.floorQuad(Surface.Ceiling, x * CELL, y * CELL, (x + 1) * CELL, (y + 1) * CELL, WALL_HEIGHT, false);
          g.floorQuad(Surface.Stone, x * CELL, y * CELL, (x + 1) * CELL, (y + 1) * CELL, WALL_HEIGHT + 0.02, true);
        }
      }
      const right = inside(x + 1, y);
      const down = inside(x, y + 1);
      if (here || right) {
        const ex = level.edgeX[y * level.width + x] as EdgeKind;
        if (ex !== EdgeKind.Open) emitEdge(g, level, true, x, y, dado);
        else if (here && right && isCourt(x, y) !== isCourt(x + 1, y)) emitArcade(g, level, true, x, y);
      }
      if (here || down) {
        const ey = level.edgeY[y * level.width + x] as EdgeKind;
        if (ey !== EdgeKind.Open) emitEdge(g, level, false, x, y, dado);
        else if (here && down && isCourt(x, y) !== isCourt(x, y + 1)) emitArcade(g, level, false, x, y);
      }
    }
  }
  const w = level.width * CELL;
  const h = level.height * CELL;
  g.floorQuad(Surface.Ground, -OUTSIDE_MARGIN, -OUTSIDE_MARGIN, w + OUTSIDE_MARGIN, h + OUTSIDE_MARGIN, -0.03, true);

  const group = new THREE.Group();
  group.name = "level";
  for (const mesh of g.build(materials.get)) {
    if (mesh.name === `surface:${Surface.Ground}`) {
      mesh.castShadow = false;
    }
    group.add(mesh);
  }
  return group;
};
