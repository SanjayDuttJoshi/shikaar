import type { Difficulty } from "@/types/game";
import type { BuildingChoice } from "@/types/ui";
import type { Theme } from "@/types/world";

/** Message channels between squad members. Trystero action names must stay ≤ 12 bytes. */
export enum Channel {
  /** Anyone → a newly seen peer: who I am. */
  Hello = "hello",
  /** Host → everyone: the lobby (members, settings, status). */
  Lobby = "lobby",
  /** Host → everyone: a round begins. */
  Start = "start",
  /** Client → host: level and models loaded for this round. */
  Ready = "ready",
  /** Host → clients: world snapshot plus the events since the last one. */
  Snap = "snap",
  /** Client → host: where my body is. */
  Pose = "pose",
  /** Client → host: a button press (use, flash, torch, quit round). */
  Act = "act",
  /** Host → everyone: the round was cancelled (host left it). */
  Abort = "abort",
}

export enum LobbyStatus {
  Waiting = "waiting",
  Playing = "playing",
}

/** Where this tab is in the room's life. */
export enum RoomStatus {
  Connecting = "connecting",
  Lobby = "lobby",
  Playing = "playing",
  Error = "error",
}

/** Which network carries the room: the internet (Trystero) or other tabs of this browser (tests). */
export enum NetKind {
  Online = "online",
  Local = "local",
}

export enum ActionKind {
  Interact = "interact",
  Flash = "flash",
  Torch = "torch",
  /** The player left the round (back to the lobby) but stays in the room. */
  Quit = "quit",
}

export interface LobbyMember {
  peerId: string;
  name: string;
  /** Index into the squad colour palette. */
  color: number;
}

export interface LobbySettings {
  difficulty: Difficulty;
  building: BuildingChoice;
}

export interface LobbyState {
  version: number;
  code: string;
  hostId: string;
  members: LobbyMember[];
  settings: LobbySettings;
  status: LobbyStatus;
  /** Rounds played in this room (the building alternates with it). */
  round: number;
  /** Peers taking part in the round being played. */
  inRound: string[];
}

export interface RosterEntry {
  id: string;
  name: string;
  color: number;
}

/** Everything every squad member needs to build the same round. */
export interface RoundStart {
  round: number;
  seed: number;
  theme: Theme;
  difficulty: Difficulty;
  players: RosterEntry[];
  /** Counts from the host's level, to catch a mismatching build. */
  fingerprint: string;
}

/** What the lobby screen shows. */
export interface RoomView {
  status: RoomStatus;
  code: string;
  selfId: string;
  isHost: boolean;
  lobby: LobbyState | null;
  /** Round to play; changes each time the host starts one. */
  round: RoundStart | null;
  /** Shown on the lobby screen (host left, round cancelled, room full...). */
  notice: string;
}
