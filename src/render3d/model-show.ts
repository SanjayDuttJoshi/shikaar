import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { assetUrl } from "@/lib/asset-url";
import { createAnimated } from "@/render3d/animated-model";
import type { AnimatedModel } from "@/render3d/animated-model";
import { flickerLantern, makeLantern } from "@/render3d/rigged-monster";

interface ShowItem {
  file: string;
  title: string;
  sub: string;
  height: number;
  clips: string[];
  lantern?: boolean;
  /** Hangs from a rope instead of standing. */
  hang?: boolean;
  /** Camera distance override for long, low things (a body lying down). */
  camDistance?: number;
}

const SHOW: ShowItem[] = [
  { file: "characters/shikari.glb", title: "Shikari — Chowkidar Bhairav", sub: "Poori building mein ghoomta hai. Laal lalten dikhe toh chhup jao.", height: 2.3, clips: ["Idle", "Walk", "Run", "Attack", "Scream"], lantern: true },
  { file: "characters/mareez.glb", title: "Andha Mareez — Raghu", sub: "Dekh nahi sakta... par har awaaz sunta hai.", height: 1.95, clips: ["Idle", "Listen", "Walk", "Run", "Attack", "Scream", "CrouchIdle"] },
  { file: "characters/chudail.glb", title: "Chudail — Kamla", sub: "Ulte pair, payal ki chhan chhan. Usse zyada der mat dekho.", height: 1.88, clips: ["Idle", "Walk", "Run", "Attack", "Scream", "CrouchIdle"] },
  { file: "props/corpse.glb", title: "Laash", sub: "Achanak chhat se rassi pe girti hai.", height: 1.72, clips: [], hang: true },
  { file: "props/corpse-lying.glb", title: "Farsh pe padi laash", sub: "Haveli ke kamron mein.", height: 0.5, clips: [], camDistance: 3.2 },
  { file: "props/cat.glb", title: "Kaali billi", sub: "Almari ke upar se phuphkaar ke koodti hai.", height: 0.35, clips: ["Idle", "Run", "Jump", "Hiss", "Attack"] },
  { file: "props/rooster.glb", title: "Murga", sub: "Andhere kamre mein achanak phadphadata hai.", height: 0.55, clips: ["Idle", "Crow", "Flutter", "Run"] },
];

const CLIP_LABEL: Record<string, string> = {
  idle: "Khada",
  walk: "Chalna",
  run: "Bhaagna",
  attack: "Hamla",
  scream: "Cheekh",
  crouchidle: "Kone mein baith ke rona",
  jump: "Koodna",
  hiss: "Phuphkaar",
  flap: "Phadphadana",
  flutter: "Phadphadana",
  crow: "Baang",
  listen: "Kaan lagake sunna",
  fly: "Udna",
};

const CLIP_SECONDS = 2.8;
const STATIC_SECONDS = 5;

declare global {
  interface Window {
    __modelShow?: { index: number; done: boolean; title: string };
  }
}

