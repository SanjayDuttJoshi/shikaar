/**
 * Smooths a body that is only heard about ~15 times a second (monsters and squad members on a client,
 * squad members on the host): each update glides from where it is drawn now to the new spot over one
 * update interval, and keeps drifting a little past it if the next update is late.
 */
export interface Track {
  fromX: number;
  fromZ: number;
  fromYaw: number;
  toX: number;
  toZ: number;
  toYaw: number;
  age: number;
  span: number;
}

const MIN_SPAN = 0.03;
const MAX_SPAN = 0.25;
const OVERSHOOT = 1.25;
/** Jumps further than this are teleports (hiding, respawn): snap instead of gliding through walls. */
const SNAP_DISTANCE = 4;

const wrap = (a: number): number => {
  let r = a;
  while (r > Math.PI) r -= Math.PI * 2;
  while (r < -Math.PI) r += Math.PI * 2;
  return r;
};

export const createTrack = (x: number, z: number, yaw: number): Track => ({ fromX: x, fromZ: z, fromYaw: yaw, toX: x, toZ: z, toYaw: yaw, age: 1, span: 0.07 });

export interface TrackPose {
  x: number;
  z: number;
  yaw: number;
}

export const samplePose = (t: Track): TrackPose => {
  const a = Math.min(OVERSHOOT, t.age / t.span);
  return {
    x: t.fromX + (t.toX - t.fromX) * a,
    z: t.fromZ + (t.toZ - t.fromZ) * a,
    yaw: t.fromYaw + wrap(t.toYaw - t.fromYaw) * Math.min(1, a),
  };
};

/** New target. `interval` is the measured time since the previous update. */
export const retarget = (t: Track, x: number, z: number, yaw: number, interval: number): void => {
  const now = samplePose(t);
  const far = Math.hypot(x - now.x, z - now.z) > SNAP_DISTANCE;
  t.fromX = far ? x : now.x;
  t.fromZ = far ? z : now.z;
  t.fromYaw = far ? yaw : now.yaw;
  t.toX = x;
  t.toZ = z;
  t.toYaw = yaw;
  t.age = 0;
  t.span = Math.max(MIN_SPAN, Math.min(MAX_SPAN, t.span * 0.7 + interval * 0.3));
};

/** Jumps straight to a spot (host moved the body: hiding, getting pulled out). */
export const snapTrack = (t: Track, x: number, z: number, yaw: number): void => {
  t.fromX = x;
  t.fromZ = z;
  t.fromYaw = yaw;
  t.toX = x;
  t.toZ = z;
  t.toYaw = yaw;
  t.age = t.span;
};

export const advance = (t: Track, dt: number): TrackPose => {
  t.age += dt;
  return samplePose(t);
};
