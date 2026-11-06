import { Difficulty } from "@/types/game";
import { Quality } from "@/types/render";
import { BuildingChoice, Language } from "@/types/ui";

export const DIFFICULTY_OPTIONS = [
  { value: Difficulty.Easy, label: "Aasaan" },
  { value: Difficulty.Normal, label: "Normal" },
  { value: Difficulty.Hard, label: "Khatarnak" },
];

export const BUILDING_OPTIONS = [
  { value: BuildingChoice.Alternate, label: "Baari-baari" },
  { value: BuildingChoice.Asylum, label: "Pagalkhana" },
  { value: BuildingChoice.Haveli, label: "Haveli" },
];

export const LANGUAGE_OPTIONS = [
  { value: Language.Hindi, label: "Hindi awaaz" },
  { value: Language.English, label: "English voice" },
];

export const QUALITY_OPTIONS = [
  { value: Quality.Low, label: "Halka" },
  { value: Quality.Medium, label: "Medium" },
  { value: Quality.High, label: "Best" },
];

export const optionLabel = <T extends string>(options: Array<{ value: T; label: string }>, value: T): string => options.find((o) => o.value === value)?.label ?? value;
