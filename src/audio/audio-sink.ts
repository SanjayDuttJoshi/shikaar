import type { UiSound } from "@/types/audio";
import type { GameEvent, PlayerState, WorldState } from "@/types/game";
import type { Level } from "@/types/world";

export interface ListenerPose {
  x: number;
  y: number;
  z: number;
  yaw: number;
}

export interface AudioFrame {
  listener: ListenerPose;
  state: WorldState;
  self: PlayerState | null;
  dt: number;
  /** 0..1 how close the nearest monster is. */
  dread: number;
  chasing: boolean;
}

/** What the game loop needs from the sound system. A silent sink is used until audio unlocks. */
export interface AudioSink {
  event: (e: GameEvent, state: WorldState, level: Level, selfId: string) => void;
  update: (frame: AudioFrame) => void;
  footstep: (x: number, z: number, loud: number, self: boolean) => void;
  ui: (sound: UiSound) => void;
  setPaused: (paused: boolean) => void;
  setVolume: (volume: number) => void;
  /** Called whenever a voice line starts, so the HUD can subtitle it. */
  onLine: (listener: (id: string) => void) => void;
  /** Plays a voice line "in your head" (story narration). Returns its length in seconds (0 if missing). */
  playLine: (id: string) => number;
  /** Fetches extra voice lines ahead of time (story films). */
  loadLines: (ids: string[]) => Promise<void>;
  /** 0..1: turns the world down while a story film plays. */
  duck: (amount: number) => void;
  dispose: () => void;
}

export const SILENT_AUDIO: AudioSink = {
  event: () => undefined,
  update: () => undefined,
  footstep: () => undefined,
  ui: () => undefined,
  setPaused: () => undefined,
  setVolume: () => undefined,
  onLine: () => undefined,
  playLine: () => 0,
  loadLines: async () => undefined,
  duck: () => undefined,
  dispose: () => undefined,
};
