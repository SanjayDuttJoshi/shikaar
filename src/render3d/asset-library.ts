import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { MonsterKind, PropKind, Theme } from "@/types/world";
import { assetUrl } from "@/lib/asset-url";
import { PROP_SPECS } from "@/world/prop-specs";
import { createRiggedMonster } from "@/render3d/rigged-monster";
import { proceduralMonster } from "@/render3d/monster-view";
import type { MonsterBodyFactory } from "@/render3d/monster-view";
import type { PropModels } from "@/render3d/props-view";
import type { SceneAssets } from "@/render3d/scene-view";

export type ProgressFn = (fraction: number, label: string) => void;

interface ManifestEntry {
  path: string;
  facing?: string;
  heightMeters?: number;
  animations?: string[];
}

/** Model file (under models/props/) for each prop kind, per building. */
const PROP_FILES: Partial<Record<PropKind, Partial<Record<Theme, string>>>> = {
  [PropKind.HospitalBed]: { [Theme.Asylum]: "hospital-bed" },
  [PropKind.MetalLocker]: { [Theme.Asylum]: "metal-locker" },
  [PropKind.Wheelchair]: { [Theme.Asylum]: "wheelchair" },
  [PropKind.MetalCabinet]: { [Theme.Asylum]: "metal-cabinet" },
  [PropKind.Desk]: { [Theme.Asylum]: "old-desk", [Theme.Haveli]: "old-desk" },
  [PropKind.Chair]: { [Theme.Asylum]: "chair", [Theme.Haveli]: "old-chair" },
  [PropKind.IvStand]: { [Theme.Asylum]: "iv-stand" },
  [PropKind.Trolley]: { [Theme.Asylum]: "medical-trolley" },
  [PropKind.Shelf]: { [Theme.Asylum]: "metal-shelf", [Theme.Haveli]: "metal-shelf" },
  [PropKind.Sink]: { [Theme.Asylum]: "sink" },
  [PropKind.Bathtub]: { [Theme.Asylum]: "bathtub" },
  [PropKind.Crate]: { [Theme.Asylum]: "crate", [Theme.Haveli]: "crate" },
  [PropKind.Barrel]: { [Theme.Asylum]: "barrel", [Theme.Haveli]: "barrel" },
  [PropKind.Wardrobe]: { [Theme.Haveli]: "wooden-wardrobe", [Theme.Asylum]: "wooden-wardrobe" },
  [PropKind.Chest]: { [Theme.Haveli]: "wooden-chest", [Theme.Asylum]: "wooden-chest" },
  [PropKind.Table]: { [Theme.Haveli]: "old-table", [Theme.Asylum]: "old-table" },
  [PropKind.Pot]: { [Theme.Haveli]: "brass-pot", [Theme.Asylum]: "brass-pot" },
  [PropKind.Mirror]: { [Theme.Haveli]: "mirror", [Theme.Asylum]: "mirror" },
  [PropKind.Cradle]: { [Theme.Haveli]: "rocking-chair" },
  [PropKind.Rug]: { [Theme.Haveli]: "rug" },
};

const FACING_YAW: Record<string, number> = { "+z": 0, "-z": Math.PI, "+x": -Math.PI / 2, "-x": Math.PI / 2 };

const createLoader = (): GLTFLoader => {
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  return loader;
};

/** Reads "+Z (front)", "-X ..." etc. Anything else ("n/a", "long axis = X") counts as +Z. */
const facingYaw = (facing: string | undefined): number => {
  const match = /^\s*([+-][xz])/i.exec(facing ?? "");
  return match ? (FACING_YAW[match[1].toLowerCase()] ?? 0) : 0;
};

/** Manifest paths may be written as "assets/models/props/x.glb"; the loader wants "props/x.glb". */
const modelPath = (path: string): string => path.replace(/^\/?(assets\/)?(models\/)?/, "");

/** Turns a loaded prop to face +Z, scales it into its footprint and stands it on the floor at the origin. */
const fitProp = (kind: PropKind, scene: THREE.Object3D, facing: string | undefined): THREE.Object3D => {
  const spec = PROP_SPECS[kind];
  const turn = new THREE.Group();
  turn.rotation.y = facingYaw(facing);
  turn.add(scene);
  turn.updateMatrixWorld(true);
  let box = new THREE.Box3().setFromObject(turn);
  let size = box.getSize(new THREE.Vector3());
  // Long side of the model must lie along the long side of the footprint (e.g. a bathtub modelled along X).
  const specLongZ = spec.d > spec.w * 1.2;
  const specLongX = spec.w > spec.d * 1.2;
  if ((specLongZ && size.x > size.z * 1.2) || (specLongX && size.z > size.x * 1.2)) {
    turn.rotation.y += Math.PI / 2;
    turn.updateMatrixWorld(true);
    box = new THREE.Box3().setFromObject(turn);
    size = box.getSize(new THREE.Vector3());
  }
  // Fill the footprint; things you put items on are also matched to their surface height.
  const byFootprint = Math.min(spec.w / Math.max(size.x, 1e-3), spec.d / Math.max(size.z, 1e-3));
  const byHeight = spec.surface ? spec.h / Math.max(size.y, 1e-3) : Number.POSITIVE_INFINITY;
  const fit = Math.min(byFootprint * 1.05, byHeight);
  const wrapper = new THREE.Group();
  wrapper.scale.setScalar(fit);
  const center = box.getCenter(new THREE.Vector3());
  turn.position.set(-center.x, -box.min.y, -center.z);
  wrapper.add(turn);
  wrapper.updateMatrixWorld(true);
  wrapper.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      const std = m as THREE.MeshStandardMaterial;
      if (std.isMeshStandardMaterial && std.color) std.color.multiplyScalar(0.8);
    }
  });
  return wrapper;
};

