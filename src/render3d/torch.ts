import * as THREE from "three";
import { BATTERY_LOW } from "@/game/constants";

const RANGE = 26;
const BASE_INTENSITY = 50;
const FLASH_BOOST = 9;

/** Soft hot-spot with a ring and smudges, like a cheap old torch lens. */
const cookieTexture = (): THREE.Texture => {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext("2d") as CanvasRenderingContext2D;
  const c = size / 2;
  const grad = g.createRadialGradient(c, c, 0, c, c, c);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.18, "rgba(255,250,240,0.95)");
  grad.addColorStop(0.32, "rgba(200,195,185,0.55)");
  grad.addColorStop(0.42, "rgba(240,235,225,0.7)");
  grad.addColorStop(0.5, "rgba(120,118,112,0.35)");
  grad.addColorStop(0.85, "rgba(40,40,40,0.12)");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  g.filter = "blur(6px)";
  for (let i = 0; i < 10; i += 1) {
    const a = (i / 10) * Math.PI * 2 + Math.sin(i * 7.3) * 0.4;
    const r = c * (0.12 + ((i * 37) % 30) / 100);
    g.fillStyle = `rgba(0,0,0,${0.03 + ((i * 13) % 10) / 300})`;
    g.beginPath();
    g.arc(c + Math.cos(a) * r, c + Math.sin(a) * r, 10 + ((i * 11) % 12), 0, Math.PI * 2);
    g.fill();
  }
  g.filter = "none";
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
};

export interface TorchView {
  light: THREE.SpotLight;
  /** The torch in your hand, bottom-right of the view (attach to the camera). */
  hand: THREE.Group;
  update: (camera: THREE.Camera, on: boolean, battery: number, flash: number, t: number, dt: number) => void;
}

/**
 * The player's flashlight: a shadow-casting spot with a lens cookie, hanging slightly
 * right/below the eye and lagging behind head turns so it feels hand-held.
 */
export const createTorch = (shadowSize: number): TorchView => {
  const light = new THREE.SpotLight(0xfff1dc, BASE_INTENSITY, RANGE, 0.5, 0.55, 1.6);
  light.map = cookieTexture();
  light.castShadow = shadowSize > 0;
  if (shadowSize > 0) {
    light.shadow.mapSize.set(shadowSize, shadowSize);
    light.shadow.bias = -0.0006;
    light.shadow.normalBias = 0.02;
    light.shadow.camera.near = 0.2;
    light.shadow.camera.far = RANGE;
  }
  const hand = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.022, 0.026, 0.24, 12),
    new THREE.MeshStandardMaterial({ color: 0x1c1c1e, roughness: 0.45, metalness: 0.7 }),
  );
  body.rotation.x = Math.PI / 2;
  const head = new THREE.Mesh(
    new THREE.CylinderGeometry(0.036, 0.026, 0.06, 14),
    new THREE.MeshStandardMaterial({ color: 0x2a2a2c, roughness: 0.35, metalness: 0.8 }),
  );
  head.rotation.x = Math.PI / 2;
  head.position.z = -0.14;
  const lensMat = new THREE.MeshBasicMaterial({ color: 0xfff4dc, toneMapped: false });
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.03, 16), lensMat);
  lens.position.z = -0.171;
  lens.rotation.y = Math.PI;
  hand.add(body, head, lens);
  hand.position.set(0.2, -0.2, -0.42);
  hand.rotation.set(0.05, 0.12, 0);
  const aim = new THREE.Vector3(0, 0, -1);
  const tmp = new THREE.Vector3();
  const offset = new THREE.Vector3();

  const update = (camera: THREE.Camera, on: boolean, battery: number, flash: number, t: number, dt: number): void => {
    camera.getWorldDirection(tmp);
    aim.lerp(tmp, Math.min(1, dt * 14)).normalize();
    offset.set(0.21, -0.2, -0.62).applyQuaternion(camera.quaternion);
    light.position.copy(camera.position).add(offset);
    light.target.position.copy(light.position).addScaledVector(aim, 8);
    light.target.updateMatrixWorld();
    let level = on ? 1 : 0;
    if (on && battery < BATTERY_LOW) {
      const dying = 1 - battery / BATTERY_LOW;
      const stutter = Math.sin(t * 31) * Math.sin(t * 17.3) > 1 - dying * 1.2 ? 0.15 : 1;
      level = (0.45 + 0.55 * (battery / BATTERY_LOW)) * stutter;
    }
    light.intensity = BASE_INTENSITY * level * (1 + flash * FLASH_BOOST);
    lensMat.color.setRGB(0.15 + level * 1.4, 0.15 + level * 1.35, 0.13 + level * 1.2);
    // Hand lags a touch behind fast turns so it feels held, not glued to the screen.
    hand.rotation.y = 0.12 + Math.max(-0.08, Math.min(0.08, (aim.x - tmp.x) * 2));
    hand.rotation.x = 0.05 + Math.max(-0.08, Math.min(0.08, (tmp.y - aim.y) * 2));
    light.angle = 0.5 + flash * 0.35;
  };
  return { light, hand, update };
};
