import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { Actor, FilmMood } from "@/types/story";
import type { Film, FilmSet, FilmShot } from "@/types/story";
import type { Language } from "@/types/ui";
import { MonsterKind } from "@/types/world";
import type { AudioSink } from "@/audio/audio-sink";
import { assetUrl } from "@/lib/asset-url";
import { subtitleFor } from "@/lib/voice";
import { createAnimated } from "@/render3d/animated-model";
import type { AnimatedModel } from "@/render3d/animated-model";
import type { SurfaceMaterials } from "@/render3d/materials";
import { createPostFx } from "@/render3d/post-fx";
import type { PostFx } from "@/render3d/post-fx";
import type { PropModels } from "@/render3d/props-view";
import { flickerLantern, makeLantern } from "@/render3d/rigged-monster";
import type { Lantern } from "@/render3d/rigged-monster";
import { buildStage } from "@/film/film-sets";
import type { StageSet } from "@/film/film-sets";

const TITLE_SECONDS = 2.8;
const FADE = 0.45;
const LINE_TAIL = 0.8;
const SEPIA = new THREE.Color(1.12, 0.97, 0.78);

interface ActorLook {
  file: string;
  height: number;
  darken: number;
}

/** Which model plays whom. Survivors double as the living cast; monsters as what they became. */
const CAST: Record<Actor, ActorLook> = {
  [Actor.Kamla]: { file: "characters/survivor-female-b.glb", height: 1.62, darken: 1 },
  [Actor.Bhairav]: { file: "characters/survivor-male-b.glb", height: 1.74, darken: 0.85 },
  [Actor.Thakur]: { file: "characters/survivor-male-a.glb", height: 1.8, darken: 0.7 },
  [Actor.Henchman]: { file: "characters/survivor-male-b.glb", height: 1.78, darken: 0.45 },
  [Actor.Doctor]: { file: "characters/survivor-male-a.glb", height: 1.76, darken: 1.15 },
  [Actor.Nurse]: { file: "characters/survivor-female-a.glb", height: 1.64, darken: 1.1 },
  [Actor.Raghu]: { file: "characters/survivor-male-a.glb", height: 1.75, darken: 0.9 },
  [Actor.RaghuBlind]: { file: "characters/mareez.glb", height: 1.95, darken: 0.9 },
  [Actor.Chudail]: { file: "characters/chudail.glb", height: 1.85, darken: 0.95 },
  [Actor.Shikari]: { file: "characters/shikari.glb", height: 2.3, darken: 0.75 },
};

export const MONSTER_ACTOR: Record<MonsterKind, Actor> = {
  [MonsterKind.Shikari]: Actor.Shikari,
  [MonsterKind.Chudail]: Actor.Chudail,
  [MonsterKind.Mareez]: Actor.RaghuBlind,
};

export interface FilmFrame {
  playing: boolean;
  title: string | null;
  subtitle: string;
  progress: number;
}

export interface FilmPlayer {
  /** Loads the cast and starts the film. Resolves when it is ready to play. */
  play: (film: Film, lang: Language) => Promise<void>;
  update: (dt: number) => FilmFrame;
  render: () => void;
  resize: (w: number, h: number) => void;
  stop: () => void;
  isPlaying: () => boolean;
}

interface CastMember {
  cue: FilmShot["actors"][number];
  model: AnimatedModel;
  lantern: Lantern | null;
}

const ease = (t: number): number => t * t * (3 - 2 * t);
const lerp3 = (a: number[], b: number[], t: number): THREE.Vector3 => new THREE.Vector3(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t);

/**
 * Story films rendered live with the game's own models and materials: short staged shots with a
 * slow camera, an old-film grade, narration and subtitles in the chosen language.
 */
