import { ActionKind, Channel, LobbyStatus, RoomStatus } from "@/types/net";
import type { LobbySettings, LobbyState, RoomView, RoundStart } from "@/types/net";
import type { MessageHandler, PeerHandler, Transport } from "@/net/transport";
import { addMember, createLobby, nextHost, removeMember } from "@/net/lobby";
import { MAX_SQUAD, PROTOCOL_VERSION, parseAbort, parseHello, parseLobby, parseReady, parseStart } from "@/net/messages";
import { isRoundPacket } from "@/net/round-link";
import type { RoundLink } from "@/net/round-link";
import { levelFingerprint } from "@/lib/level-fingerprint";
import { pickTheme, randomSeed } from "@/lib/match-config";
import { generateLevel } from "@/world/generate-level";

export interface RoomOptions {
  code: string;
  name: string;
  host: boolean;
  settings: LobbySettings;
  /** How long a joiner waits for the host before giving up. */
  findTimeoutMs?: number;
}

export interface Room {
  view: () => RoomView;
  subscribe: (listener: () => void) => () => void;
  setSettings: (settings: LobbySettings) => void;
  /** Host: start a round with everyone in the lobby. */
  startRound: (seed?: number) => void;
  /** Host: the round finished, latecomers may join the next one. */
  endRound: () => void;
  /** The current round's channels, for its session. */
  roundLink: () => RoundLink | null;
  /** Client: tell the host this round is loaded. */
  markReady: () => void;
  /** Leave the round being played and go back to the lobby (host: cancels it for everyone). */
  leaveRound: () => void;
  leave: () => void;
}

const ROUND_CHANNELS = [Channel.Snap, Channel.Pose, Channel.Act, Channel.Ready];
const FIND_TIMEOUT_MS = 25000;

