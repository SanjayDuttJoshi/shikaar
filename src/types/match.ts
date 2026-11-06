import type { Difficulty } from "@/types/game";
import type { Quality } from "@/types/render";
import type { Theme } from "@/types/world";

/** Everything needed to start one round. */
export interface MatchConfig {
  theme: Theme;
  seed: number;
  difficulty: Difficulty;
  quality: Quality;
  name: string;
  round: number;
}