const loadManifest = async (): Promise<ManifestEntry[]> => {
  try {
    const res = await fetch(assetUrl("models/manifest.json"));
    if (!res.ok) return [];
    const raw = (await res.json()) as unknown;
    const list = Array.isArray(raw) ? raw : (raw as { models?: unknown[] }).models ?? Object.values(raw as object);
    return (list as ManifestEntry[]).filter((e) => typeof e?.path === "string");
  } catch {
    return [];
  }
};

/** Model files to try for each monster, best first; the procedural body is the last resort. */
const MONSTER_FILES: Record<MonsterKind, string[]> = {
  [MonsterKind.Shikari]: ["shikari", "monster"],
  [MonsterKind.Chudail]: ["chudail"],
  [MonsterKind.Mareez]: ["mareez", "monster"],
};
const MONSTER_FILES_TOTAL = Object.values(MONSTER_FILES).reduce((n, list) => n + list.length, 0);

/** Models used by the scripted scares. */
export const EXTRA_FILES = ["corpse", "noose", "cat", "rooster", "old-radio", "rocking-chair"];

const fileName = (path: string): string => path.split("/").pop()?.replace(/\.glb$/i, "") ?? path;

/**
 * Loads downloaded models for the building. Anything missing falls back to the procedural stand-ins.
 * `survivors` are the squad members' character files (none in a solo game).
 */
export const loadSceneAssets = async (theme: Theme, onProgress: ProgressFn, survivors: string[] = []): Promise<SceneAssets> => {
  const manifest = await loadManifest();
  const byName = new Map(manifest.map((e) => [fileName(e.path), e]));
  const loader = createLoader();
  const propModels: PropModels = new Map();
  const jobs: Array<{ kind: PropKind; entry: ManifestEntry }> = [];
  for (const [kind, files] of Object.entries(PROP_FILES) as Array<[PropKind, Partial<Record<Theme, string>>]>) {
    const name = files[theme];
    if (!name) continue;
    // Without a manifest entry, try the conventional path and assume the model faces +Z.
    jobs.push({ kind, entry: byName.get(name) ?? { path: `props/${name}.glb` } });
  }
  const total = jobs.length + MONSTER_FILES_TOTAL + EXTRA_FILES.length + survivors.length;
  let done = 0;
  const tick = (label: string): void => {
    done += 1;
    onProgress(total === 0 ? 1 : done / total, label);
  };
  const loadGlb = async (path: string): Promise<GLTF | null> => {
    try {
      return await loader.loadAsync(assetUrl(`models/${modelPath(path)}`));
    } catch {
      return null;
    }
  };
  await Promise.all(
    jobs.map(async ({ kind, entry }) => {
      const gltf = await loadGlb(entry.path);
      if (gltf) propModels.set(kind, fitProp(kind, gltf.scene, entry.facing));
      tick("Saaman aa raha hai...");
    }),
  );
  const monsters = {} as Record<MonsterKind, MonsterBodyFactory>;
  const extras = new Map<string, GLTF>();
  for (const kind of Object.values(MonsterKind)) {
    let factory = proceduralMonster(kind);
    for (const file of MONSTER_FILES[kind]) {
      const gltf = await loadGlb(`characters/${file}.glb`);
      tick("Woh aa raha hai...");
      if (gltf && gltf.animations.length > 0) {
        factory = createRiggedMonster(gltf, kind, facingYaw(byName.get(file)?.facing));
        extras.set(`char:${kind}`, gltf);
        break;
      }
    }
    monsters[kind] = factory;
  }
  await Promise.all(
    EXTRA_FILES.map(async (name) => {
      const gltf = await loadGlb(`props/${name}.glb`);
      if (gltf) extras.set(name, gltf);
      tick("Andhera ho raha hai...");
    }),
  );
  await Promise.all(
    survivors.map(async (name) => {
      const gltf = await loadGlb(`characters/${name}.glb`);
      if (gltf) extras.set(`survivor:${name}`, gltf);
      tick("Dost aa rahe hain...");
    }),
  );
  return { propModels, monsters, extras };
};
