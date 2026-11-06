import * as THREE from "three";
import { DecalKind } from "@/types/render";
import { EdgeKind, Theme } from "@/types/world";
import type { Level } from "@/types/world";
import { CELL, WALL_THICKNESS } from "@/world/constants";
import { createRng } from "@/world/rng";
import type { Rng } from "@/world/rng";
import { assetUrl } from "@/lib/asset-url";

const T = WALL_THICKNESS / 2 + 0.012;


interface WallDecalRule {
  kind: DecalKind;
  weight: number;
  y: [number, number];
  size: [number, number];
}

const WALL_RULES: WallDecalRule[] = [
  { kind: DecalKind.GrimeLeak1, weight: 4, y: [2.0, 2.6], size: [1.2, 1.9] },
  { kind: DecalKind.GrimeLeak2, weight: 4, y: [2.0, 2.6], size: [1.2, 1.9] },
  { kind: DecalKind.GrimeStreak, weight: 3, y: [1.4, 2.4], size: [1.0, 1.6] },
  { kind: DecalKind.WaterStain, weight: 2, y: [1.6, 2.6], size: [1.0, 1.8] },
  { kind: DecalKind.Crack1, weight: 2, y: [0.6, 2.4], size: [0.6, 1.2] },
  { kind: DecalKind.Crack2, weight: 2, y: [0.6, 2.4], size: [0.6, 1.2] },
  { kind: DecalKind.BloodSmear, weight: 1.4, y: [0.7, 1.5], size: [0.8, 1.3] },
  { kind: DecalKind.BloodSpatter1, weight: 1, y: [0.8, 1.7], size: [0.6, 1.1] },
  { kind: DecalKind.BloodSpatter2, weight: 1, y: [0.8, 1.7], size: [0.6, 1.1] },
];

/** Things scrawled on walls. A couple of them are real advice. */
const WRITINGS = [
  "BHAAGO",
  "WOH SUN RAHA HAI",
  "ROSHNI BAND KARO",
  "KOI NAHI BACHEGA",
  "PEECHHE MAT DEKHO",
  "WOH DEKH LE TOH CHHUPNA MAT",
  "MAAF KAR DO",
  "2:47",
  "FUSE... GATE... BHAAGO",
];

const pickRule = (rng: Rng): WallDecalRule => {
  const total = WALL_RULES.reduce((s, r) => s + r.weight, 0);
  let roll = rng.next() * total;
  for (const r of WALL_RULES) {
    roll -= r.weight;
    if (roll <= 0) return r;
  }
  return WALL_RULES[0];
};

