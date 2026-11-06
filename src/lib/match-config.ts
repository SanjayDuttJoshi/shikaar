import { BuildingChoice } from "@/types/ui";
import { Theme } from "@/types/world";

/** "Baari-baari" alternates asylum and haveli every round; otherwise the chosen building. */
export const pickTheme = (choice: BuildingChoice, round: number): Theme => {
  if (choice === BuildingChoice.Asylum) return Theme.Asylum;
  if (choice === BuildingChoice.Haveli) return Theme.Haveli;
  return round % 2 === 0 ? Theme.Asylum : Theme.Haveli;
};

export const randomSeed = (): number => Math.floor(Math.random() * 2 ** 31);
