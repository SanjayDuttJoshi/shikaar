import * as THREE from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { PlayerStatus, Stance } from "@/types/game";
import type { PlayerState } from "@/types/game";
import { createAnimated } from "@/render3d/animated-model";
import type { AnimatedModel } from "@/render3d/animated-model";
import { createNameTag } from "@/render3d/name-tag";
import type { NameTag } from "@/render3d/name-tag";
import { forwardOf } from "@/game/player-motion";
import { SQUAD_COLORS, survivorFor } from "@/lib/squad";

export interface MateInfo {
  id: string;
  name: string;
  color: number;
}

export interface PlayersView {
  group: THREE.Group;
  /** `viewer` is the squad member whose eyes the camera uses (not drawn). */
  update: (players: PlayerState[], eye: THREE.Vector3, dt: number, viewer: string) => void;
}

interface Mate {
  info: MateInfo;
  body: AnimatedModel | null;
  root: THREE.Group;
  lens: THREE.Mesh;
  glow: THREE.Sprite;
  tag: NameTag;
}

/** Soft round glare for a torch pointed your way. */
const glowTexture = (): THREE.CanvasTexture => {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const g = canvas.getContext("2d");
  if (g) {
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, "rgba(255,248,230,0.95)");
    grad.addColorStop(0.08, "rgba(255,236,200,0.6)");
    grad.addColorStop(0.3, "rgba(255,215,160,0.14)");
    grad.addColorStop(1, "rgba(255,200,140,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
  }
  return new THREE.CanvasTexture(canvas);
};

const BODY_HEIGHT = 1.74;
const HAND = new THREE.Vector3(0.24, 1.22, -0.32);
const TORCH_REACH = 26;
const RUN_SPEED = 3.2;
const WALK_CLIP_SPEED = 1.5;
const NEAR_HIDE = 0.55;

const animate = (mate: Mate, p: PlayerState): void => {
  const body = mate.body;
  if (!body) return;
  const speed = Math.hypot(p.vx, p.vz);
  if (p.status === PlayerStatus.Dead) body.play(["Death"], 1, true);
  else if (p.status === PlayerStatus.Downed) body.play(["Downed"]);
  else if (p.stance === Stance.Crouch) body.play(speed > 0.3 ? ["CrouchWalk"] : ["CrouchIdle"]);
  else if (speed > RUN_SPEED) body.play(["Sprint", "Run"]);
  else if (speed > 0.3) body.play(["Walk"], Math.max(0.6, speed / WALK_CLIP_SPEED));
  else body.play(p.torchOn ? ["IdleFlashlight", "Idle"] : ["Idle"]);
};

/** Squad members as seen by you: their character, the torch in their hand and their name. */
export const buildPlayersView = (mates: MateInfo[], extras: Map<string, GLTF>, torchLights: number): PlayersView => {
  const group = new THREE.Group();
  const lensMaterial = new THREE.MeshBasicMaterial({ color: 0xfff1d0 });
  const lensGeometry = new THREE.SphereGeometry(0.045, 10, 8);
  const glowMap = glowTexture();
  const list: Mate[] = mates.map((info) => {
    const gltf = extras.get(`survivor:${survivorFor(info.color)}`);
    const body = gltf ? createAnimated(gltf, { height: BODY_HEIGHT, darken: 0.9 }) : null;
    const root = new THREE.Group();
    if (body) root.add(body.root);
    else root.add(new THREE.Mesh(new THREE.CapsuleGeometry(0.25, 1.2, 4, 10), new THREE.MeshStandardMaterial({ color: 0x5a5048, roughness: 0.9 })));
    const lens = new THREE.Mesh(lensGeometry, lensMaterial);
    lens.position.copy(HAND);
    root.add(lens);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowMap, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    glow.position.copy(HAND);
    root.add(glow);
    const tag = createNameTag(info.name, SQUAD_COLORS[info.color % SQUAD_COLORS.length] ?? 0xffffff);
    group.add(root, tag.sprite);
    return { info, body, root, lens, glow, tag };
  });

  // A fixed number of lights from the start: adding lights later would recompile every shader.
  const lights = Array.from({ length: torchLights }, () => {
    const light = new THREE.SpotLight(0xffe7c2, 0, 16, 0.42, 0.65, 1.6);
    group.add(light, light.target);
    return light;
  });
  const hand = new THREE.Vector3();

  const update = (players: PlayerState[], eye: THREE.Vector3, dt: number, viewer: string): void => {
    const lit: Array<{ mate: Mate; p: PlayerState; d: number }> = [];
    for (const mate of list) {
      const p = players.find((q) => q.id === mate.info.id);
      const shown = !!p && p.id !== viewer && p.status !== PlayerStatus.Hiding && p.status !== PlayerStatus.Escaped;
      mate.root.visible = shown;
      if (!p || !shown) {
        mate.tag.sprite.visible = false;
        continue;
      }
      const d = Math.hypot(p.x - eye.x, p.z - eye.z);
      // Standing inside someone's head shows the inside of their face: skip the body that close.
      mate.root.visible = d > NEAR_HIDE;
      mate.root.position.set(p.x, 0, p.z);
      mate.root.rotation.y = p.yaw + Math.PI;
      animate(mate, p);
      mate.body?.update(dt);
      const torch = p.torchOn && p.status === PlayerStatus.Alive;
      mate.lens.visible = torch;
      mate.glow.visible = torch;
      if (torch) {
        // Brightest when the torch points at you.
        const f = forwardOf(p.yaw);
        const toEye = Math.max(0, (f.x * (eye.x - p.x) + f.z * (eye.z - p.z)) / Math.max(d, 0.01));
        (mate.glow.material as THREE.SpriteMaterial).opacity = 0.1 + toEye * toEye * 0.6;
        mate.glow.scale.setScalar(0.3 + toEye * 0.6);
      }
      mate.tag.update(p, d);
      if (torch && d < TORCH_REACH) lit.push({ mate, p, d });
    }
    lit.sort((a, b) => a.d - b.d);
    lights.forEach((light, i) => {
      const pick = lit[i];
      if (!pick) {
        light.intensity = 0;
        return;
      }
      pick.mate.root.updateMatrixWorld();
      hand.copy(HAND).applyMatrix4(pick.mate.root.matrixWorld);
      light.position.copy(hand);
      const f = forwardOf(pick.p.yaw);
      const c = Math.cos(pick.p.pitch);
      light.target.position.set(hand.x + f.x * c * 5, hand.y + Math.sin(pick.p.pitch) * 5, hand.z + f.z * c * 5);
      light.target.updateMatrixWorld();
      light.intensity = 9 * Math.min(1, pick.p.battery / 20 + 0.3);
    });
  };

  return { group, update };
};
