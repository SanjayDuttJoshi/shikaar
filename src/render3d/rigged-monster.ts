import * as THREE from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MonsterMode } from "@/types/game";
import { MonsterKind } from "@/types/world";
import { createAnimated } from "@/render3d/animated-model";
import type { MonsterBodyFactory } from "@/render3d/monster-view";

interface KindLook {
  height: number;
  darken: number;
  /** Walk/run playback speed per m/s of movement. */
  stride: number;
  lantern: boolean;
}

const LOOK: Record<MonsterKind, KindLook> = {
  [MonsterKind.Shikari]: { height: 2.3, darken: 0.6, stride: 1.6, lantern: true },
  [MonsterKind.Chudail]: { height: 1.88, darken: 0.9, stride: 1.4, lantern: false },
  [MonsterKind.Mareez]: { height: 1.95, darken: 0.8, stride: 1.5, lantern: false },
};

export interface Lantern {
  group: THREE.Group;
  light: THREE.PointLight;
  flame: THREE.MeshBasicMaterial;
  /** Ordinary kerosene glow (people in the story films) instead of the monster's red. */
  warm: boolean;
}

/** The Chowkidar's lantern: a small red-glass lamp with a flickering red light that warns you he's near. */
export const makeLantern = (warm = false): Lantern => {
  const group = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0x2a2420, roughness: 0.6, metalness: 0.7 });
  const flame = new THREE.MeshBasicMaterial({ color: warm ? 0xffb050 : 0xff3a18, toneMapped: false });
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.14, 10), flame);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.075, 0.04, 10), metal);
  cap.position.y = 0.09;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.03, 10), metal);
  base.position.y = -0.085;
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.006, 4, 12, Math.PI), metal);
  handle.position.y = 0.12;
  group.add(glass, cap, base, handle);
  const light = new THREE.PointLight(warm ? 0xffa050 : 0xff3010, 2.6, 7, 2);
  group.add(light);
  return { group, light, flame, warm };
};

/** Flickers the lantern; shared by the rigged and the procedural Shikari. */
export const flickerLantern = (lantern: Lantern, t: number, stunned: boolean): void => {
  const f = 0.75 + 0.25 * Math.sin(t * 23) * Math.sin(t * 7.3) + (Math.random() - 0.5) * 0.15;
  lantern.light.intensity = 2.6 * f * (stunned ? 0.3 : 1);
  if (lantern.warm) lantern.flame.color.setRGB(1.7 * f, 1.0 * f, 0.4 * f);
  else lantern.flame.color.setRGB(1.6 * f, 0.25 * f, 0.08);
};

/**
 * A monster from a rigged model: per-kind size and tint, stock clips played with a twitchy rate so
 * the motion never looks quite human, and the Shikari's red lantern swinging from its hand.
 */
export const createRiggedMonster = (gltf: GLTF, kind: MonsterKind, facingYaw: number): MonsterBodyFactory => () => {
  const look = LOOK[kind];
  const model = createAnimated(gltf, { height: look.height, darken: look.darken, facingYaw });
  let lantern: Lantern | null = null;
  if (look.lantern) {
    lantern = makeLantern();
    const own = model.findNode("LanternFlame") ?? model.findNode("Lantern");
    const hand = model.findNode("hand_l");
    if (own) {
      own.add(lantern.light);
    } else if (hand) {
      const s = 1 / Math.max(0.01, hand.getWorldScale(new THREE.Vector3()).x);
      lantern.group.scale.setScalar(s);
      lantern.group.position.set(0, -0.12 * s, 0);
      hand.add(lantern.group);
    } else {
      lantern.group.position.set(0.35, 0.9, 0.15);
      model.root.add(lantern.group);
    }
  }
  let jitter = 0;
  const animate = (mode: MonsterMode, speed: number, dt: number, t: number): void => {
    jitter -= dt;
    const twitch = jitter <= 0 ? 0.6 + Math.random() * 0.9 : 1;
    if (jitter <= 0) jitter = 0.08 + Math.random() * 0.4;
    if (mode === MonsterMode.Attack) model.play(["Attack", "AttackPunch"], 1.4);
    else if (mode === MonsterMode.Stunned) model.play(["HitReact", "Idle"], 1.6);
    else if (speed > 3) model.play(["Run", "Sprint", "Walk"], (speed / 4.5) * look.stride * 0.6 * twitch);
    else if (speed > 0.2) model.play(["Walk"], (speed / 1.6) * look.stride * 0.6 * twitch);
    else if (mode === MonsterMode.Search || mode === MonsterMode.Investigate) model.play(["Listen", "IdleAlert", "Idle"], 0.9 * twitch);
    else model.play(["Idle"], 0.8 * twitch);
    model.update(dt);
    if (lantern) flickerLantern(lantern, t, mode === MonsterMode.Stunned);
  };
  return { root: model.root, animate };
};