/** Plays every monster and scare model on a dark turntable, one after another, under torch-like light. */
export const startModelShow = async (canvas: HTMLCanvasElement, onCaption: (title: string, sub: string) => void): Promise<() => void> => {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050405);
  scene.fog = new THREE.Fog(0x050405, 6, 16);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 50);
  scene.add(new THREE.HemisphereLight(0x405060, 0x100808, 0.5));
  const key = new THREE.SpotLight(0xfff1dc, 60, 20, 0.5, 0.6, 1.4);
  key.position.set(2.5, 3.5, 4);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  scene.add(key, key.target);
  const rim = new THREE.PointLight(0x8a1810, 18, 8, 2);
  rim.position.set(-2, 2.2, -2.5);
  scene.add(rim);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(6, 48), new THREE.MeshStandardMaterial({ color: 0x1a1614, roughness: 0.95 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  const resize = (): void => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
  };
  resize();
  window.addEventListener("resize", resize);

  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const loaded: Array<{ item: ShowItem; gltf: GLTF }> = [];
  for (const item of SHOW) {
    try {
      loaded.push({ item, gltf: await loader.loadAsync(assetUrl(`models/${item.file}`)) });
    } catch {
      // Missing model: skip it in the show.
    }
  }

  let index = -1;
  let current: { holder: THREE.Group; anim: AnimatedModel | null; item: ShowItem; clips: string[]; started: number; lantern: ReturnType<typeof makeLantern> | null } | null = null;
  const show = (i: number, t: number): void => {
    if (current) scene.remove(current.holder);
    const { item, gltf } = loaded[i];
    const holder = new THREE.Group();
    let anim: AnimatedModel | null = null;
    let lantern: ReturnType<typeof makeLantern> | null = null;
    const clips = item.clips.filter((c) => gltf.animations.some((a) => a.name.toLowerCase().includes(c.toLowerCase())));
    if (gltf.animations.length > 0) {
      anim = createAnimated(gltf, { height: item.height });
      holder.add(anim.root);
      if (item.lantern) {
        lantern = makeLantern();
        const hand = anim.findNode("Lantern") ?? anim.findNode("hand_l");
        if (anim.findNode("Lantern")) anim.findNode("Lantern")?.add(lantern.light);
        else if (hand) {
          const s = 1 / Math.max(0.01, hand.getWorldScale(new THREE.Vector3()).x);
          lantern.group.scale.setScalar(s);
          hand.add(lantern.group);
        }
      }
    } else {
      const model = gltf.scene.clone(true);
      const box = new THREE.Box3().setFromObject(model);
      const s = item.height / Math.max(0.01, box.max.y - box.min.y);
      model.scale.setScalar(s);
      model.position.y = item.hang ? 2.6 - box.max.y * s : -box.min.y * s;
      model.traverse((o) => {
        o.castShadow = true;
      });
      holder.add(model);
      if (item.hang) {
        const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1, 6), new THREE.MeshStandardMaterial({ color: 0x8a7a5a }));
        rope.position.y = 3.1;
        holder.add(rope);
      }
    }
    scene.add(holder);
    current = { holder, anim, item, clips, started: t, lantern };
    window.__modelShow = { index: i, done: false, title: item.title };
  };

  let last = performance.now();
  let raf = 0;
  const clock = { t: 0 };
  const durationOf = (i: number): number => {
    const { item, gltf } = loaded[i];
    const clips = item.clips.filter((c) => gltf.animations.some((a) => a.name.toLowerCase().includes(c.toLowerCase())));
    return clips.length > 0 ? clips.length * CLIP_SECONDS : STATIC_SECONDS;
  };
  let segmentEnd = 0;
  const frame = (now: number): void => {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    clock.t += dt;
    if (loaded.length === 0) return;
    if (clock.t >= segmentEnd) {
      index += 1;
      if (index >= loaded.length) {
        window.__modelShow = { index, done: true, title: "" };
        index = loaded.length - 1;
        segmentEnd = Number.POSITIVE_INFINITY;
      } else {
        show(index, clock.t);
        segmentEnd = clock.t + durationOf(index);
      }
    }
    if (!current) return;
    const local = clock.t - current.started;
    const clipIndex = Math.min(current.clips.length - 1, Math.floor(local / CLIP_SECONDS));
    const clip = current.clips[clipIndex];
    if (clip && current.anim) current.anim.play([clip], 1, clip === "Attack" || clip === "Scream" || clip === "Jump" || clip === "Crow");
    current.anim?.update(dt);
    if (current.lantern) flickerLantern(current.lantern, clock.t, false);
    current.holder.rotation.y = -0.6 + local * 0.35;
    const h = current.item.hang ? 2.4 : current.item.height;
    const dist = current.item.camDistance ?? Math.max(1.4, h * 1.9);
    camera.position.set(Math.sin(0.25) * dist, current.item.camDistance ? 1.6 : h * 0.62 + 0.2, Math.cos(0.25) * dist);
    camera.lookAt(0, current.item.hang ? 1.7 : h * 0.5, 0);
    key.target.position.set(0, h * 0.5, 0);
    onCaption(current.item.title, clip ? `${current.item.sub}  ·  ${CLIP_LABEL[clip.toLowerCase()] ?? clip}` : current.item.sub);
    renderer.render(scene, camera);
  };
  raf = requestAnimationFrame(frame);
  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener("resize", resize);
    renderer.dispose();
  };
};
