import { MonsterKind } from "@/types/world";

/** How each monster differs from the base tuning (all values multiply the difficulty tuning). */
export interface KindProfile {
  /** Cannot see at all; hunts only by sound (and touch). */
  blind: boolean;
  hearing: number;
  sightLit: number;
  sightDark: number;
  patrol: number;
  investigate: number;
  chase: number;
  /** Multiplies how long it keeps chasing after losing you. */
  lose: number;
  /** Speed multiplier while enraged (Chudail after being stared at). */
  rage: number;
  /** Looking at it for too long sets it off. */
  stare: boolean;
  /** Keeps to its own wing unless chasing someone. */
  territorial: boolean;
}

export const KIND_PROFILES: Record<MonsterKind, KindProfile> = {
  [MonsterKind.Shikari]: {
    blind: false,
    hearing: 1,
    sightLit: 1,
    sightDark: 1,
    patrol: 1,
    investigate: 1,
    chase: 1,
    lose: 1,
    rage: 1,
    stare: false,
    territorial: false,
  },
  [MonsterKind.Mareez]: {
    blind: true,
    hearing: 2.1,
    sightLit: 0,
    sightDark: 0,
    patrol: 0.75,
    investigate: 1.3,
    chase: 1.08,
    lose: 0.45,
    rage: 1,
    stare: false,
    territorial: true,
  },
  [MonsterKind.Chudail]: {
    blind: false,
    hearing: 0.6,
    sightLit: 1.35,
    sightDark: 0.65,
    patrol: 0.85,
    investigate: 1,
    chase: 0.95,
    lose: 1.2,
    rage: 1.3,
    stare: true,
    territorial: true,
  },
};

/** Seconds of staring at the Chudail before she shrieks and comes for you. */
export const STARE_LIMIT = 1.6;
export const STARE_RANGE = 14;
export const STARE_CONE_COS = Math.cos((22 * Math.PI) / 180);
export const RAGE_SECONDS = 6;
/** A blind monster "feels" anyone this close even if they're silent. */
export const BLIND_TOUCH_RANGE = 1.3;
