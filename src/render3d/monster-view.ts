import * as THREE from "three";
import { MonsterMode } from "@/types/game";
import type { MonsterState } from "@/types/game";
import { MonsterKind } from "@/types/world";
import type { MonsterSpawn } from "@/types/world";
import { flickerLantern, makeLantern } from "@/render3d/rigged-monster";

/** An animated monster body: either a loaded rigged model or the procedural stand-in. */
export interface MonsterBody {
  root: THREE.Object3D;
  /** Advances animation. `speed` in m/s. */
  animate: (mode: MonsterMode, speed: number, dt: number, t: number) => void;
}

export type MonsterBodyFactory = () => MonsterBody;

const skin = (): THREE.MeshStandardMaterial =>
  new THREE.MeshStandardMaterial({ color: 0x0d0a09, roughness: 0.82, metalness: 0.0 });

const limb = (length: number, radius: number, material: THREE.Material): { pivot: THREE.Group; mesh: THREE.Mesh } => {
  const pivot = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius, length, 4, 8), material);
  mesh.position.y = -length / 2;
  mesh.castShadow = true;
  pivot.add(mesh);
  return { pivot, mesh };
};

/**
 * Tall, too-thin figure with long arms and a hanging head. Joints jitter a little every
 * frame so the movement never looks quite human.
 */
export const proceduralMonster = (kind: MonsterKind): MonsterBodyFactory => () => {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const mat = skin();
  const ragColor = kind === MonsterKind.Chudail ? 0xcfc8b8 : kind === MonsterKind.Mareez ? 0x6f7f84 : 0x1a1714;
  const rag = new THREE.MeshStandardMaterial({ color: ragColor, roughness: 1 });
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.75, 4, 10), rag);
  torso.position.y = 1.55;
  torso.rotation.x = 0.25;
  torso.castShadow = true;
  body.add(torso);
  const neck = new THREE.Group();
  neck.position.set(0, 2.0, 0.12);
  body.add(neck);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 14, 10), mat);
  head.scale.set(0.85, 1.25, 0.95);
  head.position.set(0, 0.1, 0.1);
  head.castShadow = true;
  neck.add(head);
  // A pale, cracked face on a black body: under a torch it is the first thing you see.
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), new THREE.MeshStandardMaterial({ color: 0xd9d0c2, roughness: 0.45 }));
  face.scale.set(0.95, 1.3, 0.55);
  face.position.set(0, 0.1, 0.17);
  neck.add(face);
  const hole = new THREE.MeshBasicMaterial({ color: 0x000000 });
  for (const side of [-1, 1]) {
    const socket = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), hole);
    socket.scale.set(1, 1.35, 0.5);
    socket.position.set(side * 0.048, 0.15, 0.235);
    neck.add(socket);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.007, 6, 4), new THREE.MeshBasicMaterial({ color: 0xff2a10, toneMapped: false }));
    pupil.position.set(side * 0.048, 0.15, 0.25);
    neck.add(pupil);
  }
  const jaw = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), hole);
  jaw.scale.set(2.6, 0.35, 0.5);
  jaw.position.set(0, 0.0, 0.222);
  neck.add(jaw);
  if (kind === MonsterKind.Chudail) {
    const hair = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.9, 4, 10), new THREE.MeshStandardMaterial({ color: 0x050405, roughness: 0.5 }));
    hair.position.set(0, -0.3, 0.12);
    neck.add(hair);
  }
  if (kind === MonsterKind.Mareez) {
    const bandage = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.035, 6, 18), new THREE.MeshStandardMaterial({ color: 0x8a2a20, roughness: 0.9 }));
    bandage.rotation.x = Math.PI / 2;
    bandage.position.set(0, 0.15, 0.1);
    neck.add(bandage);
  }
  const lantern = kind === MonsterKind.Shikari ? makeLantern() : null;
  const arms = [-1, 1].map((side) => {
    const shoulder = limb(0.55, 0.045, mat);
    shoulder.pivot.position.set(side * 0.24, 1.88, 0.08);
    const fore = limb(0.6, 0.038, mat);
    fore.pivot.position.y = -0.62;
    shoulder.pivot.add(fore.pivot);
    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.2, 0.03), mat);
    hand.position.y = -0.72;
    fore.pivot.add(hand);
    body.add(shoulder.pivot);
    if (lantern && side < 0) {
      lantern.group.position.y = -0.85;
      fore.pivot.add(lantern.group);
    }
    return { upper: shoulder.pivot, lower: fore.pivot, side };
  });
  const legs = [-1, 1].map((side) => {
    const thigh = limb(0.55, 0.06, mat);
    thigh.pivot.position.set(side * 0.12, 1.15, 0);
    const shin = limb(0.55, 0.05, mat);
    shin.pivot.position.y = -0.6;
    thigh.pivot.add(shin.pivot);
    body.add(thigh.pivot);
    return { upper: thigh.pivot, lower: shin.pivot, side };
  });
  let phase = 0;
  let jitterT = 0;
  const jitter = { head: 0, arm: 0 };

  const animate = (mode: MonsterMode, speed: number, dt: number, t: number): void => {
    phase += speed * dt * 2.4;
    jitterT -= dt;
    if (jitterT <= 0) {
      jitterT = 0.05 + Math.random() * 0.25;
      jitter.head = (Math.random() - 0.5) * (mode === MonsterMode.Chase ? 0.5 : 0.25);
      jitter.arm = (Math.random() - 0.5) * 0.3;
    }
    const swing = Math.min(1, speed / 2.5);
    for (const leg of legs) {
      const s = Math.sin(phase + (leg.side > 0 ? Math.PI : 0));
      leg.upper.rotation.x = s * 0.7 * swing;
      leg.lower.rotation.x = Math.max(0, -Math.cos(phase + (leg.side > 0 ? Math.PI : 0))) * 0.9 * swing;
    }
    const attacking = mode === MonsterMode.Attack;
    const stunned = mode === MonsterMode.Stunned;
    for (const arm of arms) {
      const s = Math.sin(phase + (arm.side > 0 ? 0 : Math.PI));
      arm.upper.rotation.x = attacking ? -1.9 : stunned ? -2.4 : -0.15 + s * 0.45 * swing + jitter.arm;
      arm.upper.rotation.z = arm.side * (stunned ? 0.5 : 0.12);
      arm.lower.rotation.x = attacking ? -0.4 : stunned ? -1.2 : -0.35 - Math.abs(s) * 0.3;
    }
    neck.rotation.z = jitter.head + (stunned ? Math.sin(t * 40) * 0.3 : 0);
    neck.rotation.x = mode === MonsterMode.Search ? 0.5 + Math.sin(t * 2) * 0.2 : mode === MonsterMode.Chase ? -0.2 : 0.35;
    body.rotation.x = mode === MonsterMode.Chase ? 0.28 : 0.08;
    body.position.y = Math.abs(Math.sin(phase)) * 0.05 * swing;
    jaw.scale.y = mode === MonsterMode.Chase || attacking ? 1.3 + Math.sin(t * 20) * 0.25 : 0.35;
    if (lantern) flickerLantern(lantern, t, stunned);
  };
  return { root, animate };
};