const writingTexture = (text: string, seed: number): THREE.Texture => {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 256;
  const g = canvas.getContext("2d") as CanvasRenderingContext2D;
  const rng = createRng(seed);
  const size = Math.min(120, 1400 / Math.max(4, text.length));
  g.font = `${size}px "Special Elite", "Courier New", serif`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  for (let pass = 0; pass < 4; pass += 1) {
    g.fillStyle = `rgba(${70 + pass * 12}, 8, 6, ${0.55 - pass * 0.1})`;
    g.save();
    g.translate(512 + rng.range(-4, 4), 120 + rng.range(-4, 4));
    g.rotate(rng.range(-0.05, 0.05));
    g.fillText(text, 0, 0);
    g.restore();
  }
  const width = g.measureText(text).width;
  g.fillStyle = "rgba(80, 8, 6, 0.6)";
  for (let i = 0; i < 9; i += 1) {
    const x = 512 - width / 2 + rng.next() * width;
    g.fillRect(x, 150, 3 + rng.next() * 3, 20 + rng.next() * 80);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
};

interface WallFace {
  x: number;
  z: number;
  yaw: number;
  along: number;
}

/** Every wall face that looks into a room, with its centre and facing. */
const wallFaces = (level: Level): WallFace[] => {
  const faces: WallFace[] = [];
  const inside = (x: number, y: number): boolean =>
    x >= 0 && y >= 0 && x < level.width && y < level.height && level.roomOf[y * level.width + x] >= 0;
  for (let y = 0; y < level.height; y += 1) {
    for (let x = 0; x < level.width; x += 1) {
      const i = y * level.width + x;
      if (level.edgeX[i] === EdgeKind.Wall) {
        const line = (x + 1) * CELL;
        if (inside(x, y)) faces.push({ x: line - T, z: (y + 0.5) * CELL, yaw: -Math.PI / 2, along: 0 });
        if (inside(x + 1, y)) faces.push({ x: line + T, z: (y + 0.5) * CELL, yaw: Math.PI / 2, along: 0 });
      }
      if (level.edgeY[i] === EdgeKind.Wall) {
        const line = (y + 1) * CELL;
        if (inside(x, y)) faces.push({ x: (x + 0.5) * CELL, z: line - T, yaw: Math.PI, along: 1 });
        if (inside(x, y + 1)) faces.push({ x: (x + 0.5) * CELL, z: line + T, yaw: 0, along: 1 });
      }
    }
  }
  return faces;
};

/** Grime, cracks, blood and scrawled warnings on the walls and floors. Deterministic per building. */
export const buildDecalsView = (level: Level, maxWritings: number): THREE.Group => {
  const group = new THREE.Group();
  group.name = "decals";
  const rng = createRng(level.seed ^ 0xdeca1);
  const loader = new THREE.TextureLoader();
  const materials = new Map<DecalKind, THREE.MeshStandardMaterial>();
  const material = (kind: DecalKind): THREE.MeshStandardMaterial => {
    const existing = materials.get(kind);
    if (existing) return existing;
    const mat = new THREE.MeshStandardMaterial({ transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, roughness: 0.9, opacity: 0 });
    loader.load(assetUrl(`textures/decals/${kind}.png`), (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      mat.map = tex;
      mat.opacity = 0.92;
      mat.needsUpdate = true;
    });
    materials.set(kind, mat);
    return mat;
  };
  const plane = new THREE.PlaneGeometry(1, 1);
  const chance = level.theme === Theme.Asylum ? 0.2 : 0.12;
  const faces = wallFaces(level);
  for (const f of faces) {
    if (!rng.chance(chance)) continue;
    const rule = pickRule(rng);
    const size = rng.range(rule.size[0], rule.size[1]);
    const mesh = new THREE.Mesh(plane, material(rule.kind));
    const slide = rng.range(-0.7, 0.7);
    mesh.position.set(f.x + (f.along ? slide : 0), rng.range(rule.y[0], rule.y[1]), f.z + (f.along ? 0 : slide));
    mesh.rotation.set(0, f.yaw, rng.range(-0.15, 0.15));
    mesh.scale.set(size, size, 1);
    mesh.renderOrder = 2;
    group.add(mesh);
  }
  const writable = rng.shuffle(faces.slice());
  WRITINGS.slice(0, maxWritings).forEach((text, i) => {
    const f = writable[i];
    if (!f) return;
    const mat = new THREE.MeshStandardMaterial({ map: writingTexture(text, level.seed + i), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, roughness: 0.7 });
    const mesh = new THREE.Mesh(plane, mat);
    mesh.position.set(f.x, rng.range(1.3, 1.9), f.z);
    mesh.rotation.set(0, f.yaw, rng.range(-0.06, 0.06));
    mesh.scale.set(2.4, 0.6, 1);
    mesh.renderOrder = 3;
    mesh.name = `writing:${text}`;
    group.add(mesh);
  });
  for (const room of level.rooms) {
    if (!rng.chance(0.3)) continue;
    const kind = rng.chance(0.6) ? DecalKind.BloodPool : DecalKind.WaterStain;
    const mesh = new THREE.Mesh(plane, material(kind));
    mesh.position.set((room.rect.x + rng.range(0.4, room.rect.w - 0.4)) * CELL, 0.012, (room.rect.y + rng.range(0.4, room.rect.h - 0.4)) * CELL);
    mesh.rotation.set(-Math.PI / 2, 0, rng.range(0, Math.PI * 2));
    const size = rng.range(0.9, 1.8);
    mesh.scale.set(size, size, 1);
    mesh.renderOrder = 1;
    group.add(mesh);
  }
  return group;
};
