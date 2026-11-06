import * as THREE from "three";
import { Surface } from "@/types/render";
import { FilmSet } from "@/types/story";
import { PropKind } from "@/types/world";
import { createGeometryBuilder } from "@/render3d/geometry-builder";
import type { SurfaceMaterials } from "@/render3d/materials";
import { proceduralPropGeometry } from "@/render3d/procedural-props";
import type { PropModels } from "@/render3d/props-view";

export interface StageSet {
  group: THREE.Group;
  /** Hinged door leaf (cellar/courtyard back door); rotation.y 0 = shut. */
  door: THREE.Object3D | null;
  /** Spot where a ceiling bulb/tube hangs, for "bulb" lighting. */
  lamp: THREE.Vector3;
}

const WALL = 0.2;

interface Box {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  height: number;
}

/** Floor, ceiling and four walls (front wall left open for the camera). */
const room = (materials: SurfaceMaterials, b: Box, dado: number, ceiling = true): THREE.Group => {
  const g = createGeometryBuilder(materials.scale);
  g.floorQuad(Surface.Floor, b.minX, b.minZ, b.maxX, b.maxZ, 0, true);
  if (ceiling) g.floorQuad(Surface.Ceiling, b.minX, b.minZ, b.maxX, b.maxZ, b.height, false);
  const wall = (minX: number, minZ: number, maxX: number, maxZ: number): void => {
    g.box(Surface.WallLower, minX, 0, minZ, maxX, dado, maxZ);
    g.box(Surface.WallUpper, minX, dado, minZ, maxX, b.height, maxZ);
  };
  wall(b.minX - WALL, b.minZ - WALL, b.maxX + WALL, b.minZ);
  wall(b.minX - WALL, b.minZ, b.minX, b.maxZ + 2);
  wall(b.maxX, b.minZ, b.maxX + WALL, b.maxZ + 2);
  const group = new THREE.Group();
  for (const mesh of g.build(materials.get)) group.add(mesh);
  return group;
};

const prop = (kind: PropKind, models: PropModels, materials: SurfaceMaterials, x: number, z: number, yaw: number): THREE.Object3D => {
  const holder = new THREE.Group();
  const model = models.get(kind);
  if (model) holder.add(model.clone(true));
  else for (const [surface, geo] of proceduralPropGeometry(kind)) holder.add(new THREE.Mesh(geo, materials.get(surface)));
  holder.position.set(x, 0, z);
  holder.rotation.y = yaw;
  holder.traverse((o) => {
    o.castShadow = true;
    o.receiveShadow = true;
  });
  return holder;
};

/** A wooden door leaf in the back wall at z = wallZ, hinged on its left edge. */
const doorLeaf = (materials: SurfaceMaterials, wallZ: number): THREE.Object3D => {
  const pivot = new THREE.Group();
  pivot.position.set(-0.6, 0, wallZ + 0.12);
  const leaf = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.2, 0.08), materials.get(Surface.DoorWood));
  leaf.position.set(0.6, 1.1, 0);
  leaf.castShadow = true;
  pivot.add(leaf);
  return pivot;
};

const tubeGlow = (x: number, z: number, y: number): THREE.Mesh => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.05, 0.1), new THREE.MeshBasicMaterial({ color: 0xd8ffe8, toneMapped: false }));
  m.position.set(x, y, z);
  return m;
};