export const createFilmPlayer = (
  renderer: THREE.WebGLRenderer,
  materials: SurfaceMaterials,
  propModels: PropModels,
  audio: () => AudioSink,
): FilmPlayer => {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x030202);
  scene.fog = new THREE.FogExp2(0x030202, 0.05);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 80);
  const hemi = new THREE.HemisphereLight(0x506070, 0x140c08, 0.7);
  // Soft fill from the camera so faces read even in the darkest shots.
  const fill = new THREE.PointLight(0xffe2c0, 1.6, 9, 2);
  const key = new THREE.SpotLight(0xfff1dc, 0, 25, 0.6, 0.7, 1.4);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  const bulb = new THREE.PointLight(0xffc890, 0, 9, 2);
  const glow = new THREE.PointLight(0xff4020, 0, 7, 2);
  scene.add(hemi, key, key.target, bulb, glow, fill);
  const fx: PostFx = createPostFx(renderer, scene, camera);
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const gltfs = new Map<string, Promise<GLTF | null>>();
  const stages = new Map<FilmSet, StageSet>();
  const load = (file: string): Promise<GLTF | null> => {
    let p = gltfs.get(file);
    if (!p) {
      p = loader.loadAsync(assetUrl(`models/${file}`)).catch(() => null);
      gltfs.set(file, p);
    }
    return p;
  };
  const stageFor = (set: FilmSet): StageSet => {
    let s = stages.get(set);
    if (!s) {
      s = buildStage(set, materials, propModels);
      stages.set(set, s);
      scene.add(s.group);
    }
    return s;
  };

  let film: Film | null = null;
  let lang: Language | null = null;
  let t = 0;
  let shotIndex = -1;
  let shotStart = 0;
  let shotLength = 0;
  let cast: CastMember[] = [];
  let dropped: Lantern | null = null;
  let subtitle = "";
  let playing = false;

  const clearCast = (): void => {
    for (const c of cast) scene.remove(c.model.root);
    cast = [];
    if (dropped) scene.remove(dropped.group);
    dropped = null;
  };

  const startShot = async (index: number): Promise<void> => {
    if (!film || !lang) return;
    const shot = film.shots[index];
    clearCast();
    for (const s of stages.values()) s.group.visible = false;
    const stage = stageFor(shot.set);
    stage.group.visible = true;
    if (stage.door) stage.door.rotation.y = shot.doorSlamAt !== undefined ? -1.25 : 0;
    for (const cue of shot.actors) {
      const gltf = await load(CAST[cue.actor].file);
      if (!gltf) continue;
      const model = createAnimated(gltf, { height: CAST[cue.actor].height, darken: CAST[cue.actor].darken });
      model.play(cue.clip, 1);
      model.root.position.set(cue.at[0], cue.lift ?? 0, cue.at[1]);
      model.root.rotation.y = cue.at[2];
      let lantern: Lantern | null = null;
      if (cue.lantern) {
        lantern = makeLantern(cue.actor !== Actor.Shikari);
        const hand = model.findNode("LanternFlame") ?? model.findNode("hand_l");
        if (model.findNode("LanternFlame")) model.findNode("LanternFlame")?.add(lantern.light);
        else if (hand) {
          const s = 1 / Math.max(0.01, hand.getWorldScale(new THREE.Vector3()).x);
          lantern.group.scale.setScalar(s);
          hand.add(lantern.group);
        } else {
          lantern.group.position.set(0.3, 0.8, 0.1);
          model.root.add(lantern.group);
        }
      }
      scene.add(model.root);
      cast.push({ cue, model, lantern });
    }
    if (shot.lanternAt) {
      dropped = makeLantern(true);
      dropped.group.position.set(shot.lanternAt[0], 0.1, shot.lanternAt[1]);
      dropped.group.rotation.z = 1.3;
      scene.add(dropped.group);
    }
    const mood = shot.mood ?? FilmMood.Bulb;
    key.intensity = mood === FilmMood.Moon ? 90 : mood === FilmMood.Surgical ? 120 : 0;
    key.color.setHex(mood === FilmMood.Moon ? 0x8ea6ff : 0xfff6e8);
    key.angle = mood === FilmMood.Surgical ? 0.45 : 0.9;
    key.position.set(stage.lamp.x - (mood === FilmMood.Moon ? 3 : 0), stage.lamp.y + (mood === FilmMood.Moon ? 6 : 0.2), stage.lamp.z);
    key.target.position.set(stage.lamp.x, 0, stage.lamp.z);
    bulb.position.copy(stage.lamp);
    bulb.intensity = mood === FilmMood.Bulb ? 9 : 1.5;
    const spoken = audio().playLine(shot.line);
    shotLength = Math.max(shot.seconds, spoken + LINE_TAIL);
    shotStart = t;
    subtitle = subtitleFor(shot.line, lang);
  };

  const play = async (next: Film, language: Language): Promise<void> => {
    film = next;
    lang = language;
    const files = new Set<string>();
    for (const shot of next.shots) for (const cue of shot.actors) files.add(CAST[cue.actor].file);
    await Promise.all([...files].map(load));
    await audio().loadLines(next.shots.map((s) => s.line));
    t = 0;
    shotIndex = -1;
    playing = true;
    audio().duck(0.85);
  };

  const stop = (): void => {
    playing = false;
    film = null;
    clearCast();
    audio().duck(0);
  };

  let pendingShot: Promise<void> | null = null;
  const update = (dt: number): FilmFrame => {
    if (!playing || !film) return { playing: false, title: null, subtitle: "", progress: 1 };
    t += dt;
    if (t < TITLE_SECONDS) return { playing: true, title: lang === "en" ? film.title.en : film.title.hi, subtitle: "", progress: 0 };
    if (!pendingShot && (shotIndex < 0 || t - shotStart >= shotLength)) {
      shotIndex += 1;
      if (shotIndex >= film.shots.length) {
        stop();
        return { playing: false, title: null, subtitle: "", progress: 1 };
      }
      pendingShot = startShot(shotIndex).then(() => {
        pendingShot = null;
      });
    }
    const shot = film.shots[Math.max(0, shotIndex)];
    const local = t - shotStart;
    const k = ease(Math.min(1, local / Math.max(0.1, shotLength)));
    camera.position.copy(lerp3(shot.camFrom, shot.camTo, k));
    fill.position.copy(camera.position).add(new THREE.Vector3(0.4, 0.3, 0));
    camera.lookAt(lerp3(shot.lookFrom, shot.lookTo, k));
    for (const c of cast) {
      const enter = c.cue.enter ?? 0;
      c.model.root.visible = local >= enter;
      if (c.cue.to) {
        const mk = Math.min(1, Math.max(0, (local - enter) / Math.max(0.1, shotLength - enter - 0.3)));
        c.model.root.position.set(c.cue.at[0] + (c.cue.to[0] - c.cue.at[0]) * mk, 0, c.cue.at[1] + (c.cue.to[1] - c.cue.at[1]) * mk);
        c.model.root.rotation.y = Math.atan2(c.cue.to[0] - c.cue.at[0], c.cue.to[1] - c.cue.at[1]);
      }
      c.model.update(dt);
      if (c.lantern) flickerLantern(c.lantern, t, false);
    }
    if (dropped) flickerLantern(dropped, t, false);
    const lanternNear = cast.find((c) => c.lantern) ?? null;
    glow.intensity = lanternNear || dropped ? 2.0 + Math.sin(t * 17) * 0.3 : 0;
    glow.color.setHex(lanternNear?.cue.actor === Actor.Shikari ? 0xff3018 : 0xffa050);
    if (lanternNear) glow.position.copy(lanternNear.model.root.position).add(new THREE.Vector3(0.3, 1.0, 0.2));
    else if (dropped) glow.position.copy(dropped.group.position).add(new THREE.Vector3(0, 0.3, 0));
    const stage = stageFor(shot.set);
    if (stage.door && shot.doorSlamAt !== undefined) stage.door.rotation.y = local < shot.doorSlamAt ? -1.25 : Math.max(0, -1.25 + (local - shot.doorSlamAt) * 10);
    if (shot.mood === FilmMood.Bulb || !shot.mood) bulb.intensity = 9 * (Math.sin(t * 29) * Math.sin(t * 7) > 0.85 ? 0.3 : 1);
    const total = film.shots.length;
    return { playing: true, title: null, subtitle, progress: (shotIndex + Math.min(1, local / shotLength)) / total };
  };

  const render = (): void => {
    if (!film) return;
    const local = t - shotStart;
    const inTitle = t < TITLE_SECONDS;
    const fadeIn = Math.max(0, 1 - local / FADE);
    const fadeOut = Math.max(0, 1 - (shotLength - local) / FADE);
    const black = inTitle || shotIndex < 0 ? 1 : Math.min(1, Math.max(fadeIn, fadeOut));
    fx.render({ damage: 0, panic: 0.45, flash: 0, black, tint: SEPIA }, t);
  };

  return {
    play,
    update,
    render,
    resize: (w, h) => {
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
      fx.resize(w, h);
    },
    stop,
    isPlaying: () => playing,
  };
};
