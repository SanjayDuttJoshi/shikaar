import * as THREE from "three";
import { Surface } from "@/types/render";
import { PropKind } from "@/types/world";
import { PROP_SPECS } from "@/world/prop-specs";

/**
 * Box-and-cylinder stand-ins for every prop kind, built at origin facing +Z with the floor at y=0.
 * Used until (or instead of) a downloaded model, so the game always has furniture to hide behind.
 */
type Part = { s: Surface; geo: THREE.BufferGeometry; x: number; y: number; z: number; rx?: number; rz?: number };

const box = (s: Surface, w: number, h: number, d: number, x: number, y: number, z: number): Part => ({
  s,
  geo: new THREE.BoxGeometry(w, h, d),
  x,
  y: y + h / 2,
  z,
});

const cyl = (s: Surface, r: number, h: number, x: number, y: number, z: number, rz = 0, rx = 0): Part => ({
  s,
  geo: new THREE.CylinderGeometry(r, r, h, 8),
  x,
  y,
  z,
  rx,
  rz,
});

const legs = (s: Surface, w: number, d: number, h: number, r = 0.025): Part[] =>
  [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ].map(([sx, sz]) => cyl(s, r, h, (sx * (w - r * 4)) / 2, h / 2, (sz * (d - r * 4)) / 2));

