"use client";

import { useEffect, useState } from "react";
import type { RoomView } from "@/types/net";
import type { Settings } from "@/types/ui";
import { openRoom } from "@/net/connect";
import type { Room } from "@/net/room";
import { generateRoomCode, isValidRoomCode, normalizeRoomCode } from "@/net/room-code";
import { useRoom } from "@/hooks/use-room";

export interface SquadControls {
  room: Room | null;
  view: RoomView | null;
  panelOpen: boolean;
  setPanelOpen: (open: boolean) => void;
  /** Code from an invite link (?room=ABCDE), pre-filled in the join box. */
  inviteCode: string;
  busy: boolean;
  error: string;
  create: () => Promise<boolean>;
  join: (code: string) => Promise<boolean>;
  leave: () => void;
}

/** Opening, joining and leaving a squad room from the menus. */
export const useSquad = (settings: Settings): SquadControls => {
  const [room, setRoom] = useState<Room | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const view = useRoom(room);

  useEffect(() => {
    const code = normalizeRoomCode(new URLSearchParams(window.location.search).get("room") ?? "");
    if (!isValidRoomCode(code)) return;
    // An invite link opens straight onto the join box with the code filled in.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInviteCode(code);
    setPanelOpen(true);
  }, []);

  useEffect(() => () => room?.leave(), [room]);

  const open = async (code: string, host: boolean): Promise<boolean> => {
    setBusy(true);
    setError("");
    try {
      const next = await openRoom({ code, host, name: settings.name.trim(), settings: { difficulty: settings.difficulty, building: settings.building } });
      setRoom(next);
      setPanelOpen(false);
      return true;
    } catch {
      setError("Internet se judne mein dikkat aayi. Connection check karke phir try karo.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  return {
    room,
    view,
    panelOpen,
    setPanelOpen,
    inviteCode,
    busy,
    error,
    create: () => open(generateRoomCode(), true),
    join: (code) => open(normalizeRoomCode(code), false),
    leave: () => {
      room?.leave();
      setRoom(null);
    },
  };
};
