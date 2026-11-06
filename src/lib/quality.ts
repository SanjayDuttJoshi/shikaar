import { Quality } from "@/types/render";
import type { QualitySettings } from "@/types/render";

export const QUALITY_SETTINGS: Record<Quality, QualitySettings> = {
  [Quality.Low]: { pixelRatio: 0.85, torchShadow: 0, lightPool: 4, postFx: true, antialias: false, drawDistance: 34, mateTorches: 0 },
  [Quality.Medium]: { pixelRatio: 1.15, torchShadow: 512, lightPool: 6, postFx: true, antialias: false, drawDistance: 42, mateTorches: 1 },
  [Quality.High]: { pixelRatio: 1.6, torchShadow: 1024, lightPool: 8, postFx: true, antialias: true, drawDistance: 50, mateTorches: 2 },
};

/** Phones and small touch screens start on Low; laptops on Medium. Players can change it. */
export const detectQuality = (): Quality => {
  if (typeof window === "undefined") return Quality.Medium;
  const touch = window.matchMedia?.("(pointer: coarse)").matches ?? false;
  const small = Math.min(window.innerWidth, window.innerHeight) < 600;
  if (touch || small) return Quality.Low;
  return Quality.Medium;
};