/** Builds one of the small stages the story films are shot on, using the building's own materials. */
export const buildStage = (set: FilmSet, materials: SurfaceMaterials, models: PropModels): StageSet => {
  const group = new THREE.Group();
  let door: THREE.Object3D | null = null;
  let lamp = new THREE.Vector3(0, 2.6, 0);
  switch (set) {
    case FilmSet.Courtyard: {
      const g = createGeometryBuilder(materials.scale);
      g.floorQuad(Surface.CourtyardFloor, -7, -7, 7, 8, 0, true);
      g.box(Surface.WallLower, -7, 0, -6.2, -0.7, 0.6, -6);
      g.box(Surface.WallUpper, -7, 0.6, -6.2, -0.7, 4, -6);
      g.box(Surface.WallLower, 0.7, 0, -6.2, 7, 0.6, -6);
      g.box(Surface.WallUpper, 0.7, 0.6, -6.2, 7, 4, -6);
      g.box(Surface.WallUpper, -0.7, 2.3, -6.2, 0.7, 4, -6);
      for (const mesh of g.build(materials.get)) group.add(mesh);
      for (const x of [-4.5, 4.5]) for (const z of [-4, -1, 2, 5]) group.add(prop(PropKind.Pillar, models, materials, x, z, 0));
      door = doorLeaf(materials, -6.1);
      group.add(door);
      lamp = new THREE.Vector3(0, 6, 0);
      break;
    }
    case FilmSet.Cellar: {
      group.add(room(materials, { minX: -3, maxX: 3, minZ: -3, maxZ: 3, height: 2.6 }, 0.9));
      door = doorLeaf(materials, -3);
      door.rotation.y = -1.25;
      group.add(door);
      group.add(prop(PropKind.Chest, models, materials, -2.2, -2.4, 0));
      group.add(prop(PropKind.Pot, models, materials, 2.3, 1.5, 0));
      lamp = new THREE.Vector3(0, 2.4, 0);
      break;
    }
    case FilmSet.Baithak: {
      group.add(room(materials, { minX: -4, maxX: 4, minZ: -3.5, maxZ: 3.5, height: 3.2 }, 0.6));
      group.add(prop(PropKind.Rug, models, materials, 0, -0.5, 0));
      group.add(prop(PropKind.Chair, models, materials, -1.5, -2.6, 0));
      group.add(prop(PropKind.Table, models, materials, 1.2, -2.9, 0));
      group.add(prop(PropKind.Wardrobe, models, materials, 3.4, -1.5, -Math.PI / 2));
      lamp = new THREE.Vector3(-2.5, 2.2, -3.2);
      break;
    }
    case FilmSet.Ward: {
      group.add(room(materials, { minX: -3.5, maxX: 3.5, minZ: -6, maxZ: 6, height: 3.2 }, 1.35));
      for (const z of [-4.5, -2.5, -0.5, 1.5, 3.5]) {
        group.add(prop(PropKind.HospitalBed, models, materials, -2.4, z, Math.PI / 2));
        group.add(prop(PropKind.HospitalBed, models, materials, 2.4, z, -Math.PI / 2));
      }
      group.add(tubeGlow(0, -2, 3.12), tubeGlow(0, 2, 3.12));
      lamp = new THREE.Vector3(0, 2.9, 0);
      break;
    }
    case FilmSet.Corridor: {
      group.add(room(materials, { minX: -1.5, maxX: 1.5, minZ: -22, maxZ: 4, height: 3.2 }, 1.35));
      for (const z of [2, -4, -10, -16]) group.add(tubeGlow(0, z, 3.12));
      group.add(prop(PropKind.Wheelchair, models, materials, 1.0, -6, -Math.PI / 2));
      group.add(prop(PropKind.IvStand, models, materials, -1.1, -9, 0));
      door = doorLeaf(materials, -22);
      group.add(door);
      lamp = new THREE.Vector3(0, 2.9, -4);
      break;
    }
    default: {
      group.add(room(materials, { minX: -3, maxX: 3, minZ: -3, maxZ: 3, height: 3.2 }, 1.35));
      group.add(prop(PropKind.OperatingTable, models, materials, 0, 0, 0));
      group.add(prop(PropKind.Trolley, models, materials, 1.4, -1.6, 0));
      group.add(prop(PropKind.MetalCabinet, models, materials, -2.6, -2.7, 0));
      lamp = new THREE.Vector3(0, 2.8, 0);
    }
  }
  return { group, door, lamp };
};
