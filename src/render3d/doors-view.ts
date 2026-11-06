import * as THREE from "three";
import { Surface } from "@/types/render";
import { DoorKind, RoomKind } from "@/types/world";
import type { Door, Level } from "@/types/world";
import type { DoorState } from "@/types/game";
import { doorGap } from "@/game/collision";
import { CELL, DOOR_HEIGHT } from "@/world/constants";
import { KEY_HEX } from "@/lib/labels";
import type { SurfaceMaterials } from "@/render3d/materials";

const LEAF_THICKNESS = 0.06;
const SWING = (100 * Math.PI) / 180;

interface DoorView {
  leaves: Array<{ pivot: THREE.Object3D; sign: number }>;
  lockMarks: THREE.Object3D[];
  chains: THREE.Object3D | null;
}

/** Which side the leaf swings into: away from corridors so passages stay clear. */
const swingSign = (level: Level, door: Door): number => {
  const a = level.roomOf[door.cy * level.width + door.cx];
  const bx = door.vertical ? door.cx + 1 : door.cx;
  const by = door.vertical ? door.cy : door.cy + 1;
  const b = level.roomOf[by * level.width + bx];
  const aCorridor = a < 0 || level.rooms[a].kind === RoomKind.Corridor;
  const bCorridor = b < 0 || level.rooms[b].kind === RoomKind.Corridor;
  if (aCorridor && !bCorridor) return 1;
  if (bCorridor && !aCorridor) return -1;
  return 1;
};

const lockMaterial = (color: string): THREE.MeshStandardMaterial =>
  new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.6, roughness: 0.4 });

const makeLeaf = (width: number, material: THREE.Material, metalBars: boolean, barMaterial: THREE.Material): THREE.Group => {
  const leaf = new THREE.Group();
  const panel = new THREE.Mesh(new THREE.BoxGeometry(width, DOOR_HEIGHT - 0.02, LEAF_THICKNESS), material);
  panel.position.set(width / 2, (DOOR_HEIGHT - 0.02) / 2, 0);
  panel.castShadow = true;
  panel.receiveShadow = true;
  leaf.add(panel);
  if (metalBars) {
    panel.scale.y = 0.42;
    panel.position.y = 0.48;
    for (let i = 0; i < 6; i += 1) {
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, DOOR_HEIGHT - 0.95, 6), barMaterial);
      bar.position.set((width / 6) * (i + 0.5), 0.95 + (DOOR_HEIGHT - 0.95) / 2, 0);
      leaf.add(bar);
    }
    const top = new THREE.Mesh(new THREE.BoxGeometry(width, 0.08, 0.08), barMaterial);
    top.position.set(width / 2, DOOR_HEIGHT - 0.06, 0);
    leaf.add(top);
  } else {
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.12, 0.16), barMaterial);
    handle.position.set(width - 0.1, 1.0, 0);
    leaf.add(handle);
  }
  return leaf;
};

export interface DoorsView {
  group: THREE.Group;
  update: (doors: DoorState[]) => void;
}

export const buildDoorsView = (level: Level, materials: SurfaceMaterials): DoorsView => {
  const group = new THREE.Group();
  group.name = "doors";
  const metal = materials.get(Surface.Metal);
  const views: DoorView[] = level.doors.map((door) => {
    const gap = doorGap(door.kind) - 0.04;
    const root = new THREE.Group();
    const cx = door.vertical ? (door.cx + 1) * CELL : (door.cx + 0.5) * CELL;
    const cz = door.vertical ? (door.cy + 0.5) * CELL : (door.cy + 1) * CELL;
    root.position.set(cx, 0, cz);
    if (door.vertical) root.rotation.y = Math.PI / 2;
    group.add(root);
    const sign = swingSign(level, door) * (door.vertical ? -1 : 1);
    const material = materials.get(door.kind === DoorKind.Wood ? Surface.DoorWood : Surface.DoorMetal);
    const leaves: DoorView["leaves"] = [];
    if (door.kind === DoorKind.MainGate) {
      const half = gap / 2;
      for (const side of [-1, 1]) {
        const pivot = new THREE.Group();
        pivot.position.x = side * gap / 2;
        const leaf = makeLeaf(half, material, true, metal);
        if (side > 0) leaf.scale.x = -1;
        pivot.add(leaf);
        root.add(pivot);
        leaves.push({ pivot, sign: side });
      }
    } else {
      const pivot = new THREE.Group();
      pivot.position.x = -gap / 2;
      pivot.add(makeLeaf(gap, material, false, metal));
      root.add(pivot);
      leaves.push({ pivot, sign });
    }
    const lockMarks: THREE.Object3D[] = [];
    if (door.lock !== null) {
      const mat = lockMaterial(KEY_HEX[door.lock]);
      for (const face of [-1, 1]) {
        const plate = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.2, 0.03), mat);
        plate.position.set(gap / 2 - 0.16, 1.05, face * (LEAF_THICKNESS / 2 + 0.02));
        root.add(plate);
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(gap * 0.92, 0.05, 0.012), mat);
        stripe.position.set(0, 1.55, face * (LEAF_THICKNESS / 2 + 0.01));
        root.add(stripe);
        lockMarks.push(plate, stripe);
      }
    }
    let chains: THREE.Object3D | null = null;
    if (door.kind === DoorKind.MainGate) {
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), lockMaterial("#ff2a1a"));
      lamp.position.set(0, DOOR_HEIGHT + 0.3, 0.25);
      root.add(lamp);
      const chainGroup = new THREE.Group();
      for (let i = 0; i < 2; i += 1) {
        const chain = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.025, 6, 18), metal);
        chain.position.set(0, 1.0 + i * 0.12, (i === 0 ? 1 : -1) * 0.06);
        chain.rotation.set(Math.PI / 2, 0, 0.6 - i * 1.2);
        chainGroup.add(chain);
      }
      root.add(chainGroup);
      chains = chainGroup;
    }
    return { leaves, lockMarks, chains };
  });

  const update = (doors: DoorState[]): void => {
    views.forEach((view, id) => {
      const state = doors[id];
      if (!state) return;
      const eased = state.open * state.open * (3 - 2 * state.open);
      for (const leaf of view.leaves) leaf.pivot.rotation.y = -leaf.sign * eased * SWING;
      const showLock = state.locked && state.open < 0.05;
      for (const mark of view.lockMarks) mark.visible = showLock;
      if (view.chains) view.chains.visible = !(state.open > 0.05);
    });
  };
  return { group, update };
};
