import * as THREE from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { SetPieceState } from "@/types/game";
import { MonsterKind, SetPieceKind, Theme } from "@/types/world";
import type { Level, SetPiece } from "@/types/world";
import { WALL_HEIGHT } from "@/world/constants";
import { createAnimated } from "@/render3d/animated-model";
import type { AnimatedModel } from "@/render3d/animated-model";

const DROP_SECONDS = 0.22;
const HANG_DROP = 1.25;
const VANISH_AT = 1.1;

interface PieceView {
  piece: SetPiece;
  root: THREE.Group;
  anim: AnimatedModel | null;
  update: (st: SetPieceState, t: number, dt: number, eye: THREE.Vector3) => void;
}

const dark = (color: number, roughness = 0.9): THREE.MeshStandardMaterial => new THREE.MeshStandardMaterial({ color, roughness });

/** Static copy of a glTF scaled to a height and standing on (or hanging from) the origin. */
const staticModel = (gltf: GLTF, height: number, hangFromTop = false): THREE.Object3D => {
  const scene = gltf.scene.clone(true);
  const box = new THREE.Box3().setFromObject(scene);
  const s = height / Math.max(0.01, box.max.y - box.min.y);
  scene.scale.setScalar(s);
  scene.position.y = hangFromTop ? -box.max.y * s : -box.min.y * s;
  const holder = new THREE.Group();
  holder.add(scene);
  return holder;
};

const limpBody = (): THREE.Group => {
  const g = new THREE.Group();
  const cloth = dark(0x3a3530);
  const skin = dark(0x5a4a40, 0.7);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), skin);
  head.position.y = -0.12;
  head.rotation.z = 0.5;
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.5, 4, 8), cloth);
  torso.position.y = -0.62;
  const legL = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.8, 4, 6), cloth);
  legL.position.set(-0.08, -1.35, 0.02);
  const legR = legL.clone();
  legR.position.x = 0.08;
  const armL = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.6, 4, 6), skin);
  armL.position.set(-0.22, -0.75, 0);
  const armR = armL.clone();
  armR.position.x = 0.22;
  g.add(head, torso, legL, legR, armL, armR);
  g.traverse((o) => {
    o.castShadow = true;
  });
  return g;
};

const crouchedFigure = (theme: Theme): THREE.Group => {
  const g = new THREE.Group();
  const cloth = dark(theme === Theme.Haveli ? 0xcfc6b2 : 0x7a8a8e);
  const back = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 10), cloth);
  back.scale.set(1, 1.15, 0.85);
  back.position.y = 0.45;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), dark(theme === Theme.Haveli ? 0x080606 : 0x6a5a50));
  head.position.set(0, 0.78, 0.12);
  g.add(back, head);
  g.traverse((o) => {
    o.castShadow = true;
  });
  return g;
};

const catShape = (): THREE.Group => {
  const g = new THREE.Group();
  const fur = dark(0x080808, 0.8);
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.26, 4, 8), fur);
  body.rotation.x = Math.PI / 2;
  body.position.y = 0.14;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), fur);
  head.position.set(0, 0.2, 0.2);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xc8ff40, toneMapped: false });
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 4), eyeMat);
    eye.position.set(side * 0.028, 0.215, 0.265);
    g.add(eye);
  }
  g.add(body, head);
  return g;
};

const roosterShape = (): THREE.Group => {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), dark(0x6a3418, 0.8));
  body.position.y = 0.25;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), dark(0x7a3a1a));
  head.position.set(0, 0.42, 0.1);
  const comb = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.06, 0.08), dark(0xb01010, 0.6));
  comb.position.set(0, 0.49, 0.1);
  g.add(body, head, comb);
  return g;
};

const radioShape = (): { group: THREE.Group; dial: THREE.MeshBasicMaterial } => {
  const g = new THREE.Group();
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.26, 0.18), dark(0x3a2618, 0.6));
  box.position.y = 0.13;
  const dial = new THREE.MeshBasicMaterial({ color: 0x201008, toneMapped: false });
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.07), dial);
  panel.position.set(0.05, 0.17, 0.091);
  g.add(box, panel);
  return { group: g, dial };
};

/** Running/flying away from where it started, then gone. */
const fleeTo = (piece: SetPiece, eye: THREE.Vector3): THREE.Vector3 => {
  const away = new THREE.Vector3(piece.x - eye.x, 0, piece.z - eye.z).normalize();
  const side = new THREE.Vector3(-away.z, 0, away.x).multiplyScalar(0.8);
  return new THREE.Vector3(piece.x, 0, piece.z).add(away.multiplyScalar(2.5)).add(side.multiplyScalar(2));
};