export interface MonstersView {
  group: THREE.Group;
  update: (monsters: MonsterState[], dt: number, t: number) => void;
  /** World positions of monster eyes (for the heartbeat/scare logic and sound). */
  positions: () => THREE.Vector3[];
}

export const buildMonstersView = (spawns: MonsterSpawn[], factories: Record<MonsterKind, MonsterBodyFactory>): MonstersView => {
  const group = new THREE.Group();
  group.name = "monsters";
  const bodies = spawns.map((spawn) => {
    const body = factories[spawn.kind]();
    group.add(body.root);
    return { body, x: 0, z: 0, yaw: 0, init: false };
  });
  const update = (monsters: MonsterState[], dt: number, t: number): void => {
    bodies.forEach((b, i) => {
      const m = monsters[i];
      b.body.root.visible = !!m;
      if (!m) return;
      if (!b.init) {
        b.x = m.x;
        b.z = m.z;
        b.yaw = m.yaw;
        b.init = true;
      }
      const k = Math.min(1, dt * 12);
      b.x += (m.x - b.x) * k;
      b.z += (m.z - b.z) * k;
      let dy = m.yaw - b.yaw;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      b.yaw += dy * k;
      b.body.root.position.set(b.x, 0, b.z);
      b.body.root.rotation.y = b.yaw;
      b.body.animate(m.mode, m.speed, dt, t);
    });
  };
  return { group, update, positions: () => bodies.map((b) => b.body.root.position.clone()) };
};
