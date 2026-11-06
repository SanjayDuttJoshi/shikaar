"use client";

import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { BUILD_MISMATCH, createGame } from "@/client/create-game";
import type { GameHandle } from "@/client/create-game";
import { buildResult } from "@/lib/round-result";
import { GameEventKind } from "@/types/game";
import type { GameEvent } from "@/types/game";
import type { MatchConfig } from "@/types/match";
import type { RoundStart } from "@/types/net";
import type { RoundResult, Settings } from "@/types/ui";
import type { Room } from "@/net/room";

/** A squad round: the room it belongs to and what the host sent. */
export interface OnlineRound {
  room: Room;
  start: RoundStart;
}

export interface GameLoad {
  handle: GameHandle | null;
  progress: { value: number; label: string };
  /** Why the round couldn't start (shown with a way back). */
  failure: string;
}

const SOLO_ID = "me";
const FINISH_DELAY_MS = 1200;

/**
 * Builds the round on the canvas (solo, or as squad host/client), starts it, reports the result
 * when it ends and tears everything down on unmount. Settings are read live through `settings`.
 */
export const useGameHandle = (
  canvasRef: RefObject<HTMLCanvasElement | null>,
  config: MatchConfig,
  online: OnlineRound | null,
  settings: Settings,
  onPause: () => void,
  onFinish: (result: RoundResult) => void,
): GameLoad => {
  const [handle, setHandle] = useState<GameHandle | null>(null);
  const [progress, setProgress] = useState({ value: 0, label: "" });
  const [failure, setFailure] = useState("");
  const settingsRef = useRef(settings);
  const finishRef = useRef(onFinish);

  useEffect(() => {
    settingsRef.current = settings;
    finishRef.current = onFinish;
    handle?.runner.audio().setVolume(settings.volume);
    handle?.view.setBrightness(settings.brightness);
  }, [settings, onFinish, handle]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let disposed = false;
    let current: GameHandle | null = null;
    let hits = 0;
    const room = online?.room ?? null;
    const selfId = room ? room.view().selfId : SOLO_ID;
    const host = room?.view().isHost ?? false;
    const link = room?.roundLink() ?? null;
    const onEvent = (e: GameEvent): void => {
      if (e.kind === GameEventKind.PlayerHit && e.player === selfId) hits += 1;
      if (e.kind !== GameEventKind.RoundEnd || !current) return;
      const result = buildResult(current.session.state, current.session.ctx.level, selfId, hits);
      if (host) room?.endRound();
      window.setTimeout(() => finishRef.current(result), FINISH_DELAY_MS);
    };
    const live = settingsRef.current;
    createGame(
      {
        canvas,
        theme: config.theme,
        seed: config.seed,
        difficulty: config.difficulty,
        quality: config.quality,
        players: online ? online.start.players : [{ id: SOLO_ID, name: config.name || "Tum", color: 0 }],
        selfId,
        online: online && link ? { link, host, fingerprint: online.start.fingerprint } : null,
        sensitivity: () => settingsRef.current.sensitivity,
        bindings: () => settingsRef.current.keys,
        invertY: () => settingsRef.current.invertY,
        onPause,
        onEvent,
        volume: live.volume,
        brightness: live.brightness,
        language: live.language,
      },
      (value, label) => !disposed && setProgress({ value, label }),
    )
      .then((h) => {
        if (disposed) {
          h.dispose();
          return;
        }
        current = h;
        setHandle(h);
        h.runner.start();
        if (!host) room?.markReady();
      })
      .catch((err: unknown) => {
        link?.dispose();
        if (disposed) return;
        const mismatch = err instanceof Error && err.message === BUILD_MISMATCH;
        setFailure(mismatch ? "Tumhare aur host ke game ka version alag hai. Dono page refresh karo." : "Round load nahi hua. Wapas jao aur phir koshish karo.");
      });
    return () => {
      disposed = true;
      current?.dispose();
      setHandle(null);
    };
  }, [canvasRef, config, online, onPause]);

  return { handle, progress, failure };
};
