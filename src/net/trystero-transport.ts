import type { JsonValue, MessageAction } from "trystero";
import { Channel } from "@/types/net";
import type { MessageHandler, PeerHandler, Transport } from "@/net/transport";
import { APP_ID } from "@/net/messages";

const PING_TIMEOUT_MS = 4000;

/**
 * Serverless WebRTC transport. Peers find each other through public Nostr
 * relays (free) and then talk directly, end-to-end encrypted.
 */
export const createTrysteroTransport = async (roomCode: string): Promise<Transport> => {
  const { joinRoom, selfId } = await import("trystero");
  const errorHandlers: Array<(message: string) => void> = [];
  const room = joinRoom({ appId: APP_ID }, `room-${roomCode}`, {
    onJoinError: (details) => errorHandlers.forEach((h) => h(details.error)),
  });
  const actions = new Map<Channel, MessageAction<JsonValue>>();
  const handlers = new Map<Channel, MessageHandler[]>();
  for (const channel of Object.values(Channel)) {
    const action = room.makeAction<JsonValue>(channel);
    action.onMessage = (data, context) => {
      handlers.get(channel)?.forEach((handler) => handler(data, context.peerId));
    };
    actions.set(channel, action);
  }
  const joinHandlers: PeerHandler[] = [];
  const leaveHandlers: PeerHandler[] = [];
  room.onPeerJoin = (peerId) => joinHandlers.forEach((h) => h(peerId));
  room.onPeerLeave = (peerId) => leaveHandlers.forEach((h) => h(peerId));
  let left = false;

  return {
    selfId,
    send: (channel, data, target) => {
      if (left) return;
      const action = actions.get(channel);
      if (!action) return;
      action.send(data as JsonValue, target ? { target } : undefined).catch(() => undefined);
    },
    on: (channel, handler) => {
      handlers.set(channel, [...(handlers.get(channel) ?? []), handler]);
    },
    onPeerJoin: (handler) => joinHandlers.push(handler),
    onPeerLeave: (handler) => leaveHandlers.push(handler),
    onError: (handler) => errorHandlers.push(handler),
    peers: () => Object.keys(room.getPeers()),
    ping: (peerId) =>
      Promise.race([
        room.ping(peerId),
        new Promise<number>((_, reject) => setTimeout(() => reject(new Error("ping timeout")), PING_TIMEOUT_MS)),
      ]),
    leave: () => {
      if (left) return;
      left = true;
      room.leave().catch(() => undefined);
    },
  };
};