export const createRoom = (transport: Transport, opts: RoomOptions): Room => {
  const selfId = transport.selfId;
  let lobby: LobbyState | null = opts.host ? createLobby(opts.code, selfId, opts.name, opts.settings) : null;
  let status = opts.host ? RoomStatus.Lobby : RoomStatus.Connecting;
  let round: RoundStart | null = null;
  let notice = "";
  let view: RoomView;
  const listeners = new Set<() => void>();
  const ready = new Set<string>();
  /** Handlers of the sessions playing the current round; each link removes only its own. */
  let roundHandlers = new Map<Channel, Set<MessageHandler>>();
  let roundLeaves = new Set<PeerHandler>();
  let closed = false;

  const isHost = (): boolean => lobby?.hostId === selfId;
  const rebuild = (): void => {
    view = { status, code: opts.code, selfId, isHost: isHost(), lobby, round, notice };
    listeners.forEach((l) => l());
  };
  rebuild();

  const broadcastLobby = (): void => {
    if (lobby && isHost()) transport.send(Channel.Lobby, lobby);
  };

  const dropRound = (message: string): void => {
    round = null;
    roundHandlers = new Map();
    roundLeaves = new Set();
    status = RoomStatus.Lobby;
    notice = message;
  };

  const fail = (message: string): void => {
    status = RoomStatus.Error;
    notice = message;
    rebuild();
  };

  transport.onPeerJoin((peer) => {
    transport.send(Channel.Hello, { v: PROTOCOL_VERSION, name: opts.name }, peer);
    if (isHost() && lobby) transport.send(Channel.Lobby, lobby, peer);
  });

  transport.on(Channel.Hello, (data, peer) => {
    const hello = parseHello(data);
    if (!hello || !lobby || !isHost()) return;
    if (hello.v === PROTOCOL_VERSION) lobby = addMember(lobby, peer, hello.name);
    if (lobby.members.some((m) => m.peerId === peer)) broadcastLobby();
    else transport.send(Channel.Lobby, lobby, peer);
    rebuild();
  });

  transport.on(Channel.Lobby, (data, peer) => {
    const next = parseLobby(data);
    if (!next || next.hostId !== peer || isHost()) return;
    if (next.version !== PROTOCOL_VERSION) {
      fail("Dost ke paas game ka alag version hai. Dono page refresh karo.");
      return;
    }
    lobby = next;
    const inside = next.members.some((m) => m.peerId === selfId);
    if (!inside && next.members.length >= MAX_SQUAD) {
      fail(`Room bhar gaya hai (${MAX_SQUAD}/${MAX_SQUAD}).`);
      return;
    }
    if (inside && status === RoomStatus.Connecting) status = RoomStatus.Lobby;
    rebuild();
  });

  transport.on(Channel.Start, (data, peer) => {
    const start = parseStart(data);
    if (!start || !lobby || peer !== lobby.hostId || !start.players.some((p) => p.id === selfId)) return;
    round = start;
    ready.clear();
    roundHandlers = new Map();
    roundLeaves = new Set();
    status = RoomStatus.Playing;
    notice = "";
    rebuild();
  });

  transport.on(Channel.Abort, (data, peer) => {
    const abort = parseAbort(data);
    if (!abort || !lobby || peer !== lobby.hostId || !round || abort.round !== round.round) return;
    dropRound(abort.reason);
    rebuild();
  });

  for (const channel of ROUND_CHANNELS) {
    transport.on(channel, (data, peer) => {
      if (!isRoundPacket(data) || !round || data.r !== round.round) return;
      if (channel === Channel.Ready && isHost() && parseReady(data.d)) ready.add(peer);
      roundHandlers.get(channel)?.forEach((h) => h(data.d, peer));
    });
  }

  transport.onPeerLeave((peer) => {
    roundLeaves.forEach((h) => h(peer));
    if (!lobby) return;
    const wasHost = lobby.hostId === peer;
    const heir = wasHost ? nextHost(lobby, peer) : lobby.hostId;
    lobby = { ...removeMember(lobby, peer), hostId: heir ?? selfId };
    if (wasHost) {
      if (round) dropRound("Host ka connection toot gaya. Round khatam.");
      else notice = "Host chala gaya. Naya host chuna gaya.";
      if (isHost()) lobby = { ...lobby, status: LobbyStatus.Waiting, inRound: [] };
    }
    broadcastLobby();
    rebuild();
  });

  if (!opts.host) {
    setTimeout(() => {
      if (!closed && status === RoomStatus.Connecting) fail("Room nahi mila. Code check karo, aur host ka game khula hona chahiye.");
    }, opts.findTimeoutMs ?? FIND_TIMEOUT_MS);
  }

  const startRound = (seed?: number): void => {
    if (!lobby || !isHost()) return;
    const players = lobby.members.map((m) => ({ id: m.peerId, name: m.name, color: m.color }));
    const theme = pickTheme(lobby.settings.building, lobby.round);
    const chosen = seed ?? randomSeed();
    const level = generateLevel({ seed: chosen, theme, players: players.length });
    const start: RoundStart = { round: lobby.round, seed: chosen, theme, difficulty: lobby.settings.difficulty, players, fingerprint: levelFingerprint(level) };
    lobby = { ...lobby, status: LobbyStatus.Playing, round: lobby.round + 1, inRound: players.map((p) => p.id) };
    broadcastLobby();
    transport.send(Channel.Start, start);
    round = start;
    ready.clear();
    roundHandlers = new Map();
    roundLeaves = new Set();
    status = RoomStatus.Playing;
    notice = "";
    rebuild();
  };

  const sendRound = (channel: Channel, data: unknown, target?: string): void => {
    if (round) transport.send(channel, { r: round.round, d: data }, target);
  };

  return {
    view: () => view,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    setSettings: (settings) => {
      if (!lobby || !isHost()) return;
      lobby = { ...lobby, settings };
      broadcastLobby();
      rebuild();
    },
    startRound,
    endRound: () => {
      if (!lobby || !isHost()) return;
      lobby = { ...lobby, status: LobbyStatus.Waiting, inRound: [] };
      broadcastLobby();
      rebuild();
    },
    roundLink: () => {
      if (!round || !lobby) return null;
      const handlers = roundHandlers;
      const leaves = roundLeaves;
      const forRound = round.round;
      const mine: Array<[Channel, MessageHandler]> = [];
      const myLeaves: PeerHandler[] = [];
      return {
        selfId,
        hostId: lobby.hostId,
        round: forRound,
        send: (channel, data, target) => {
          if (round?.round === forRound) sendRound(channel, data, target);
        },
        on: (channel, handler) => {
          const set = handlers.get(channel) ?? new Set<MessageHandler>();
          set.add(handler);
          handlers.set(channel, set);
          mine.push([channel, handler]);
        },
        onPeerLeave: (handler) => {
          leaves.add(handler);
          myLeaves.push(handler);
        },
        readyPeers: () => ready,
        dispose: () => {
          for (const [channel, handler] of mine) handlers.get(channel)?.delete(handler);
          for (const handler of myLeaves) leaves.delete(handler);
        },
      };
    },
    markReady: () => {
      if (round && lobby && !isHost()) sendRound(Channel.Ready, { round: round.round }, lobby.hostId);
    },
    leaveRound: () => {
      if (!round || !lobby) return;
      if (isHost()) {
        transport.send(Channel.Abort, { round: round.round, reason: "Host ne round band kar diya." });
        lobby = { ...lobby, status: LobbyStatus.Waiting, inRound: [] };
        broadcastLobby();
      } else {
        sendRound(Channel.Act, { a: ActionKind.Quit }, lobby.hostId);
      }
      dropRound("");
      rebuild();
    },
    leave: () => {
      if (closed) return;
      closed = true;
      transport.leave();
      listeners.clear();
    },
  };
};

