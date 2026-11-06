import * as THREE from "three";
import { LightKind, RoomKind } from "@/types/world";
import type { Level, LightSpawn, Vec2 } from "@/types/world";
import { CELL, WALL_HEIGHT } from "@/world/constants";

interface LightLook {
  color: number;
  intensity: number;
  distance: number;
}

const LOOK: Record<LightKind, LightLook> = {
  [LightKind.TubeLight]: { color: 0xc8f0dc, intensity: 9, distance: 10 },
  [LightKind.Bulb]: { color: 0xffc890, intensity: 6, distance: 8 },
  [LightKind.Lantern]: { color: 0xff9440, intensity: 5, distance: 8 },
  [LightKind.Diya]: { color: 0xff8030, intensity: 1.6, distance: 4 },
  [LightKind.Moon]: { color: 0x7d96ff, intensity: 0, distance: 0 },
};

const POOL_RADIUS = 24;
const MOON_INTENSITY = 120;
const MOON_POOL = 2;
const BURST_RADIUS = 15;

/** Deterministic flicker: mostly steady, with stutters and short dropouts. */
export const flickerAt = (light: LightSpawn, t: number): number => {
  if (light.dead) return 0;
  if (light.flicker >= 1) return 1;
  const s = light.id * 12.9898;
  const slow = Math.sin(t * 0.9 + s) * 0.5 + 0.5;
  const fast = Math.sin(t * 37 + s * 3) * Math.sin(t * 23 + s);
  const gate = slow > light.flicker ? 1 : fast > 0.2 ? 1 : 0.08;
  return gate * (0.85 + 0.15 * Math.sin(t * 61 + s));
};

export interface LightsView {
  group: THREE.Group;
  update: (eye: THREE.Vector3, t: number, burst: number, burstAt: Vec2, powerOn: boolean) => void;
}

