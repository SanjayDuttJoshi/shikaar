"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ClickToStart, FailureOverlay, IntroOverlay, LoadingOverlay, PortraitHint } from "@/components/GameScreen/overlays";
import { PauseMenu } from "@/components/GameScreen/pause-menu";
import { ControlsPanel } from "@/components/Common/controls-panel";
import { Hud } from "@/components/GameScreen/hud";
import { EnvelopeOverlay, FilmOverlay } from "@/components/GameScreen/story-overlays";
import { pressTorch, setUse } from "@/client/input-actions";
import { TouchControls } from "@/components/GameScreen/touch-controls";
import { useGameHandle } from "@/hooks/use-game-handle";
import type { OnlineRound } from "@/hooks/use-game-handle";
import { useHud } from "@/hooks/use-hud";
import { useIsTouch } from "@/hooks/use-is-touch";
import { useIsPortrait } from "@/hooks/use-is-portrait";
import { PlayerStatus, RoundPhase } from "@/types/game";
import type { RoundResult, Settings } from "@/types/ui";
import type { MatchConfig } from "@/types/match";

interface GameScreenProps {
  config: MatchConfig;
  settings: Settings;
  onSettings: (next: Settings) => void;
  onFinish: (result: RoundResult) => void;
  onQuit: () => void;
  online?: OnlineRound | null;
}

/** Automated playtests (?debug=1&noclick=1) can't take pointer lock, so they skip the click gate. */
const skipClick = (): boolean => {
  const q = new URLSearchParams(window.location.search);
  return q.get("debug") === "1" && q.get("noclick") === "1";
};

export const GameScreen = ({ config, settings, onSettings, onFinish, onQuit, online = null }: GameScreenProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [paused, setPaused] = useState(false);
  const [locked, setLocked] = useState(false);
  const [controls, setControls] = useState(false);
  const touch = useIsTouch();
  const portrait = useIsPortrait();
  const pause = useCallback(() => setPaused(true), []);
  const { handle, progress, failure } = useGameHandle(canvasRef, config, online, settings, pause, onFinish);
  const hud = useHud(handle?.hud ?? null);

  useEffect(() => {
    const onLock = (): void => setLocked(document.pointerLockElement === canvasRef.current);
    document.addEventListener("pointerlockchange", onLock);
    return () => document.removeEventListener("pointerlockchange", onLock);
  }, []);

  const waitingForClick = !touch && !locked && !paused && !skipClick();
  useEffect(() => {
    handle?.runner.setPaused(paused || waitingForClick);
  }, [handle, paused, waitingForClick]);

  const resume = (): void => {
    setPaused(false);
    if (!touch) canvasRef.current?.requestPointerLock?.()?.catch?.(() => undefined);
  };

  return (
    <div className="fixed inset-0 overflow-hidden bg-black" data-testid="game-screen">
      <canvas ref={canvasRef} className="block h-full w-full" />
      {!handle && !failure && <LoadingOverlay progress={progress.value} label={progress.label} />}
      {failure && <FailureOverlay message={failure} onBack={onQuit} />}
      {handle && hud?.phase === RoundPhase.Intro && <IntroOverlay theme={config.theme} waiting={hud.waiting} />}
      {handle && hud && <Hud hud={hud} touch={touch} />}
      {handle && hud && hud.offer >= 0 && !hud.film && (
        <EnvelopeOverlay title={hud.offerTitle} touch={touch} onPlay={() => setUse(handle.input, true)} onLater={() => pressTorch(handle.input)} />
      )}
      {handle && hud?.film && <FilmOverlay title={hud.film.title} subtitle={hud.film.subtitle} progress={hud.film.progress} touch={touch} onSkip={() => setUse(handle.input, true)} />}
      {handle && touch && !paused && !hud?.film && hud?.offer === -1 && (
        <TouchControls
          input={handle.input}
          sensitivity={settings.sensitivity}
          onPause={pause}
          watching={hud.status === PlayerStatus.Dead || hud.status === PlayerStatus.Escaped}
        />
      )}
      {handle && touch && portrait && !paused && !hud?.film && <PortraitHint />}
      {handle && waitingForClick && <ClickToStart onStart={() => canvasRef.current?.requestPointerLock?.()?.catch?.(() => undefined)} />}
      {paused && (
        <PauseMenu
          touch={touch}
          sensitivity={settings.sensitivity}
          volume={settings.volume}
          brightness={settings.brightness}
          onBrightness={(brightness) => onSettings({ ...settings, brightness })}
          onSensitivity={(sensitivity) => onSettings({ ...settings, sensitivity })}
          onVolume={(volume) => onSettings({ ...settings, volume })}
          onResume={resume}
          onQuit={onQuit}
          onControls={() => setControls(true)}
          films={hud?.filmsUnlocked ?? []}
          online={!!online}
          onFilm={(index) => {
            resume();
            handle?.runner.playFilm(index);
          }}
        />
      )}
      {controls && <ControlsPanel settings={settings} onChange={onSettings} onClose={() => setControls(false)} />}
    </div>
  );
};
