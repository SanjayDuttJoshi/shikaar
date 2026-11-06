import * as THREE from "three";
import { ItemKind } from "@/types/world";
import type { Level } from "@/types/world";
import type { WorldItemState } from "@/types/game";
import { KEY_HEX } from "@/lib/labels";

const glowSprite = (): THREE.Texture => {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext("2d") as CanvasRenderingContext2D;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.25, "rgba(255,255,255,0.45)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
};

const emissive = (hex: string, strength = 1.4): THREE.MeshStandardMaterial =>
  new THREE.MeshStandardMaterial({ color: hex, emissive: hex, emissiveIntensity: strength, roughness: 0.35, metalness: 0.6 });

const keyMesh = (hex: string): THREE.Group => {
  const g = new THREE.Group();
  const mat = emissive(hex, 0.9);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.009, 6, 14), mat);
  ring.position.x = -0.07;
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.012, 0.012), mat);
  shaft.position.x = 0.02;
  const t1 = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.03, 0.012), mat);
  t1.position.set(0.06, -0.018, 0);
  const t2 = t1.clone();
  t2.position.x = 0.035;
  g.add(ring, shaft, t1, t2);
  g.rotation.x = -Math.PI / 2;
  return g;
};

const fuseMesh = (): THREE.Group => {
  const g = new THREE.Group();
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.12, 10), emissive("#ffcf4a", 1.6));
  const capA = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.034, 0.03, 10), new THREE.MeshStandardMaterial({ color: "#b8b0a0", metalness: 0.9, roughness: 0.3 }));
  capA.position.y = 0.07;
  const capB = capA.clone();
  capB.position.y = -0.07;
  g.add(glass, capA, capB);
  g.rotation.z = Math.PI / 2;
  g.position.y = 0.035;
  return g;
};

const batteryMesh = (): THREE.Group => {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.07, 10), new THREE.MeshStandardMaterial({ color: "#2a5a2a", emissive: "#3aff6a", emissiveIntensity: 0.25, roughness: 0.4 }));
  g.add(body);
  g.rotation.z = Math.PI / 2;
  g.position.y = 0.018;
  return g;
};

const medkitMesh = (): THREE.Group => {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.09, 0.15), new THREE.MeshStandardMaterial({ color: "#d8d4c8", roughness: 0.6 }));
  const crossMat = emissive("#ff2a2a", 0.6);
  const c1 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.005, 0.03), crossMat);
  c1.position.y = 0.047;
  const c2 = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.005, 0.1), crossMat);
  c2.position.y = 0.047;
  g.add(body, c1, c2);
  g.position.y = 0.045;
  return g;
};

/** An old sealed envelope with a red wax seal. */
const envelopeMesh = (): THREE.Group => {
  const canvas = document.createElement("canvas");
  canvas.width = 160;
  canvas.height = 112;
  const g = canvas.getContext("2d") as CanvasRenderingContext2D;
  g.fillStyle = "#cdbf98";
  g.fillRect(0, 0, 160, 112);
  g.strokeStyle = "rgba(90,60,30,0.6)";
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(80, 62);
  g.lineTo(160, 0);
  g.stroke();
  g.fillStyle = "#7a0d0a";
  g.beginPath();
  g.arc(80, 62, 13, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "rgba(60,30,20,0.5)";
  g.fillRect(18, 84, 60, 3);
  g.fillRect(18, 92, 44, 3);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const env = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.012, 0.17), [
    new THREE.MeshStandardMaterial({ color: 0xb8aa86, roughness: 0.9 }),
    new THREE.MeshStandardMaterial({ color: 0xb8aa86, roughness: 0.9 }),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 }),
    new THREE.MeshStandardMaterial({ color: 0xb8aa86, roughness: 0.9 }),
    new THREE.MeshStandardMaterial({ color: 0xb8aa86, roughness: 0.9 }),
    new THREE.MeshStandardMaterial({ color: 0xb8aa86, roughness: 0.9 }),
  ]);
  env.position.y = 0.006;
  const g2 = new THREE.Group();
  g2.add(env);
  return g2;
};

const GLINT: Record<ItemKind, string> = {
  [ItemKind.Envelope]: "#f3e6c0",
  [ItemKind.Key]: "#ffffff",
  [ItemKind.Fuse]: "#ffcf4a",
  [ItemKind.Battery]: "#7aff9a",
  [ItemKind.Medkit]: "#ff7a7a",
};

export interface ItemsView {
  group: THREE.Group;
  update: (items: WorldItemState[], t: number) => void;
}

/** Pickups with a soft pulsing glint so they can be found in the dark (keys glow in their colour). */
/** Finds the real top of the furniture under (x, z) so items rest on it, whatever model is loaded. */
export type SurfaceProbe = (x: number, z: number, near: number) => number | null;

export const buildItemsView = (level: Level, probe: SurfaceProbe): ItemsView => {
  const group = new THREE.Group();
  group.name = "items";
  const sprite = glowSprite();
  const views = level.items.map((item) => {
    const root = new THREE.Group();
    const body =
      item.kind === ItemKind.Key
        ? keyMesh(item.color === null ? "#ffffff" : KEY_HEX[item.color])
        : item.kind === ItemKind.Fuse
          ? fuseMesh()
          : item.kind === ItemKind.Battery
            ? batteryMesh()
            : item.kind === ItemKind.Envelope
              ? envelopeMesh()
              : medkitMesh();
    body.rotation.y = (item.id * 1.7) % Math.PI;
    root.add(body);
    const glintColor = item.kind === ItemKind.Key && item.color !== null ? KEY_HEX[item.color] : GLINT[item.kind];
    const glint = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: sprite, color: glintColor, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: true }),
    );
    glint.scale.setScalar(item.kind === ItemKind.Key || item.kind === ItemKind.Fuse ? 0.5 : 0.3);
    glint.position.y = 0.08;
    root.add(glint);
    group.add(root);
    return { root, glint, phase: item.id * 0.73, restY: undefined as number | undefined, restFor: -1 };
  });
  const update = (items: WorldItemState[], t: number): void => {
    views.forEach((v, i) => {
      const s = items[i];
      v.root.visible = !!s && !s.taken;
      if (!s || s.taken) return;
      if (v.restY === undefined || v.restFor !== s.y) {
        v.restFor = s.y;
        v.restY = s.y > 0.1 ? (probe(s.x, s.z, s.y) ?? s.y) : s.y;
      }
      v.root.position.set(s.x, v.restY, s.z);
      (v.glint.material as THREE.SpriteMaterial).opacity = 0.35 + 0.35 * Math.max(0, Math.sin(t * 2.4 + v.phase));
    });
  };
  return { group, update };
};
