import { KeyColor, Theme } from "@/types/world";

const KEY_NAMES: Record<KeyColor, string> = {
  [KeyColor.Red]: "Laal",
  [KeyColor.Blue]: "Neeli",
  [KeyColor.Green]: "Hari",
  [KeyColor.Yellow]: "Peeli",
  [KeyColor.Purple]: "Jamuni",
};

export const KEY_HEX: Record<KeyColor, string> = {
  [KeyColor.Red]: "#ff3b3b",
  [KeyColor.Blue]: "#3b8bff",
  [KeyColor.Green]: "#3bff7a",
  [KeyColor.Yellow]: "#ffd23b",
  [KeyColor.Purple]: "#c13bff",
};

export const keyLabel = (color: KeyColor | null): string => (color === null ? "Main" : KEY_NAMES[color]);

export const THEME_TITLE: Record<Theme, string> = {
  [Theme.Asylum]: "Purana Pagalkhana",
  [Theme.Haveli]: "Purani Haveli",
};
