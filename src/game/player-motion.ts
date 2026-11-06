import { PlayerStatus, Stance } from "@/types/game";
import type { PlayerInput, PlayerState, WorldState } from "@/types/game";
import { moveCircle } from "@/game/collision";
import {
  ACCELERATION,
  BATTERY_DRAIN,
  CROUCH_SPEED,
  DOWNED_SPEED,
  NOISE_CROUCH,
  NOISE_SPRINT,
  NOISE_WALK,
  PLAYER_RADIUS,
  SPRINT_SPEED,
  STAMINA_DRAIN,
  STAMINA_MAX,
  STAMINA_RECOVER_AT,
  STAMINA_REGEN,
  WALK_SPEED,
} from "@/game/constants";
import { doorOpenness } from "@/game/context";
import type { GameContext } from "@/game/context";

const PITCH_LIMIT = 1.45;

/** Camera forward on the ground plane for a yaw (three.js cameras look down -Z). */
export const forwardOf = (yaw: number): { x: number; z: number } => ({ x: -Math.sin(yaw), z: -Math.cos(yaw) });

const canMove = (p: PlayerState): boolean => p.status === PlayerStatus.Alive || p.status === PlayerStatus.Downed;

/** Torch battery, flash cooldown and the mercy timer. The host runs this for squad members' bodies it doesn't move. */
export const stepVitals = (p: PlayerState, dt: number): void => {
  p.flashCooldown = Math.max(0, p.flashCooldown - dt);
  p.sinceHit += dt;
  if (p.torchOn) {
    p.battery = Math.max(0, p.battery - BATTERY_DRAIN * dt);
    if (p.battery <= 0) p.torchOn = false;
  }
};

/**
 * Moves the local player. Each client simulates its own body (co-op, no cheating to guard against);
 * the host only checks interactions.
 */
export const stepPlayerMotion = (ctx: GameContext, state: WorldState, p: PlayerState, input: PlayerInput, dt: number): void => {
  p.yaw = input.yaw;
  p.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, input.pitch));
  stepVitals(p, dt);

  if (!canMove(p)) {
    p.vx = 0;
    p.vz = 0;
    p.noise = 0;
    p.stamina = Math.min(STAMINA_MAX, p.stamina + STAMINA_REGEN * dt);
    if (p.exhausted && p.stamina >= STAMINA_RECOVER_AT) p.exhausted = false;
    return;
  }

  const downed = p.status === PlayerStatus.Downed;
  const wants = Math.hypot(input.moveX, input.moveZ);
  const moving = wants > 0.05;
  const sprinting = !downed && input.sprint && moving && !p.exhausted && !input.crouch && input.moveZ > 0.2;
  p.stance = downed ? Stance.Crouch : sprinting ? Stance.Sprint : input.crouch ? Stance.Crouch : Stance.Walk;

  if (sprinting) {
    p.stamina = Math.max(0, p.stamina - STAMINA_DRAIN * dt);
    if (p.stamina <= 0) p.exhausted = true;
  } else {
    p.stamina = Math.min(STAMINA_MAX, p.stamina + STAMINA_REGEN * dt * (moving ? 0.6 : 1));
    if (p.exhausted && p.stamina >= STAMINA_RECOVER_AT) p.exhausted = false;
  }

  const speed = downed ? DOWNED_SPEED : sprinting ? SPRINT_SPEED : p.stance === Stance.Crouch ? CROUCH_SPEED : WALK_SPEED;
  const scale = Math.min(1, wants);
  const fwd = forwardOf(p.yaw);
  const right = { x: Math.cos(p.yaw), z: -Math.sin(p.yaw) };
  const nx = moving ? input.moveX / Math.max(1, wants) : 0;
  const nz = moving ? input.moveZ / Math.max(1, wants) : 0;
  const targetVx = (fwd.x * nz + right.x * nx) * speed * scale;
  const targetVz = (fwd.z * nz + right.z * nx) * speed * scale;
  const blend = Math.min(1, ACCELERATION * dt);
  p.vx += (targetVx - p.vx) * blend;
  p.vz += (targetVz - p.vz) * blend;

  const next = moveCircle(ctx.world, p, p.vx * dt, p.vz * dt, PLAYER_RADIUS, doorOpenness(state));
  const realSpeed = Math.hypot(next.x - p.x, next.z - p.z) / Math.max(dt, 1e-6);
  p.x = next.x;
  p.z = next.z;
  if (realSpeed < 0.4) p.noise = 0;
  else p.noise = p.stance === Stance.Sprint ? NOISE_SPRINT : p.stance === Stance.Crouch ? NOISE_CROUCH : NOISE_WALK;
};
