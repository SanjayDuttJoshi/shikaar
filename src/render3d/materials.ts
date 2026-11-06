import * as THREE from "three";
import { Quality, Surface } from "@/types/render";
import { Theme } from "@/types/world";
import { assetUrl } from "@/lib/asset-url";

interface SurfaceSpec {
  texture: string;
  /** Metres covered by one texture repeat. */
  scale: number;
  tint: number;
  roughness: number;
  metalness: number;
  /** Colour of the procedural fallback if the texture can't load. */
  fallback: string;
}

const spec = (texture: string, scale: number, fallback: string, tint = 0xffffff, roughness = 1, metalness = 0): SurfaceSpec => ({
  texture,
  scale,
  tint,
  roughness,
  metalness,
  fallback,
});

const ASYLUM: Record<Surface, SurfaceSpec> = {
  [Surface.WallLower]: spec("asylum-wall-tiles", 1.6, "#8a9a8c", 0xd8e2d4),
  [Surface.WallUpper]: spec("asylum-wall-plaster", 2.6, "#9c9a86", 0xd6d6c4),
  [Surface.Floor]: spec("asylum-floor", 2.4, "#5f5a52", 0xc8c4b8),
  [Surface.CourtyardFloor]: spec("concrete-damp", 3, "#4a4a46"),
  [Surface.Ceiling]: spec("asylum-ceiling", 3, "#8c887a", 0xbab6a6),
  [Surface.Trim]: spec("old-painted-wood", 1.2, "#5d6a5a", 0x9fb09a),
  [Surface.DoorWood]: spec("old-painted-wood", 1.6, "#6d7a68", 0xc0ccb8),
  [Surface.DoorMetal]: spec("rusty-metal", 1.6, "#5a5048", 0xbfb7ae, 1, 0.35),
  [Surface.Metal]: spec("rusty-metal", 1.2, "#6a625a", 0xd0ccc4, 1, 0.45),
  [Surface.Wood]: spec("dark-wood", 1.4, "#4a3628"),
  [Surface.Fabric]: spec("fabric-dirty", 1.2, "#8a8678", 0xd8d4c8),
  [Surface.Stone]: spec("concrete-damp", 2, "#55524c"),
  [Surface.Brick]: spec("old-brick", 2, "#6a3a2c"),
  [Surface.Brass]: spec("brass", 0.8, "#8a6a2c", 0xffffff, 1, 0.8),
  [Surface.Carpet]: spec("carpet-old", 2.2, "#6a2a22"),
  [Surface.Ground]: spec("concrete-damp", 4, "#2c2a26", 0x9a988f),
};

const HAVELI: Record<Surface, SurfaceSpec> = {
  ...ASYLUM,
  [Surface.WallLower]: spec("haveli-sandstone", 2, "#8a4a36"),
  [Surface.WallUpper]: spec("haveli-plaster", 2.8, "#a88a5a", 0xe8d6b0),
  [Surface.Floor]: spec("haveli-floor", 2.4, "#6a5e50"),
  [Surface.CourtyardFloor]: spec("old-brick", 2.2, "#6a3a2c", 0xc8a898),
  [Surface.Ceiling]: spec("dark-wood", 1.8, "#3a2a1e", 0xa08878),
  [Surface.Trim]: spec("dark-wood", 1.2, "#3a2a1e"),
  [Surface.DoorWood]: spec("dark-wood", 1.4, "#3a2a1e", 0xd0b8a0),
  [Surface.Stone]: spec("haveli-sandstone", 1.6, "#8a4a36"),
  [Surface.Fabric]: spec("carpet-old", 1.4, "#6a2a22"),
  [Surface.Ground]: spec("old-brick", 3, "#3a241c", 0x8a7a70),
};

export const surfaceSpecs = (theme: Theme): Record<Surface, SurfaceSpec> => (theme === Theme.Asylum ? ASYLUM : HAVELI);

const hash = (x: number, y: number, seed: number): number => {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

/** Cheap grimy value-noise texture used when the real texture can't be fetched. */
const fallbackTexture = (base: string, seed: number): THREE.Texture => {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext("2d") as CanvasRenderingContext2D;
  g.fillStyle = base;
  g.fillRect(0, 0, size, size);
  const image = g.getImageData(0, 0, size, size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const n = hash(x >> 3, y >> 3, seed) * 0.5 + hash(x >> 1, y >> 1, seed + 1) * 0.3 + hash(x, y, seed + 2) * 0.2;
      const shade = 0.72 + n * 0.45;
      const i = (y * size + x) * 4;
      image.data[i] *= shade;
      image.data[i + 1] *= shade;
      image.data[i + 2] *= shade;
    }
  }
  g.putImageData(image, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
};

const loader = new THREE.TextureLoader();

const loadInto = (
  material: THREE.MeshStandardMaterial,
  url: string,
  slot: "map" | "normalMap" | "roughnessMap",
  anisotropy: number,
  onFail?: () => void,
): void => {
  loader.load(
    url,
    (tex) => {
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.anisotropy = anisotropy;
      if (slot === "map") tex.colorSpace = THREE.SRGBColorSpace;
      material[slot] = tex;
      material.needsUpdate = true;
    },
    undefined,
    () => onFail?.(),
  );
};

export interface SurfaceMaterials {
  get: (s: Surface) => THREE.MeshStandardMaterial;
  scale: (s: Surface) => number;
  dispose: () => void;
}

/** One shared material per surface. Textures stream in; until then (or if missing) a grimy fallback shows. */
export const createSurfaceMaterials = (theme: Theme, quality: Quality, maxAnisotropy: number): SurfaceMaterials => {
  const specs = surfaceSpecs(theme);
  const cache = new Map<Surface, THREE.MeshStandardMaterial>();
  const anisotropy = quality === Quality.Low ? 1 : Math.min(8, maxAnisotropy);
  const get = (s: Surface): THREE.MeshStandardMaterial => {
    const existing = cache.get(s);
    if (existing) return existing;
    const sp = specs[s];
    const material = new THREE.MeshStandardMaterial({
      color: sp.tint,
      roughness: sp.roughness,
      metalness: sp.metalness,
    });
    material.name = s;
    const fallback = fallbackTexture(sp.fallback, s.length * 31 + sp.texture.length);
    fallback.wrapS = THREE.RepeatWrapping;
    fallback.wrapT = THREE.RepeatWrapping;
    material.map = fallback;
    const dir = `textures/${sp.texture}`;
    loadInto(material, assetUrl(`${dir}/color.jpg`), "map", anisotropy);
    if (quality !== Quality.Low) loadInto(material, assetUrl(`${dir}/normal.jpg`), "normalMap", anisotropy);
    loadInto(material, assetUrl(`${dir}/rough.jpg`), "roughnessMap", anisotropy);
    cache.set(s, material);
    return material;
  };
  return {
    get,
    scale: (s) => specs[s].scale,
    dispose: () => {
      for (const m of cache.values()) {
        m.map?.dispose();
        m.normalMap?.dispose();
        m.roughnessMap?.dispose();
        m.dispose();
      }
      cache.clear();
    },
  };
};