const buildPiece = (piece: SetPiece, level: Level, extras: Map<string, GLTF>): PieceView => {
  const root = new THREE.Group();
  root.position.set(piece.x, 0, piece.z);
  root.rotation.y = piece.yaw;
  let anim: AnimatedModel | null = null;
  const charKind = level.theme === Theme.Haveli ? MonsterKind.Chudail : MonsterKind.Mareez;

  switch (piece.kind) {
    case SetPieceKind.FallingBody: {
      const rig = new THREE.Group();
      rig.position.y = WALL_HEIGHT;
      const rope = extras.get("noose") ? staticModel(extras.get("noose") as GLTF, HANG_DROP, true) : new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, HANG_DROP, 5), dark(0x8a7a5a));
      if (!extras.get("noose")) rope.position.y = -HANG_DROP / 2;
      const body = extras.get("corpse") ? staticModel(extras.get("corpse") as GLTF, 1.72, true) : limpBody();
      body.position.y = -HANG_DROP;
      rig.add(rope, body);
      root.add(rig);
      root.visible = false;
      const swingSeed = piece.id * 1.7;
      return {
        piece,
        root,
        anim,
        update: (st, t) => {
          root.visible = st.fired;
          if (!st.fired) return;
          const k = Math.min(1, st.t / DROP_SECONDS);
          const bounce = st.t < DROP_SECONDS ? 0 : Math.exp(-st.t * 3) * Math.sin(st.t * 22) * 0.12;
          rig.position.y = WALL_HEIGHT + (1 - k) * HANG_DROP + bounce;
          rig.rotation.z = Math.sin(t * 1.3 + swingSeed) * (0.05 + 0.25 * Math.exp(-st.t * 0.8));
          rig.rotation.y = Math.sin(t * 0.4 + swingSeed) * 0.4;
        },
      };
    }
    case SetPieceKind.CryingFigure: {
      const gltf = extras.get(`char:${charKind}`);
      if (gltf) {
        anim = createAnimated(gltf, { height: 1.85, darken: 0.85 });
        anim.play(["CrouchIdle", "Idle"], 0.6);
        root.add(anim.root);
      } else root.add(crouchedFigure(level.theme));
      const facing = piece.yaw;
      return {
        piece,
        root,
        anim,
        update: (st, t, dt, eye) => {
          anim?.update(dt);
          if (!st.fired) {
            root.visible = true;
            root.rotation.y = facing + Math.sin(t * 2.4 + piece.id) * 0.06;
            return;
          }
          const toEye = Math.atan2(eye.x - piece.x, eye.z - piece.z);
          const turn = Math.min(1, st.t / 0.3);
          root.rotation.y = facing + (toEye - facing) * turn;
          if (st.t > 0.3) anim?.play(["Scream", "Attack", "IdleAlert"], 1.3);
          root.position.y = st.t > 0.3 ? Math.min(0.1, (st.t - 0.3) * 0.4) : 0;
          root.visible = st.t < VANISH_AT && !(st.t > 0.85 && Math.sin(st.t * 90) > 0);
        },
      };
    }
    case SetPieceKind.Cat:
    case SetPieceKind.Rooster: {
      const isCat = piece.kind === SetPieceKind.Cat;
      const gltf = extras.get(isCat ? "cat" : "rooster");
      if (gltf && gltf.animations.length > 0) {
        anim = createAnimated(gltf, { height: isCat ? 0.32 : 0.5 });
        anim.play(["Idle"], 1);
        root.add(anim.root);
      } else if (gltf) root.add(staticModel(gltf, isCat ? 0.32 : 0.5));
      else root.add(isCat ? catShape() : roosterShape());
      root.position.y = piece.y;
      let target: THREE.Vector3 | null = null;
      return {
        piece,
        root,
        anim,
        update: (st, _t, dt, eye) => {
          anim?.update(dt);
          if (!st.fired) {
            root.visible = true;
            return;
          }
          target ??= fleeTo(piece, eye);
          anim?.play(isCat ? (st.t < 0.45 ? ["Jump", "Hiss"] : ["Run"]) : st.t < 0.5 ? ["Flutter", "Crow"] : ["Run"], 1.6);
          const k = Math.min(1, st.t / 1.2);
          root.position.x = piece.x + (target.x - piece.x) * k;
          root.position.z = piece.z + (target.z - piece.z) * k;
          const arc = Math.sin(Math.min(1, st.t / 0.45) * Math.PI) * (isCat ? 0.4 : 0.7);
          root.position.y = Math.max(0, piece.y * (1 - Math.min(1, st.t / 0.45))) + arc;
          root.rotation.y = Math.atan2(target.x - piece.x, target.z - piece.z);
          root.visible = st.t < 1.6;
        },
      };
    }
    case SetPieceKind.RockingChair: {
      const gltf = extras.get("rocking-chair");
      const chair = gltf ? staticModel(gltf, 1.0) : new THREE.Mesh(new THREE.BoxGeometry(0.6, 1, 0.8), dark(0x3a2a1e));
      if (!gltf) chair.position.y = 0.5;
      const pivot = new THREE.Group();
      pivot.add(chair);
      root.add(pivot);
      return {
        piece,
        root,
        anim,
        update: (st, t) => {
          pivot.rotation.x = st.fired ? Math.sin(t * 2.3) * 0.16 * Math.min(1, st.t) : 0;
        },
      };
    }
    default: {
      const gltf = extras.get("old-radio");
      const radio = radioShape();
      if (gltf) root.add(staticModel(gltf, 0.3));
      else root.add(radio.group);
      root.position.y = piece.y;
      return {
        piece,
        root,
        anim,
        update: (st, t) => {
          const on = st.fired ? 0.6 + 0.4 * Math.sin(t * 13) * Math.sin(t * 3.1) : 0;
          radio.dial.color.setRGB(0.15 + on * 1.4, 0.08 + on * 0.8, 0.02);
        },
      };
    }
  }
};

export interface SetPiecesView {
  group: THREE.Group;
  update: (states: SetPieceState[], t: number, dt: number, eye: THREE.Vector3) => void;
}

/** Visuals for every scripted scare in the building. */
export const buildSetPiecesView = (level: Level, extras: Map<string, GLTF>): SetPiecesView => {
  const group = new THREE.Group();
  group.name = "set-pieces";
  const views = level.setPieces.map((p) => buildPiece(p, level, extras));
  for (const v of views) group.add(v.root);
  return {
    group,
    update: (states, t, dt, eye) => {
      views.forEach((v, i) => {
        const st = states[i];
        if (st) v.update(st, t, dt, eye);
      });
    },
  };
};
