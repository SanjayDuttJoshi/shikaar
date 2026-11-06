import * as THREE from "three";
import type { Surface } from "@/types/render";

interface Buffers {
  positions: number[];
  normals: number[];
  uvs: number[];
  indices: number[];
}

export interface BoxFaces {
  px?: boolean;
  nx?: boolean;
  py?: boolean;
  ny?: boolean;
  pz?: boolean;
  nz?: boolean;
}

const ALL_FACES: Required<BoxFaces> = { px: true, nx: true, py: true, ny: true, pz: true, nz: true };

/**
 * Collects axis-aligned boxes and quads per surface with world-space UVs (so textures tile
 * at a constant real-world size), then emits one merged mesh per surface.
 */
export const createGeometryBuilder = (uvScale: (s: Surface) => number) => {
  const buffers = new Map<Surface, Buffers>();
  const get = (s: Surface): Buffers => {
    let b = buffers.get(s);
    if (!b) {
      b = { positions: [], normals: [], uvs: [], indices: [] };
      buffers.set(s, b);
    }
    return b;
  };

  /** Adds a quad given 4 corners (counter-clockwise seen from the normal side). */
  const quad = (s: Surface, corners: number[][], normal: number[], uvAxes: [number, number]): void => {
    const b = get(s);
    const scale = uvScale(s);
    const base = b.positions.length / 3;
    for (const c of corners) {
      b.positions.push(c[0], c[1], c[2]);
      b.normals.push(normal[0], normal[1], normal[2]);
      b.uvs.push(c[uvAxes[0]] / scale, c[uvAxes[1]] / scale);
    }
    b.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };

  const box = (
    s: Surface,
    minX: number,
    minY: number,
    minZ: number,
    maxX: number,
    maxY: number,
    maxZ: number,
    faces: BoxFaces = ALL_FACES,
  ): void => {
    const f = { ...ALL_FACES, ...faces };
    if (f.px) quad(s, [[maxX, minY, maxZ], [maxX, minY, minZ], [maxX, maxY, minZ], [maxX, maxY, maxZ]], [1, 0, 0], [2, 1]);
    if (f.nx) quad(s, [[minX, minY, minZ], [minX, minY, maxZ], [minX, maxY, maxZ], [minX, maxY, minZ]], [-1, 0, 0], [2, 1]);
    if (f.pz) quad(s, [[minX, minY, maxZ], [maxX, minY, maxZ], [maxX, maxY, maxZ], [minX, maxY, maxZ]], [0, 0, 1], [0, 1]);
    if (f.nz) quad(s, [[maxX, minY, minZ], [minX, minY, minZ], [minX, maxY, minZ], [maxX, maxY, minZ]], [0, 0, -1], [0, 1]);
    if (f.py) quad(s, [[minX, maxY, maxZ], [maxX, maxY, maxZ], [maxX, maxY, minZ], [minX, maxY, minZ]], [0, 1, 0], [0, 2]);
    if (f.ny) quad(s, [[minX, minY, minZ], [maxX, minY, minZ], [maxX, minY, maxZ], [minX, minY, maxZ]], [0, -1, 0], [0, 2]);
  };

  const floorQuad = (s: Surface, minX: number, minZ: number, maxX: number, maxZ: number, y: number, facingUp: boolean): void => {
    if (facingUp) quad(s, [[minX, y, maxZ], [maxX, y, maxZ], [maxX, y, minZ], [minX, y, minZ]], [0, 1, 0], [0, 2]);
    else quad(s, [[minX, y, minZ], [maxX, y, minZ], [maxX, y, maxZ], [minX, y, maxZ]], [0, -1, 0], [0, 2]);
  };

  const build = (materials: (s: Surface) => THREE.Material): THREE.Mesh[] => {
    const meshes: THREE.Mesh[] = [];
    for (const [surface, b] of buffers) {
      if (b.indices.length === 0) continue;
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(b.positions, 3));
      geometry.setAttribute("normal", new THREE.Float32BufferAttribute(b.normals, 3));
      geometry.setAttribute("uv", new THREE.Float32BufferAttribute(b.uvs, 2));
      geometry.setIndex(b.indices);
      geometry.computeBoundingSphere();
      const mesh = new THREE.Mesh(geometry, materials(surface));
      mesh.name = `surface:${surface}`;
      mesh.receiveShadow = true;
      mesh.castShadow = true;
      meshes.push(mesh);
    }
    return meshes;
  };

  return { box, quad, floorQuad, build };
};

export type GeometryBuilder = ReturnType<typeof createGeometryBuilder>;
