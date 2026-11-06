import { Difficulty } from "@/types/game";
import { BuildingChoice, ControlPreset, Language } from "@/types/ui";
import { KEY_PRESETS, isValidBindings } from "@/lib/key-bindings";
import type { Settings } from "@/types/ui";
import { detectQuality } from "@/lib/quality";
import { Quality } from "@/types/render";

const STORAGE_KEY = "shikaar-settings-v1";

/** Same on server and client so the first render hydrates cleanly; real values load after mount. */
export const SSR_SETTINGS: Settings = {
  name: "",
  difficulty: Difficulty.Normal,
  building: BuildingChoice.Alternate,
  quality: Quality.Medium,
  sensitivity: 1,
  volume: 0.9,
  brightness: 1.2,
  keys: KEY_PRESETS[ControlPreset.Wasd],
  invertY: false,
  language: Language.Hindi,
};

export const defaultSettings = (): Settings => ({ ...SSR_SETTINGS, quality: detectQuality() });

const isEnumValue = <T extends string>(values: Record<string, T>, v: unknown): v is T =>
  typeof v === "string" && (Object.values(values) as string[]).includes(v);

/** Reads saved settings; anything missing or malformed falls back to defaults. */
export const loadSettings = (): Settings => {
  const base = defaultSettings();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return base;
    const v = JSON.parse(raw) as Record<string, unknown>;
    return {
      name: typeof v.name === "string" ? v.name.slice(0, 16) : base.name,
      difficulty: isEnumValue(Difficulty, v.difficulty) ? v.difficulty : base.difficulty,
      building: isEnumValue(BuildingChoice, v.building) ? v.building : base.building,
      quality: isEnumValue(Quality, v.quality) ? v.quality : base.quality,
      sensitivity: typeof v.sensitivity === "number" && v.sensitivity >= 0.2 && v.sensitivity <= 3 ? v.sensitivity : base.sensitivity,
      volume: typeof v.volume === "number" && v.volume >= 0 && v.volume <= 1 ? v.volume : base.volume,
      brightness: typeof v.brightness === "number" && v.brightness >= 0.6 && v.brightness <= 2 ? v.brightness : base.brightness,
      keys: isValidBindings(v.keys) ? v.keys : base.keys,
      invertY: typeof v.invertY === "boolean" ? v.invertY : base.invertY,
      language: isEnumValue(Language, v.language) ? v.language : base.language,
    };
  } catch {
    return base;
  }
};

export const saveSettings = (s: Settings): void => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // Private mode or blocked storage: settings just won't persist.
  }
};
