import { NetKind } from "@/types/net";
import type { LobbySettings } from "@/types/net";
import { createLocalTransport } from "@/net/local-transport";
import { createRoom } from "@/net/room";
import type { Room } from "@/net/room";
import type { Transport } from "@/net/transport";
import { createTrysteroTransport } from "@/net/trystero-transport";

/** `?net=local` keeps the room inside this browser (several tabs), for tests. Otherwise friends meet over the internet. */
export const netKind = (): NetKind => (new URLSearchParams(window.location.search).get("net") === "local" ? NetKind.Local : NetKind.Online);

export interface OpenRoomOptions {
  code: string;
  name: string;
  host: boolean;
  settings: LobbySettings;
}

export const openRoom = async (opts: OpenRoomOptions): Promise<Room> => {
  const transport: Transport = netKind() === NetKind.Local ? createLocalTransport(opts.code) : await createTrysteroTransport(opts.code);
  return createRoom(transport, opts);
};
