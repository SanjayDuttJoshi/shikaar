import { LobbyStatus } from "@/types/net";
import type { LobbyMember, LobbySettings, LobbyState } from "@/types/net";
import { MAX_SQUAD, PROTOCOL_VERSION, sanitizeName } from "@/net/messages";
import { SQUAD_COLORS } from "@/lib/squad";

const freeColor = (members: LobbyMember[]): number => {
  for (let c = 0; c < SQUAD_COLORS.length; c += 1) if (!members.some((m) => m.color === c)) return c;
  return members.length % SQUAD_COLORS.length;
};

const uniqueName = (members: LobbyMember[], name: string, peerId: string): string => {
  const taken = new Set(members.filter((m) => m.peerId !== peerId).map((m) => m.name.toLowerCase()));
  if (!taken.has(name.toLowerCase())) return name;
  for (let n = 2; n < 50; n += 1) {
    const candidate = `${name.slice(0, 13)} ${n}`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
  return name;
};

export const createLobby = (code: string, hostId: string, hostName: string, settings: LobbySettings): LobbyState => ({
  version: PROTOCOL_VERSION,
  code,
  hostId,
  members: [{ peerId: hostId, name: sanitizeName(hostName), color: 0 }],
  settings,
  status: LobbyStatus.Waiting,
  round: 0,
  inRound: [],
});

export const isFull = (lobby: LobbyState): boolean => lobby.members.length >= MAX_SQUAD;

/** Adds (or renames) a member. A full room is returned unchanged. */
export const addMember = (lobby: LobbyState, peerId: string, rawName: string): LobbyState => {
  const existing = lobby.members.find((m) => m.peerId === peerId);
  const name = uniqueName(lobby.members, sanitizeName(rawName), peerId);
  if (existing) return { ...lobby, members: lobby.members.map((m) => (m.peerId === peerId ? { ...m, name } : m)) };
  if (isFull(lobby)) return lobby;
  return { ...lobby, members: [...lobby.members, { peerId, name, color: freeColor(lobby.members) }] };
};

export const removeMember = (lobby: LobbyState, peerId: string): LobbyState => ({
  ...lobby,
  members: lobby.members.filter((m) => m.peerId !== peerId),
  inRound: lobby.inRound.filter((id) => id !== peerId),
});

/** Who takes over when the host leaves: the longest-standing member still here. */
export const nextHost = (lobby: LobbyState, gone: string): string | null => lobby.members.find((m) => m.peerId !== gone)?.peerId ?? null;

export const memberName = (lobby: LobbyState | null, peerId: string): string => lobby?.members.find((m) => m.peerId === peerId)?.name ?? "Dost";
