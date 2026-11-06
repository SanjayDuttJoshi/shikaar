import type { Level } from "@/types/world";

/** Counts that differ if two builds of the game would generate different buildings from the same seed. */
export const levelFingerprint = (level: Level): string =>
  [level.width, level.height, level.rooms.length, level.doors.length, level.items.length, level.props.length, level.hideSpots.length, level.monsterSpawns.length, level.setPieces.length].join(".");
