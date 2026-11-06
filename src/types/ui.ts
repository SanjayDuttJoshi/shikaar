import type { Difficulty, PlayerStatus, RoundOutcome, RoundPhase } from "@/types/game";
import type { Quality } from "@/types/render";
import type { HideKind, KeyColor, Theme } from "@/types/world";

export enum MessageTone {
  Info = "info",
  Good = "good",
  Danger = "danger",
  Voice = "voice",
}

export interface HudMessage {
  id: number;
  text: string;
  tone: MessageTone;
  until: number;
}

export interface TeammateInfo {
  id: string;
  name: string;
  status: PlayerStatus;
  distance: number;
}

export interface HudSnapshot {
  phase: RoundPhase;
  outcome: RoundOutcome;
  theme: Theme;
  status: PlayerStatus;
  health: number;
  stamina: number;
  exhausted: boolean;
  battery: number;
  torchOn: boolean;
  flashReady: number;
  prompt: string;
  promptHold: number;
  keys: KeyColor[];
  keysTotal: number;
  fusesInserted: number;
  fusesNeeded: number;
  carrying: boolean;
  objective: string;
  gateTimer: number;
  messages: HudMessage[];
  teammates: TeammateInfo[];
  hidden: boolean;
  hideKind: HideKind | null;
  /** Story film offered by an envelope just opened, or -1. */
  offer: number;
  offerTitle: string;
  /** A story film playing (or loading). */
  film: { title: string | null; subtitle: string; progress: number } | null;
  filmsUnlocked: Array<{ index: number; title: string }>;
  notesFound: number;
  notesTotal: number;
  bleed: number;
  time: number;
  paused: boolean;
  /** Squad round (the world keeps going while paused). */
  online: boolean;
  /** Names the host is still waiting for while the round loads. */
  waiting: string;
  /** Name of the friend you're watching after dying/escaping. */
  watching: string;
}

export enum Screen {
  Home = "home",
  Lobby = "lobby",
  Loading = "loading",
  Playing = "playing",
  Results = "results",
}

export enum BuildingChoice {
  Alternate = "alternate",
  Asylum = "asylum",
  Haveli = "haveli",
}

export interface Settings {
  name: string;
  difficulty: Difficulty;
  building: BuildingChoice;
  quality: Quality;
  sensitivity: number;
  volume: number;
  /** Exposure multiplier: horror games let players lift the dark to suit their screen. */
  brightness: number;
  keys: KeyBindings;
  invertY: boolean;
  language: Language;
}

export interface RoundResult {
  outcome: RoundOutcome;
  theme: Theme;
  seconds: number;
  keysFound: number;
  keysTotal: number;
  fusesInserted: number;
  fusesNeeded: number;
  timesHit: number;
  escaped: boolean;
  notesFound: number;
  notesTotal: number;
}

/** Things a key can do. Mouse look, left-click (use) and right-click (flash) stay fixed. */
export enum KeyAction {
  Forward = "forward",
  Back = "back",
  Left = "left",
  Right = "right",
  Sprint = "sprint",
  Crouch = "crouch",
  Use = "use",
  Torch = "torch",
  Flash = "flash",
}

export enum ControlPreset {
  Wasd = "wasd",
  Arrows = "arrows",
}

/** Up to two keys (KeyboardEvent.code) per action. */
export type KeyBindings = Record<KeyAction, string[]>;

/** Language of every spoken line (monsters, announcer, story films) and its subtitles. */
export enum Language {
  Hindi = "hi",
  English = "en",
}
