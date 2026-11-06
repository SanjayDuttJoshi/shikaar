import * as THREE from "three";
import { Quality } from "@/types/render";
import { Theme } from "@/types/world";
import type { Level, MonsterKind } from "@/types/world";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { WorldState } from "@/types/game";
import { QUALITY_SETTINGS } from "@/lib/quality";
import { buildDecalsView } from "@/render3d/decals-view";
import { buildDoorsView } from "@/render3d/doors-view";
import { buildItemsView } from "@/render3d/items-view";
import { buildLevelMesh } from "@/render3d/level-mesh";
import { buildLightsView } from "@/render3d/lights-view";
import { createSurfaceMaterials } from "@/render3d/materials";
import type { SurfaceMaterials } from "@/render3d/materials";
import { buildMonstersView } from "@/render3d/monster-view";
import type { MonsterBodyFactory } from "@/render3d/monster-view";
import { createPostFx } from "@/render3d/post-fx";
import type { FxParams } from "@/render3d/post-fx";
import { buildPropsView } from "@/render3d/props-view";
import { buildPlayersView } from "@/render3d/players-view";
import type { MateInfo } from "@/render3d/players-view";
import { buildSetPiecesView } from "@/render3d/set-pieces-view";
import { animatedProps } from "@/world/set-pieces";
import type { PropModels } from "@/render3d/props-view";
import { createSky } from "@/render3d/sky";
import { createSurfaceProbe } from "@/render3d/surface-probe";
import { createTorch } from "@/render3d/torch";

export interface EyePose {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  roll: number;
}

export interface FrameInput {
  state: WorldState;
  eye: EyePose;
  torchOn: boolean;
  battery: number;
  flash: number;
  /** Torch in hand is drawn only while walking around (not hidden, downed or dead). */
  showHand: boolean;
  /** Furniture the player is hiding inside (not drawn), or -1. */
  insideProp: number;
  /** Whose eyes we look through (their own body isn't drawn). */
  viewer?: string;
  fx: FxParams;
  dt: number;
  t: number;
}

export interface SceneView {
  renderer: THREE.WebGLRenderer;
  materials: SurfaceMaterials;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  frame: (input: FrameInput) => void;
  resize: (w: number, h: number) => void;
  setBrightness: (b: number) => void;
  dispose: () => void;
}

export interface SceneAssets {
  propModels: PropModels;
  monsters: Record<MonsterKind, MonsterBodyFactory>;
  /** Extra rigged/static models for scripted scares, by file name (cat, rooster, corpse...). */
  extras: Map<string, GLTF>;
}

const BASE_EXPOSURE = 1.1;

const FOG: Record<Theme, { color: number; density: number }> = {
  [Theme.Asylum]: { color: 0x020303, density: 0.062 },
  [Theme.Haveli]: { color: 0x020206, density: 0.05 },
};

/** `mates` are the other squad members to draw (empty when playing alone). */
export const createSceneView = (canvas: HTMLCanvasElement, level: Level, quality: Quality, assets: SceneAssets, mates: MateInfo[] = []): SceneView => {
  const settings = QUALITY_SETTINGS[quality];
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: settings.antialias, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, settings.pixelRatio));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = BASE_EXPOSURE;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = settings.torchShadow > 0;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const fog = FOG[level.theme];
  scene.fog = new THREE.FogExp2(fog.color, fog.density);
  scene.background = new THREE.Color(fog.color);

  const camera = new THREE.PerspectiveCamera(72, 1, 0.05, settings.drawDistance + 140);
  camera.rotation.order = "YXZ";
  scene.add(camera);

  const materials = createSurfaceMaterials(level.theme, quality, renderer.capabilities.getMaxAnisotropy());
  scene.add(buildLevelMesh(level, materials));
  const doors = buildDoorsView(level, materials);
  scene.add(doors.group);
  const props = buildPropsView(level, materials, assets.propModels, animatedProps(level.setPieces, level.props));
  scene.add(props.group);
  const pieces = buildSetPiecesView(level, assets.extras);
  scene.add(pieces.group);
  scene.add(buildDecalsView(level, quality === Quality.Low ? 4 : 7));
  const lights = buildLightsView(level, settings.lightPool, quality === Quality.High);
  scene.add(lights.group);
  const items = buildItemsView(level, createSurfaceProbe(props.group));
  scene.add(items.group);
  const monsters = buildMonstersView(level.monsterSpawns, assets.monsters);
  scene.add(monsters.group);
  const players = mates.length > 0 ? buildPlayersView(mates, assets.extras, settings.mateTorches) : null;
  if (players) scene.add(players.group);
  scene.add(createSky());

  scene.add(new THREE.HemisphereLight(0x3a4250, 0x0a0806, level.theme === Theme.Haveli ? 0.3 : 0.24));
  const eyeFill = new THREE.PointLight(0x9aa6b8, 0.9, 6.5, 2);
  camera.add(eyeFill);
  const torch = createTorch(settings.torchShadow);
  scene.add(torch.light, torch.light.target);
  camera.add(torch.hand);

  const fx = settings.postFx ? createPostFx(renderer, scene, camera) : null;
  const eyeVec = new THREE.Vector3();

  const frame = (input: FrameInput): void => {
    const { eye, state } = input;
    camera.position.set(eye.x, eye.y, eye.z);
    camera.rotation.set(eye.pitch, eye.yaw, eye.roll);
    camera.updateMatrixWorld();
    eyeVec.set(eye.x, eye.y, eye.z);
    doors.update(state.doors);
    props.setHidden(input.insideProp);
    items.update(state.items, input.t);
    monsters.update(state.monsters, input.dt, input.t);
    players?.update(state.players, eyeVec, input.dt, input.viewer ?? "");
    pieces.update(state.setPieces, input.t, input.dt, eyeVec);
    lights.update(eyeVec, input.t, state.lightsBurst, state.lightsBurstAt, state.powerOn);
    torch.update(camera, input.torchOn, input.battery, input.flash, input.t, input.dt);
    torch.hand.visible = input.showHand;
    if (fx) fx.render(input.fx, input.t);
    else renderer.render(scene, camera);
  };

  const resize = (w: number, h: number): void => {
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
    fx?.resize(w, h);
  };

  const dispose = (): void => {
    fx?.dispose();
    materials.dispose();
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
    });
    renderer.dispose();
  };

  const setBrightness = (b: number): void => {
    renderer.toneMappingExposure = BASE_EXPOSURE * b;
  };

  return { renderer, materials, scene, camera, frame, resize, setBrightness, dispose };
};
