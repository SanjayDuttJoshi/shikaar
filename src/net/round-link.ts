import type { Channel } from "@/types/net";
import type { MessageHandler, PeerHandler } from "@/net/transport";

/** The slice of the room one round's session talks through. Messages from other rounds never reach it. */
export interface RoundLink {
  selfId: string;
  hostId: string;
  round: number;
  send: (channel: Channel, data: unknown, target?: string) => void;
  on: (channel: Channel, handler: MessageHandler) => void;
  onPeerLeave: (handler: PeerHandler) => void;
  /** Squad members who said they finished loading this round. */
  readyPeers: () => ReadonlySet<string>;
  dispose: () => void;
}

/** Wire wrapper that tags round traffic with its round number. */
export interface RoundPacket {
  r: number;
  d: unknown;
}

export const isRoundPacket = (value: unknown): value is RoundPacket =>
  typeof value === "object" && value !== null && !Array.isArray(value) && typeof (value as { r?: unknown }).r === "number" && "d" in value;
