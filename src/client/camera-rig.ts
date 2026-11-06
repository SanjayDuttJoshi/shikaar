import { PlayerStatus, Stance } from "@/types/game";
import type { PlayerState } from "@/types/game";
import type { Level, Vec2 } from "@/types/world";
import { CROUCH_EYE_HEIGHT, EYE_HEIGHT } from "@/game/constants";
import { hideEye } from "@/game/hiding";
import type { EyePose } from "@/render3d/scene-view";

const DOWNED_EYE = 0.42;
const DEAD_EYE = 0.18;
const BOB_STEP = Math.PI;

export interface CameraRig {
  pose: EyePose;
  /** Fires `onStep` each time a foot lands (for footstep sounds). */
  update: (p: PlayerState, level: Level, dt: number, onStep: (loud: number) => void) => EyePose;
  shake: (amount: number) => void;
  /** Snap the view toward a point for a jump-scare (monster grab). */
  lookAt: (target: Vec2, seconds: number) => void;
}

const angleDelta = (a: number, b: number): number => {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
};

export const createCameraRig = (start: PlayerState): CameraRig => {
  const pose: EyePose = { x: start.x, y: EYE_HEIGHT, z: start.z, yaw: start.yaw, pitch: 0, roll: 0 };
  let eyeY = EYE_HEIGHT;
  let bob = 0;
  let lastFoot = 0;
  let shakeAmp = 0;
  let deathTilt = 0;
  let lookTarget: Vec2 | null = null;
  let lookTime = 0;
  let lookYaw = 0;

  const update = (p: PlayerState, level: Level, dt: number, onStep: (loud: number) => void): EyePose => {
    const speed = Math.hypot(p.vx, p.vz);
    if (p.status === PlayerStatus.Hiding && p.hideSpot >= 0) {
      const eye = hideEye(level, level.hideSpots[p.hideSpot]);
      pose.x += (eye.x - pose.x) * Math.min(1, dt * 10);
      pose.z += (eye.z - pose.z) * Math.min(1, dt * 10);
      eyeY += (eye.y - eyeY) * Math.min(1, dt * 8);
    } else {
      pose.x = p.x;
      pose.z = p.z;
      const target =
        p.status === PlayerStatus.Dead
          ? DEAD_EYE
          : p.status === PlayerStatus.Downed
            ? DOWNED_EYE
            : p.stance === Stance.Crouch
              ? CROUCH_EYE_HEIGHT
              : EYE_HEIGHT;
      eyeY += (target - eyeY) * Math.min(1, dt * (p.status === PlayerStatus.Dead ? 3 : 9));
    }
    const moving = speed > 0.3 && p.status !== PlayerStatus.Hiding;
    const rate = p.stance === Stance.Sprint ? 2.25 : p.stance === Stance.Crouch ? 1.5 : 1.9;
    if (moving) bob += speed * dt * rate;
    const foot = Math.floor(bob / BOB_STEP);
    if (foot !== lastFoot && moving) {
      lastFoot = foot;
      onStep(p.stance === Stance.Sprint ? 1 : p.stance === Stance.Crouch ? 0.25 : 0.6);
    }
    const amp = moving ? Math.min(1, speed / 4.5) : 0;
    const bobY = Math.abs(Math.sin(bob)) * 0.06 * amp - 0.03 * amp;
    const sway = Math.sin(bob) * 0.012 * amp;
    shakeAmp = Math.max(0, shakeAmp - dt * 1.8);
    const jitter = shakeAmp * shakeAmp;
    deathTilt += ((p.status === PlayerStatus.Dead || p.status === PlayerStatus.Downed ? 1 : 0) - deathTilt) * Math.min(1, dt * 2.5);

    let yaw = p.yaw;
    if (lookTarget && lookTime > 0) {
      lookTime -= dt;
      const want = Math.atan2(-(lookTarget.x - pose.x), -(lookTarget.z - pose.z));
      lookYaw += angleDelta(lookYaw, want) * Math.min(1, dt * 14);
      yaw = lookYaw;
      if (lookTime <= 0) lookTarget = null;
    }
    pose.y = eyeY + bobY + (Math.random() - 0.5) * jitter * 0.08;
    pose.yaw = yaw + (Math.random() - 0.5) * jitter * 0.06;
    pose.pitch = (lookTarget ? 0.12 : p.pitch) + (Math.random() - 0.5) * jitter * 0.06;
    pose.roll = sway + deathTilt * 0.45 + (Math.random() - 0.5) * jitter * 0.05;
    return pose;
  };

  return {
    pose,
    update,
    shake: (amount) => {
      shakeAmp = Math.min(1.4, Math.max(shakeAmp, amount));
    },
    lookAt: (target, seconds) => {
      lookTarget = target;
      lookTime = seconds;
      lookYaw = pose.yaw;
    },
  };
};