const PARTS: Partial<Record<PropKind, () => Part[]>> = {
  [PropKind.HospitalBed]: () => {
    const { w, d } = PROP_SPECS[PropKind.HospitalBed];
    return [
      ...legs(Surface.Metal, w, d, 0.42),
      box(Surface.Metal, w, 0.05, d, 0, 0.4, 0),
      box(Surface.Fabric, w - 0.06, 0.16, d - 0.1, 0, 0.45, 0),
      box(Surface.Fabric, w - 0.25, 0.1, 0.4, 0, 0.61, -d / 2 + 0.3),
      box(Surface.Metal, w, 0.6, 0.04, 0, 0.42, -d / 2 + 0.02),
      box(Surface.Metal, w, 0.35, 0.04, 0, 0.42, d / 2 - 0.02),
    ];
  },
  [PropKind.MetalLocker]: () => {
    const { w, h, d } = PROP_SPECS[PropKind.MetalLocker];
    return [
      box(Surface.Metal, w, h, d, 0, 0, 0),
      box(Surface.DoorMetal, w - 0.06, h - 0.12, 0.02, 0, 0.06, d / 2 + 0.005),
      box(Surface.Brass, 0.03, 0.14, 0.03, w / 2 - 0.1, 1.0, d / 2 + 0.02),
      ...[0, 1, 2, 3].map((i) => box(Surface.Trim, w - 0.2, 0.012, 0.01, 0, h - 0.25 - i * 0.04, d / 2 + 0.02)),
    ];
  },
  [PropKind.Wheelchair]: () => [
    cyl(Surface.Metal, 0.3, 0.03, -0.3, 0.3, 0.05, Math.PI / 2),
    cyl(Surface.Metal, 0.3, 0.03, 0.3, 0.3, 0.05, Math.PI / 2),
    box(Surface.Fabric, 0.5, 0.05, 0.45, 0, 0.45, 0.05),
    box(Surface.Fabric, 0.5, 0.45, 0.04, 0, 0.5, -0.2),
    box(Surface.Metal, 0.04, 0.04, 0.3, -0.25, 0.75, 0.0),
    box(Surface.Metal, 0.04, 0.04, 0.3, 0.25, 0.75, 0.0),
  ],
  [PropKind.MetalCabinet]: () => {
    const { w, h, d } = PROP_SPECS[PropKind.MetalCabinet];
    return [
      box(Surface.Metal, w, h, d, 0, 0, 0),
      box(Surface.Trim, w - 0.06, 0.01, 0.01, 0, h * 0.33, d / 2 + 0.005),
      box(Surface.Trim, w - 0.06, 0.01, 0.01, 0, h * 0.66, d / 2 + 0.005),
    ];
  },
  [PropKind.Desk]: () => {
    const { w, h, d } = PROP_SPECS[PropKind.Desk];
    return [box(Surface.Wood, w, 0.05, d, 0, h - 0.05, 0), box(Surface.Wood, 0.4, h - 0.05, d - 0.05, w / 2 - 0.22, 0, 0), ...legs(Surface.Wood, w, d, h - 0.05, 0.03)];
  },
  [PropKind.Chair]: () => [
    ...legs(Surface.Metal, 0.44, 0.44, 0.45, 0.015),
    box(Surface.Wood, 0.46, 0.04, 0.46, 0, 0.45, 0),
    box(Surface.Wood, 0.46, 0.42, 0.04, 0, 0.48, -0.21),
  ],
  [PropKind.IvStand]: () => [cyl(Surface.Metal, 0.015, 1.85, 0, 0.93, 0), box(Surface.Metal, 0.4, 0.03, 0.4, 0, 0, 0), box(Surface.Fabric, 0.12, 0.2, 0.05, 0.08, 1.55, 0)],
  [PropKind.Trolley]: () => [
    ...legs(Surface.Metal, 0.9, 0.5, 0.85, 0.015),
    box(Surface.Metal, 0.9, 0.03, 0.5, 0, 0.85, 0),
    box(Surface.Metal, 0.9, 0.03, 0.5, 0, 0.35, 0),
  ],
  [PropKind.Shelf]: () => {
    const { w, h, d } = PROP_SPECS[PropKind.Shelf];
    return [
      ...legs(Surface.Metal, w, d, h, 0.02),
      ...[0.1, 0.55, 1.0, 1.45, 1.9].map((y) => box(Surface.Metal, w, 0.03, d, 0, y, 0)),
      box(Surface.Fabric, 0.3, 0.25, 0.25, -0.3, 0.58, 0),
      box(Surface.Wood, 0.35, 0.3, 0.3, 0.25, 1.03, 0),
    ];
  },
  [PropKind.Sink]: () => [box(Surface.Fabric, 0.6, 0.18, 0.45, 0, 0.72, 0), cyl(Surface.Metal, 0.05, 0.72, 0, 0.36, -0.1), box(Surface.Metal, 0.03, 0.15, 0.03, 0, 0.9, -0.18)],
  [PropKind.Bathtub]: () => [
    box(Surface.Fabric, 0.8, 0.55, 1.7, 0, 0.05, 0),
    ...legs(Surface.Brass, 0.8, 1.7, 0.08, 0.04),
  ],
  [PropKind.OperatingTable]: () => [
    cyl(Surface.Metal, 0.12, 0.8, 0, 0.4, 0),
    box(Surface.Metal, 0.6, 0.05, 0.6, 0, 0, 0),
    box(Surface.Fabric, 0.8, 0.12, 2.0, 0, 0.82, 0),
  ],
  [PropKind.Crate]: () => [box(Surface.Wood, 0.8, 0.8, 0.8, 0, 0, 0)],
  [PropKind.Barrel]: () => [cyl(Surface.Metal, 0.3, 0.9, 0, 0.45, 0)],
  [PropKind.Wardrobe]: () => {
    const { w, h, d } = PROP_SPECS[PropKind.Wardrobe];
    return [
      box(Surface.Wood, w, h, d, 0, 0, 0),
      box(Surface.DoorWood, w / 2 - 0.04, h - 0.2, 0.02, -w / 4, 0.1, d / 2 + 0.005),
      box(Surface.DoorWood, w / 2 - 0.04, h - 0.2, 0.02, w / 4, 0.1, d / 2 + 0.005),
      box(Surface.Brass, 0.03, 0.12, 0.03, -0.04, 1.0, d / 2 + 0.025),
      box(Surface.Brass, 0.03, 0.12, 0.03, 0.04, 1.0, d / 2 + 0.025),
      box(Surface.Wood, w + 0.06, 0.08, d + 0.06, 0, h - 0.04, 0),
    ];
  },
  [PropKind.Chest]: () => [box(Surface.Wood, 1.0, 0.55, 0.55, 0, 0, 0), box(Surface.Brass, 1.02, 0.05, 0.57, 0, 0.42, 0), box(Surface.Brass, 0.08, 0.1, 0.02, 0, 0.35, 0.285)],
  [PropKind.Charpai]: () => [
    ...legs(Surface.Wood, 1.0, 2.0, 0.5, 0.04),
    box(Surface.Wood, 1.0, 0.06, 0.06, 0, 0.42, -0.97),
    box(Surface.Wood, 1.0, 0.06, 0.06, 0, 0.42, 0.97),
    box(Surface.Wood, 0.06, 0.06, 2.0, -0.47, 0.42, 0),
    box(Surface.Wood, 0.06, 0.06, 2.0, 0.47, 0.42, 0),
    box(Surface.Fabric, 0.9, 0.03, 1.9, 0, 0.45, 0),
  ],
  [PropKind.Table]: () => {
    const { w, h, d } = PROP_SPECS[PropKind.Table];
    return [box(Surface.Wood, w, 0.05, d, 0, h - 0.05, 0), ...legs(Surface.Wood, w, d, h - 0.05, 0.035)];
  },
  [PropKind.Rug]: () => [box(Surface.Carpet, 2.2, 0.015, 3.0, 0, 0, 0)],
  [PropKind.Pot]: () => [
    { s: Surface.Brass, geo: new THREE.SphereGeometry(0.22, 10, 8), x: 0, y: 0.24, z: 0 },
    cyl(Surface.Brass, 0.1, 0.12, 0, 0.48, 0),
  ],
  [PropKind.Pillar]: () => [
    cyl(Surface.Stone, 0.17, 3.2, 0, 1.6, 0),
    box(Surface.Stone, 0.42, 0.18, 0.42, 0, 0, 0),
    box(Surface.Stone, 0.42, 0.22, 0.42, 0, 2.98, 0),
  ],
  [PropKind.Lantern]: () => [box(Surface.Brass, 0.06, 0.25, 0.1, 0, 1.95, -0.05), cyl(Surface.Brass, 0.08, 0.22, 0, 2.05, 0.06)],
  [PropKind.Mirror]: () => [box(Surface.Wood, 0.7, 1.7, 0.06, 0, 0.05, 0), box(Surface.Metal, 0.56, 1.45, 0.01, 0, 0.18, 0.035)],
  [PropKind.Cradle]: () => [
    box(Surface.Wood, 0.08, 0.9, 0.08, 0, 0, -0.45),
    box(Surface.Wood, 0.08, 0.9, 0.08, 0, 0, 0.45),
    box(Surface.Wood, 0.06, 0.06, 1.0, 0, 0.86, 0),
    box(Surface.Wood, 0.5, 0.25, 0.7, 0, 0.3, 0),
  ],
  [PropKind.FuseBox]: () => [
    box(Surface.Metal, 0.7, 0.9, 0.22, 0, 0.9, 0),
    box(Surface.DoorMetal, 0.66, 0.86, 0.02, 0, 0.92, 0.12),
    cyl(Surface.Metal, 0.05, 0.9, 0.25, 0.45, 0),
  ],
};

