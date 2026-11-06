import { useSyncExternalStore } from "react";
import type { RoomView } from "@/types/net";
import type { Room } from "@/net/room";

const NO_ROOM = (): null => null;
const NO_SUBSCRIBE = (): (() => void) => () => undefined;

/** Live view of the squad room (members, settings, round), or null outside a room. */
export const useRoom = (room: Room | null): RoomView | null =>
  useSyncExternalStore(room ? room.subscribe : NO_SUBSCRIBE, room ? room.view : NO_ROOM, NO_ROOM);
