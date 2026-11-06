import { Difficulty } from "@/types/game";

export const TICK_HZ = 30;
export const TICK_DT = 1 / TICK_HZ;

export const PLAYER_RADIUS = 0.3;
export const MONSTER_RADIUS = 0.38;
export const EYE_HEIGHT = 1.62;
export const CROUCH_EYE_HEIGHT = 1.0;
export const HIDE_EYE_HEIGHT = 1.45;
export const UNDER_BED_EYE_HEIGHT = 0.25;

export const WALK_SPEED = 2.6;
export const SPRINT_SPEED = 4.7;
export const CROUCH_SPEED = 1.35;
export const DOWNED_SPEED = 0.35;
export const ACCELERATION = 14;

export const STAMINA_MAX = 100;
export const STAMINA_DRAIN = 14;
export const STAMINA_REGEN = 14;
export const STAMINA_RECOVER_AT = 30;

export const BATTERY_MAX = 100;
export const BATTERY_DRAIN = 0.55;
export const BATTERY_PICKUP = 45;
export const BATTERY_LOW = 20;
export const FLASH_COST = 20;
export const FLASH_COOLDOWN = 6;
export const FLASH_RANGE = 9;
export const FLASH_CONE_COS = Math.cos((32 * Math.PI) / 180);
export const STUN_SECONDS = 2.8;
export const STUN_IMMUNITY = 9;

export const MAX_HEALTH = 2;
export const BLEED_SECONDS = 40;
export const REVIVE_SECONDS = 3.2;
export const MERCY_SECONDS = 3;

export const INTERACT_RANGE = 1.9;
export const REVIVE_RANGE = 1.6;
export const FUSE_BOX_RANGE = 1.8;

/** Footstep noise radius by movement type (metres). */
export const NOISE_SPRINT = 13;
export const NOISE_WALK = 5.5;
export const NOISE_CROUCH = 1.2;
export const NOISE_DOOR = 8;
export const NOISE_FLASH = 14;
export const NOISE_PICKUP = 4;

export const INTRO_SECONDS = 6;
export const GATE_OPEN_SECONDS = 15;
export const END_SECONDS = 3;

export interface MonsterTuning {
  patrolSpeed: number;
  investigateSpeed: number;
  chaseSpeed: number;
  enragedBonus: number;
  fovCos: number;
  /** Sight range against a player whose torch is on / off / crouching in the dark. */
  sightLit: number;
  sightDark: number;
  sightSneak: number;
  /** Always senses a player this close, even without sight. */
  senseRange: number;
  loseAfter: number;
  searchSeconds: number;
  attackRange: number;
  attackWindup: number;
  recoverSeconds: number;
  hearingScale: number;
  /** After this long without meeting anyone, the director nudges the monster toward a player. */
  hintAfter: number;
}

export const MONSTER_TUNING: Record<Difficulty, MonsterTuning> = {
  [Difficulty.Easy]: {
    patrolSpeed: 1.5,
    investigateSpeed: 2.3,
    chaseSpeed: 3.6,
    enragedBonus: 0.3,
    fovCos: Math.cos((50 * Math.PI) / 180),
    sightLit: 18,
    sightDark: 7,
    sightSneak: 3.5,
    senseRange: 1.6,
    loseAfter: 2.2,
    searchSeconds: 6,
    attackRange: 1.25,
    attackWindup: 0.6,
    recoverSeconds: 3.6,
    hearingScale: 0.7,
    hintAfter: 110,
  },
  [Difficulty.Normal]: {
    patrolSpeed: 1.7,
    investigateSpeed: 2.6,
    chaseSpeed: 4.2,
    enragedBonus: 0.4,
    fovCos: Math.cos((55 * Math.PI) / 180),
    sightLit: 22,
    sightDark: 9,
    sightSneak: 4.5,
    senseRange: 2,
    loseAfter: 3.4,
    searchSeconds: 9,
    attackRange: 1.3,
    attackWindup: 0.45,
    recoverSeconds: 2.6,
    hearingScale: 1,
    hintAfter: 80,
  },
  [Difficulty.Hard]: {
    patrolSpeed: 1.9,
    investigateSpeed: 3,
    chaseSpeed: 4.5,
    enragedBonus: 0.45,
    fovCos: Math.cos((62 * Math.PI) / 180),
    sightLit: 26,
    sightDark: 11,
    sightSneak: 5.5,
    senseRange: 2.4,
    loseAfter: 4.2,
    searchSeconds: 12,
    attackRange: 1.35,
    attackWindup: 0.35,
    recoverSeconds: 2.1,
    hearingScale: 1.25,
    hintAfter: 60,
  },
};

/** Seconds after the intro during which the Shikari keeps to the far side of the building. */
export const GRACE_SECONDS: Record<Difficulty, number> = {
  [Difficulty.Easy]: 75,
  [Difficulty.Normal]: 40,
  [Difficulty.Hard]: 25,
};
/** How long the monster stands bashing a closed door before it gives. */
export const DOOR_BASH_SECONDS = 0.7;

export const SCARE_MIN_GAP = 22;
export const SCARE_MAX_GAP = 50;
export const TAUNT_MIN_GAP = 9;
export const TAUNT_MAX_GAP = 18;
