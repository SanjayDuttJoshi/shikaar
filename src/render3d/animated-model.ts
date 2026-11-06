import * as THREE from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";

export interface AnimatedModel {
  root: THREE.Group;
  /** Cross-fades to the first clip whose name contains one of `names` (case-insensitive). */
  play: (names: string[], rate?: number, once?: boolean) => void;
  update: (dt: number) => void;
  findNode: (name: string) => THREE.Object3D | null;
}

export interface AnimatedOptions {
  /** Target height in metres (uniform scale). */
  height: number;
  /** Rotation that makes the model face +Z. */
  facingYaw?: number;
  /** Multiplies base colours (1 = untouched). */
  darken?: number;
  castShadow?: boolean;
}

const FADE = 0.2;

const tint = (m: THREE.Material, darken: number): THREE.Material => {
  if (darken >= 1) return m;
  const c = m.clone() as THREE.MeshStandardMaterial;
  if (c.color) c.color.multiplyScalar(darken);
  return c;
};

/** A fresh, independently animated copy of a rigged glTF model standing on the origin. */
export const createAnimated = (gltf: GLTF, opts: AnimatedOptions): AnimatedModel => {
  const box = new THREE.Box3().setFromObject(gltf.scene);
  const height = Math.max(0.05, box.max.y - box.min.y);
  const scale = opts.height / height;
  const root = new THREE.Group();
  const body = cloneSkinned(gltf.scene);
  body.rotation.y = opts.facingYaw ?? 0;
  body.scale.setScalar(scale);
  body.position.y = -box.min.y * scale;
  root.add(body);
  const darken = opts.darken ?? 1;
  body.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = opts.castShadow ?? true;
    mesh.frustumCulled = false;
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map((m) => tint(m, darken)) : tint(mesh.material, darken);
  });
  const mixer = new THREE.AnimationMixer(body);
  const actions = new Map<string, THREE.AnimationAction>();
  let current: THREE.AnimationAction | null = null;
  const clipFor = (names: string[]): THREE.AnimationClip | null => {
    for (const n of names) {
      const hit = gltf.animations.find((c) => c.name.toLowerCase() === n.toLowerCase()) ?? gltf.animations.find((c) => c.name.toLowerCase().includes(n.toLowerCase()));
      if (hit) return hit;
    }
    return null;
  };
  const play = (names: string[], rate = 1, once = false): void => {
    const clip = clipFor(names);
    if (!clip) return;
    let action = actions.get(clip.name);
    if (!action) {
      action = mixer.clipAction(clip);
      actions.set(clip.name, action);
    }
    action.timeScale = rate;
    if (action === current) return;
    action.reset();
    action.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity);
    action.clampWhenFinished = once;
    action.fadeIn(FADE).play();
    current?.fadeOut(FADE);
    current = action;
  };
  const findNode = (name: string): THREE.Object3D | null => body.getObjectByName(name) ?? null;
  return { root, play, update: (dt) => mixer.update(dt), findNode };
};
