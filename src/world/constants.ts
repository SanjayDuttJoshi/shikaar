import { MonsterKind, Theme } from "@/types/world";

/** World scale. One grid cell is CELL metres square; walls sit on cell edges. */
export const CELL = 3;
export const WALL_HEIGHT = 3.2;
export const WALL_THICKNESS = 0.2;
export const DOOR_WIDTH = 1.2;
export const DOOR_HEIGHT = 2.25;
export const GATE_WIDTH = 2.4;
/** Resolution of the fine navigation / sight grid in metres. */
export const NAV_RES = 0.5;
/** Clear space kept in front of every door so furniture never blocks it. */
export const DOOR_CLEARANCE = 1.5;

export const WING_CELLS_MIN = 8;
export const WING_CELLS_MAX = 10;

export interface WingLayout {
  maxPlayers: number;
  cols: number;
  rows: number;
}

/** More players, bigger building: more wings, more keys, more fuses, more monsters. */
export const WING_LAYOUTS: WingLayout[] = [
  { maxPlayers: 2, cols: 2, rows: 1 },
  { maxPlayers: 4, cols: 3, rows: 1 },
  { maxPlayers: 6, cols: 2, rows: 2 },
  { maxPlayers: 8, cols: 3, rows: 2 },
];

export const MAX_PLAYERS = 8;

export const fusesFor = (players: number): number => Math.min(5, 2 + Math.floor((Math.max(1, players) - 1) / 2));

/**
 * Who hunts this round. Always the roaming Shikari plus at least one guardian with its own wing
 * (Andha Mareez in the asylum, Chudail in the haveli). Bigger groups get more of both.
 */
export const monsterPlan = (players: number, theme: Theme): MonsterKind[] => {
  const guardian = theme === Theme.Asylum ? MonsterKind.Mareez : MonsterKind.Chudail;
  const roamers = players >= 6 ? 2 : 1;
  const guardians = players <= 3 ? 1 : 2;
  return [...Array.from({ length: roamers }, () => MonsterKind.Shikari), ...Array.from({ length: guardians }, () => guardian)];
};

/** Envelopes hidden in each building, one per story film. */
export const STORY_ENVELOPES = 4;
