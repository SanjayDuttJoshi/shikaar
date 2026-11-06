import * as THREE from "three";
import { PropKind } from "@/types/world";
import type { Level, PropSpawn } from "@/types/world";
import type { SurfaceMaterials } from "@/render3d/materials";
import { proceduralPropGeometry } from "@/render3d/procedural-props";

/** A loaded model for a prop kind, already scaled/centred so its footprint matches the prop spec. */
export type PropModels = Map<PropKind, THREE.Object3D>;

const SKIP_SHADOW = new Set([PropKind.Rug, PropKind.Lantern, PropKind.Mirror]);

const propMatrix = (p: PropSpawn): THREE.Matrix4 =>
  new THREE.Matrix4().compose(
    new THREE.Vector3(p.x, 0, p.z),
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.kind === PropKind.Pillar ? 0 : p.yaw),
    new THREE.Vector3(1, 1, 1),
  );

const instance = (geometry: THREE.BufferGeometry, material: THREE.Material, matrices: THREE.Matrix4[], local: THREE.Matrix4, kind: PropKind): THREE.InstancedMesh => {
  const mesh = new THREE.InstancedMesh(geometry, material, matrices.length);
  const m = new THREE.Matrix4();
  matrices.forEach((world, i) => mesh.setMatrixAt(i, m.multiplyMatrices(world, local)));
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = !SKIP_SHADOW.has(kind);
  mesh.receiveShadow = true;
  mesh.computeBoundingSphere();
  mesh.name = `prop:${kind}`;
  return mesh;
};

export interface PropsView {
  group: THREE.Group;
  /** Hides one piece of furniture (the locker you are hiding in, so the camera isn't inside it). */
  setHidden: (propId: number) => void;
}

/** All furniture as instanced meshes: one draw call per prop kind and material. */
export const buildPropsView = (level: Level, materials: SurfaceMaterials, models: PropModels, skip: Set<number> = new Set()): PropsView => {
  const group = new THREE.Group();
  group.name = "props";
  const byKind = new Map<PropKind, THREE.Matrix4[]>();
  const slot = new Map<number, { kind: PropKind; index: number }>();
  for (const p of level.props) {
    const list = byKind.get(p.kind) ?? [];
    slot.set(p.id, { kind: p.kind, index: list.length });
    list.push(propMatrix(p));
    byKind.set(p.kind, list);
  }
  const meshesByKind = new Map<PropKind, Array<{ mesh: THREE.InstancedMesh; local: THREE.Matrix4 }>>();
  const remember = (kind: PropKind, mesh: THREE.InstancedMesh, local: THREE.Matrix4): THREE.InstancedMesh => {
    meshesByKind.set(kind, [...(meshesByKind.get(kind) ?? []), { mesh, local: local.clone() }]);
    return mesh;
  };
  const identity = new THREE.Matrix4();
  for (const [kind, matrices] of byKind) {
    const model = models.get(kind);
    if (model) {
      model.updateMatrixWorld(true);
      model.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (!mesh.isMesh) return;
        group.add(remember(kind, instance(mesh.geometry, mesh.material as THREE.Material, matrices, mesh.matrixWorld, kind), mesh.matrixWorld));
      });
      continue;
    }
    for (const [surface, geometry] of proceduralPropGeometry(kind)) {
      group.add(remember(kind, instance(geometry, materials.get(surface), matrices, identity, kind), identity));
    }
  }
  const hiddenMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
  const tmp = new THREE.Matrix4();
  let hidden = -1;
  const apply = (propId: number, visible: boolean): void => {
    const at = slot.get(propId);
    if (!at) return;
    const world = byKind.get(at.kind)?.[at.index];
    for (const { mesh, local } of meshesByKind.get(at.kind) ?? []) {
      mesh.setMatrixAt(at.index, visible && world ? tmp.multiplyMatrices(world, local) : hiddenMatrix);
      mesh.instanceMatrix.needsUpdate = true;
    }
  };
  for (const id of skip) apply(id, false);
  const setHidden = (propId: number): void => {
    if (propId === hidden) return;
    if (hidden >= 0 && !skip.has(hidden)) apply(hidden, true);
    hidden = propId;
    if (propId >= 0) apply(propId, false);
  };
  return { group, setHidden };
};
