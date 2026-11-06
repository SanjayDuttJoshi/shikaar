import type { Channel } from "@/types/net";
import type { MessageHandler, PeerHandler, Transport } from "@/net/transport";
import { isRecord, isString } from "@/lib/guards";

const HEARTBEAT_MS = 500;
/** Loading a round can block a tab for several seconds; only a long silence counts as gone (closing a tab says bye). */
const PEER_TIMEOUT_MS = 15000;

type Envelope =
  | { t: "hi"; from: string }
  | { t: "bye"; from: string }
  | { t: "msg"; from: string; to: string | null; ch: Channel; data: unknown };

const parseEnvelope = (value: unknown): Envelope | null => {
  if (!isRecord(value) || !isString(value.from, 64)) return null;
  if (value.t === "hi" || value.t === "bye") return { t: value.t, from: value.from };
  if (value.t === "msg" && isString(value.ch, 16)) {
    return {
      t: "msg",
      from: value.from,
      to: isString(value.to, 64) ? value.to : null,
      ch: value.ch as Channel,
      data: value.data,
    };
  }
  return null;
};

/**
 * Same-browser transport over BroadcastChannel. Used for development and
 * automated tests (open the game with ?net=local in several tabs).
 */
export const createLocalTransport = (roomCode: string): Transport => {
  const selfId = `local-${Math.random().toString(36).slice(2, 10)}`;
  const channel = new BroadcastChannel(`shikaar-local:${roomCode}`);
  const lastSeen = new Map<string, number>();
  const handlers = new Map<string, MessageHandler[]>();
  const joinHandlers: PeerHandler[] = [];
  const leaveHandlers: PeerHandler[] = [];
  let left = false;

  const post = (envelope: Envelope): void => {
    if (!left) channel.postMessage(envelope);
  };
  const dropPeer = (peerId: string): void => {
    if (!lastSeen.delete(peerId)) return;
    leaveHandlers.forEach((h) => h(peerId));
  };
  const seePeer = (peerId: string): void => {
    const known = lastSeen.has(peerId);
    lastSeen.set(peerId, Date.now());
    if (!known) {
      post({ t: "hi", from: selfId });
      joinHandlers.forEach((h) => h(peerId));
    }
  };

  channel.onmessage = (event: MessageEvent<unknown>) => {
    const envelope = parseEnvelope(event.data);
    if (!envelope || envelope.from === selfId) return;
    if (envelope.t === "bye") {
      dropPeer(envelope.from);
      return;
    }
    seePeer(envelope.from);
    if (envelope.t === "msg" && (envelope.to === null || envelope.to === selfId)) {
      handlers.get(envelope.ch)?.forEach((h) => h(envelope.data, envelope.from));
    }
  };

  const heartbeat = setInterval(() => {
    post({ t: "hi", from: selfId });
    const now = Date.now();
    for (const [peerId, seen] of lastSeen) if (now - seen > PEER_TIMEOUT_MS) dropPeer(peerId);
  }, HEARTBEAT_MS);
  setTimeout(() => post({ t: "hi", from: selfId }), 0);

  return {
    selfId,
    send: (ch, data, target) => post({ t: "msg", from: selfId, to: target ?? null, ch, data }),
    on: (ch, handler) => handlers.set(ch, [...(handlers.get(ch) ?? []), handler]),
    onPeerJoin: (handler) => joinHandlers.push(handler),
    onPeerLeave: (handler) => leaveHandlers.push(handler),
    onError: () => undefined,
    peers: () => [...lastSeen.keys()],
    ping: async () => 1,
    leave: () => {
      if (left) return;
      post({ t: "bye", from: selfId });
      left = true;
      clearInterval(heartbeat);
      channel.close();
    },
  };
};