/** Merges a prop's parts into one geometry per surface (ready for instancing). */
export const proceduralPropGeometry = (kind: PropKind): Map<Surface, THREE.BufferGeometry> => {
  const parts = (PARTS[kind] ?? (() => [box(Surface.Wood, PROP_SPECS[kind].w, PROP_SPECS[kind].h, PROP_SPECS[kind].d, 0, 0, 0)]))();
  const bySurface = new Map<Surface, THREE.BufferGeometry[]>();
  for (const part of parts) {
    const geo = part.geo.toNonIndexed();
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(part.x, part.y, part.z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(part.rx ?? 0, 0, part.rz ?? 0)),
      new THREE.Vector3(1, 1, 1),
    );
    geo.applyMatrix4(m);
    bySurface.set(part.s, [...(bySurface.get(part.s) ?? []), geo]);
    part.geo.dispose();
  }
  const merged = new Map<Surface, THREE.BufferGeometry>();
  for (const [s, list] of bySurface) {
    const out = mergeNonIndexed(list);
    merged.set(s, out);
  }
  return merged;
};

const mergeNonIndexed = (list: THREE.BufferGeometry[]): THREE.BufferGeometry => {
  const attrs = ["position", "normal", "uv"] as const;
  const out = new THREE.BufferGeometry();
  for (const name of attrs) {
    const size = name === "uv" ? 2 : 3;
    const total = list.reduce((sum, g) => sum + g.getAttribute(name).count * size, 0);
    const data = new Float32Array(total);
    let offset = 0;
    for (const g of list) {
      const a = g.getAttribute(name).array as Float32Array;
      data.set(a, offset);
      offset += a.length;
    }
    out.setAttribute(name, new THREE.BufferAttribute(data, size));
  }
  for (const g of list) g.dispose();
  out.computeBoundingSphere();
  return out;
};

