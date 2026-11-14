import * as THREE from "three";
import { PlayerStatus } from "@/types/game";
import type { PlayerState } from "@/types/game";

export interface NameTag {
  sprite: THREE.Sprite;
  /** Follows the player; a downed friend's tag turns red and shows through walls so you can find them. */
  update: (p: PlayerState, distance: number) => void;
}

const TAG_HEIGHT = 2.05;
const FADE_FROM = 10;
const FADE_TO = 22;
/** Up close you can see the friend anyway, so the tag shrinks and fades instead of filling the screen. */
const NEAR_HIDE = 0.9;
const NEAR_FULL = 2;
const NEAR_SHRINK = 4;

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

const draw = (name: string, color: string, alarm: boolean): THREE.CanvasTexture => {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const g = canvas.getContext("2d");
  if (g) {
    g.font = "600 54px Georgia, serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.lineWidth = 10;
    g.strokeStyle = "rgba(0,0,0,0.85)";
    const text = alarm ? `⚠ ${name} — uthao!` : name;
    g.strokeText(text, 256, 64, 500);
    g.fillStyle = alarm ? "#ff5a48" : color;
    g.fillText(text, 256, 64, 500);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
};

export const createNameTag = (name: string, color: number): NameTag => {
  const css = `#${color.toString(16).padStart(6, "0")}`;
  const normal = draw(name, css, false);
  const alarm = draw(name, css, true);
  const material = new THREE.SpriteMaterial({ map: normal, transparent: true, depthTest: true, fog: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(1.3, 0.325, 1);
  sprite.renderOrder = 5;
  let downed = false;
  return {
    sprite,
    update: (p, distance) => {
      const nowDowned = p.status === PlayerStatus.Downed;
      if (nowDowned !== downed) {
        downed = nowDowned;
        material.map = downed ? alarm : normal;
        material.depthTest = !downed;
        material.needsUpdate = true;
        sprite.renderOrder = downed ? 50 : 5;
      }
      sprite.visible = p.status === PlayerStatus.Alive || downed;
      sprite.position.set(p.x, downed ? 0.9 : TAG_HEIGHT, p.z);
      const far = 1 - clamp01((distance - FADE_FROM) / (FADE_TO - FADE_FROM));
      const near = clamp01((distance - NEAR_HIDE) / (NEAR_FULL - NEAR_HIDE));
      material.opacity = downed ? 0.9 : 0.9 * far * near;
      // A downed friend's tag keeps roughly the same size on screen near or far.
      const grow = downed ? Math.min(5, Math.max(0.4, distance / 8)) : Math.min(1, Math.max(0.45, distance / NEAR_SHRINK));
      sprite.scale.set(1.3 * grow, 0.325 * grow, 1);
    },
  };
};