export const buildLightsView = (level: Level, poolSize: number, moonShadows: boolean): LightsView => {
  const group = new THREE.Group();
  group.name = "lights";
  const lights = level.lights.filter((l) => l.kind !== LightKind.Moon);

  const glowGeo: Record<string, THREE.BufferGeometry> = {
    [LightKind.TubeLight]: new THREE.BoxGeometry(1.2, 0.045, 0.09),
    [LightKind.Bulb]: new THREE.SphereGeometry(0.07, 10, 8),
    [LightKind.Lantern]: new THREE.CylinderGeometry(0.06, 0.06, 0.16, 8),
    [LightKind.Diya]: new THREE.ConeGeometry(0.025, 0.07, 6),
  };
  const glowMeshes = new Map<LightKind, { mesh: THREE.InstancedMesh; members: LightSpawn[] }>();
  for (const kind of [LightKind.TubeLight, LightKind.Bulb, LightKind.Lantern, LightKind.Diya]) {
    const members = lights.filter((l) => l.kind === kind);
    if (members.length === 0) continue;
    const mesh = new THREE.InstancedMesh(glowGeo[kind], new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), members.length);
    const m = new THREE.Matrix4();
    members.forEach((l, i) => {
      const room = level.rooms[l.roomId];
      const alongX = room ? room.rect.w >= room.rect.h : true;
      m.compose(
        new THREE.Vector3(l.x, l.y + (kind === LightKind.Diya ? 0.05 : 0), l.z),
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), alongX ? 0 : Math.PI / 2),
        new THREE.Vector3(1, 1, 1),
      );
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, new THREE.Color(0x000000));
    });
    mesh.name = `glow:${kind}`;
    group.add(mesh);
    glowMeshes.set(kind, { mesh, members });
  }
  const housing = new THREE.InstancedMesh(new THREE.BoxGeometry(1.3, 0.06, 0.16), new THREE.MeshStandardMaterial({ color: 0x3a3a36, roughness: 0.8 }), Math.max(1, lights.filter((l) => l.kind === LightKind.TubeLight).length));
  lights
    .filter((l) => l.kind === LightKind.TubeLight)
    .forEach((l, i) => {
      const room = level.rooms[l.roomId];
      const alongX = room ? room.rect.w >= room.rect.h : true;
      housing.setMatrixAt(
        i,
        new THREE.Matrix4().compose(
          new THREE.Vector3(l.x, WALL_HEIGHT - 0.04, l.z),
          new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), alongX ? 0 : Math.PI / 2),
          new THREE.Vector3(1, 1, 1),
        ),
      );
    });
  group.add(housing);

  const pool: THREE.PointLight[] = Array.from({ length: poolSize }, () => {
    const p = new THREE.PointLight(0xffffff, 0, 8, 2);
    p.castShadow = false;
    group.add(p);
    return p;
  });

  const courts = level.rooms
    .filter((r) => r.kind === RoomKind.Courtyard)
    .map((r) => ({
      cx: (r.rect.x + r.rect.w / 2) * CELL,
      cz: (r.rect.y + r.rect.h / 2) * CELL,
      angle: Math.atan((Math.max(r.rect.w, r.rect.h) * CELL * 0.75) / 16),
    }));
  // Two moon spots follow the nearest courtyards (one shadow map each at most).
  const moons = courts.slice(0, MOON_POOL).map(() => {
    const spot = new THREE.SpotLight(0x8ea6ff, 0, 34, 0.5, 0.6, 1.2);
    spot.castShadow = moonShadows;
    if (moonShadows) {
      spot.shadow.mapSize.set(1024, 1024);
      spot.shadow.bias = -0.0008;
    }
    group.add(spot, spot.target);
    return spot;
  });

  const color = new THREE.Color();
  const lastAssign = { t: -1 };
  let assigned: LightSpawn[] = [];

  const update = (eye: THREE.Vector3, t: number, burst: number, burstAt: Vec2, powerOn: boolean): void => {
    const level01 = (l: LightSpawn): number => {
      let f = flickerAt(l, t);
      if (burst > 0 && Math.hypot(l.x - burstAt.x, l.z - burstAt.z) < BURST_RADIUS) {
        f = Math.sin(t * 47 + l.id) > 0.3 ? 1.4 : 0;
        if (burst < 0.6) f = 0;
      }
      if (powerOn && !l.dead) f = Math.max(f, 0.6);
      return f;
    };
    for (const { mesh, members } of glowMeshes.values()) {
      members.forEach((l, i) => {
        const f = level01(l);
        const look = LOOK[l.kind];
        color.setHex(powerOn && l.kind === LightKind.TubeLight ? 0xff4030 : look.color).multiplyScalar(f * (l.kind === LightKind.TubeLight ? 2.2 : 3));
        mesh.setColorAt(i, color);
      });
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    if (t - lastAssign.t > 0.25 || lastAssign.t < 0) {
      lastAssign.t = t;
      assigned = lights
        .filter((l) => !l.dead && Math.abs(l.x - eye.x) < POOL_RADIUS && Math.abs(l.z - eye.z) < POOL_RADIUS)
        .sort((a, b) => Math.hypot(a.x - eye.x, a.z - eye.z) - Math.hypot(b.x - eye.x, b.z - eye.z))
        .slice(0, pool.length);
    }
    pool.forEach((p, i) => {
      const l = assigned[i];
      if (!l) {
        p.intensity = 0;
        return;
      }
      const look = LOOK[l.kind];
      p.position.set(l.x, l.y - (l.kind === LightKind.TubeLight ? 0.15 : 0), l.z);
      p.color.setHex(powerOn && l.kind === LightKind.TubeLight ? 0xff3a2a : look.color);
      p.distance = look.distance;
      p.intensity = look.intensity * level01(l);
    });
    // Toggling light visibility recompiles every shader, so spare moons just go dark instead.
    const nearest = [...courts].sort((a, b) => Math.hypot(a.cx - eye.x, a.cz - eye.z) - Math.hypot(b.cx - eye.x, b.cz - eye.z));
    moons.forEach((spot, i) => {
      const court = nearest[i];
      if (!court || Math.hypot(court.cx - eye.x, court.cz - eye.z) > 45) {
        spot.intensity = 0;
        return;
      }
      spot.position.set(court.cx - 3, 16, court.cz - 2);
      spot.target.position.set(court.cx, 0, court.cz);
      spot.angle = court.angle;
      spot.intensity = MOON_INTENSITY;
    });
  };
  return { group, update };
};
