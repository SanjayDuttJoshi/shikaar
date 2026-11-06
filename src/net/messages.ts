import { Difficulty, InteractKind } from "@/types/game";
import type { PlayerState } from "@/types/game";
import { ActionKind, LobbyStatus } from "@/types/net";
import type { LobbyMember, LobbySettings, LobbyState, RosterEntry, RoundStart } from "@/types/net";
import { BuildingChoice } from "@/types/ui";
import { Theme } from "@/types/world";
import { isEnumValue, isFiniteNumber, isNumberArray, isRecord, isString } from "@/lib/guards";

/** Separate relay namespace for this game, so it never meets NEON GOAL rooms. */
export const APP_ID = "shikaar-squad-v1-sdj";
export const PROTOCOL_VERSION = 1;
export const MAX_SQUAD = 6;
export const MAX_NAME = 16;

export interface HelloMessage {
  v: number;
  name: string;
}

/** Client body: x, z, yaw, pitch, vx, vz, stance, stamina, exhausted, noise, epoch, revive target index (-1 none). */
export type PoseWire = number[];
export const POSE_FIELDS = 12;

export interface ActMessage {
  a: ActionKind;
  /** For ActionKind.Interact. */
  k?: InteractKind;
  id?: number;
}

export interface ReadyMessage {
  round: number;
}

export interface AbortMessage {
  round: number;
  reason: string;
}

const r2 = (v: number): number => Math.round(v * 100) / 100;
const r3 = (v: number): number => Math.round(v * 1000) / 1000;

export const sanitizeName = (raw: string): string => {
  const cleaned = raw
    .replace(/[\u0000-\u001f\u007f<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_NAME)
    .trim();
  return cleaned.length > 0 ? cleaned : "Dost";
};

export const parseHello = (value: unknown): HelloMessage | null =>
  isRecord(value) && isFiniteNumber(value.v) && isString(value.name, 64) ? { v: value.v, name: sanitizeName(value.name) } : null;

export const encodePose = (p: PlayerState, epoch: number, reviveIndex: number): PoseWire => [
  r2(p.x),
  r2(p.z),
  r3(p.yaw),
  r3(p.pitch),
  r2(p.vx),
  r2(p.vz),
  p.stance,
  r2(p.stamina),
  p.exhausted ? 1 : 0,
  r2(p.noise),
  epoch,
  reviveIndex,
];

export const parsePose = (value: unknown): PoseWire | null => (isNumberArray(value, POSE_FIELDS) && value.length === POSE_FIELDS ? value : null);

const INTERACT_KINDS = Object.values(InteractKind);
const ACTION_KINDS = Object.values(ActionKind);

export const parseAct = (value: unknown): ActMessage | null => {
  if (!isRecord(value) || !isEnumValue(ACTION_KINDS, value.a)) return null;
  if (value.a !== ActionKind.Interact) return { a: value.a };
  if (!isEnumValue(INTERACT_KINDS, value.k) || !isFiniteNumber(value.id)) return null;
  return { a: value.a, k: value.k, id: value.id };
};

export const parseReady = (value: unknown): ReadyMessage | null => (isRecord(value) && isFiniteNumber(value.round) ? { round: value.round } : null);

export const parseAbort = (value: unknown): AbortMessage | null =>
  isRecord(value) && isFiniteNumber(value.round) && isString(value.reason, 120) ? { round: value.round, reason: value.reason } : null;

const DIFFICULTIES = Object.values(Difficulty);
const BUILDINGS = Object.values(BuildingChoice);
const THEMES = Object.values(Theme);
const STATUSES = Object.values(LobbyStatus);

const parseMember = (value: unknown): LobbyMember | null =>
  isRecord(value) && isString(value.peerId, 64) && isString(value.name, 64) && isFiniteNumber(value.color)
    ? { peerId: value.peerId, name: sanitizeName(value.name), color: value.color }
    : null;

const parseSettings = (value: unknown): LobbySettings | null =>
  isRecord(value) && isEnumValue(DIFFICULTIES, value.difficulty) && isEnumValue(BUILDINGS, value.building)
    ? { difficulty: value.difficulty, building: value.building }
    : null;

export const parseLobby = (value: unknown): LobbyState | null => {
  if (!isRecord(value) || !isFiniteNumber(value.version) || !isString(value.code, 16) || !isString(value.hostId, 64)) return null;
  if (!Array.isArray(value.members) || value.members.length > MAX_SQUAD * 2) return null;
  const members = value.members.map(parseMember);
  if (members.some((m) => m === null)) return null;
  const settings = parseSettings(value.settings);
  if (!settings || !isEnumValue(STATUSES, value.status) || !isFiniteNumber(value.round)) return null;
  const inRound = Array.isArray(value.inRound) ? value.inRound.filter((x): x is string => isString(x, 64)) : [];
  return {
    version: value.version,
    code: value.code,
    hostId: value.hostId,
    members: members as LobbyMember[],
    settings,
    status: value.status,
    round: value.round,
    inRound,
  };
};

const parseRoster = (value: unknown): RosterEntry | null =>
  isRecord(value) && isString(value.id, 64) && isString(value.name, 64) && isFiniteNumber(value.color)
    ? { id: value.id, name: sanitizeName(value.name), color: value.color }
    : null;

export const parseStart = (value: unknown): RoundStart | null => {
  if (!isRecord(value) || !isFiniteNumber(value.round) || !isFiniteNumber(value.seed)) return null;
  if (!isEnumValue(THEMES, value.theme) || !isEnumValue(DIFFICULTIES, value.difficulty) || !isString(value.fingerprint, 200)) return null;
  if (!Array.isArray(value.players) || value.players.length === 0 || value.players.length > MAX_SQUAD) return null;
  const players = value.players.map(parseRoster);
  if (players.some((p) => p === null)) return null;
  return {
    round: value.round,
    seed: value.seed,
    theme: value.theme,
    difficulty: value.difficulty,
    players: players as RosterEntry[],
    fingerprint: value.fingerprint,
  };
};
