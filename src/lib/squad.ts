/** Name-tag colours, one per squad slot (the lobby hands them out). */
export const SQUAD_COLORS = [0xe8c36a, 0x7fc8ff, 0xff8a7a, 0x9be38f, 0xd59bff, 0xffb35c];

/** Character models for squad members; a member's colour slot picks one. */
export const SURVIVOR_FILES = ["survivor-male-a", "survivor-female-a", "survivor-male-b", "survivor-female-b"];

export const survivorFor = (color: number): string => SURVIVOR_FILES[Math.abs(color) % SURVIVOR_FILES.length];

export const squadCss = (color: number): string => `#${(SQUAD_COLORS[Math.abs(color) % SQUAD_COLORS.length] ?? 0xffffff).toString(16).padStart(6, "0")}`;
