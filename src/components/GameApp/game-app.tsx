"use client";

import { useEffect, useMemo, useState } from "react";
import { GameScreen } from "@/components/GameScreen/game-screen";
import { HomeScreen } from "@/components/HomeScreen/home-screen";
import { LobbyScreen } from "@/components/LobbyScreen/lobby-screen";
import { ModelViewer } from "@/components/ModelViewer/model-viewer";
import { ResultsScreen } from "@/components/ResultsScreen/results-screen";
import { Screen } from "@/types/ui";
import type { RoundResult, Settings } from "@/types/ui";
import type { MatchConfig } from "@/types/match";
import type { RoundStart } from "@/types/net";
import { SSR_SETTINGS, loadSettings, saveSettings } from "@/lib/settings";
import { pickTheme, randomSeed } from "@/lib/match-config";
import { unlockAudio } from "@/audio/audio-context";
import { startMenuMusic, stopMenuMusic } from "@/audio/menu-music";
import { Quality } from "@/types/render";
import { useSquad } from "@/hooks/use-squad";

const seedFromUrl = (): number | null => {
  const raw = new URLSearchParams(window.location.search).get("seed");
  return raw ? Number(raw) || null : null;
};

export const GameApp = () => {
  const [settings, setSettings] = useState<Settings>(SSR_SETTINGS);
  const [screen, setScreen] = useState<Screen>(Screen.Home);
  const [config, setConfig] = useState<MatchConfig | null>(null);
  const [result, setResult] = useState<RoundResult | null>(null);
  const [viewer, setViewer] = useState(false);
  const squad = useSquad(settings);
  const [shownRound, setShownRound] = useState<RoundStart | null>(null);

  useEffect(() => {
    // Saved settings live in localStorage, which only exists in the browser.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSettings(loadSettings());
    const q = new URLSearchParams(window.location.search);
    setViewer(q.get("debug") === "1" && q.get("viewer") === "1");
  }, []);

  useEffect(() => {
    if (screen === Screen.Playing) {
      stopMenuMusic();
      return;
    }
    const begin = (): void => {
      startMenuMusic(settings.volume).catch(() => undefined);
    };
    window.addEventListener("pointerdown", begin, { once: true });
    return () => window.removeEventListener("pointerdown", begin);
  }, [screen, settings.volume]);

  // The host starting (or cancelling) a squad round moves everyone's screen.
  const roomRound = squad.view?.round ?? null;
  if (squad.view && roomRound !== shownRound) {
    setShownRound(roomRound);
    if (roomRound) {
      setConfig({ theme: roomRound.theme, seed: roomRound.seed, difficulty: roomRound.difficulty, quality: settings.quality, name: settings.name.trim(), round: roomRound.round });
      setScreen(Screen.Playing);
    } else if (screen === Screen.Playing) {
      setScreen(Screen.Lobby);
    }
  }
  const online = useMemo(() => (squad.room && shownRound ? { room: squad.room, start: shownRound } : null), [squad.room, shownRound]);

  const updateSettings = (next: Settings): void => {
    setSettings(next);
    saveSettings(next);
  };

  const start = (round: number): void => {
    unlockAudio(settings.quality === Quality.Low);
    setConfig({
      theme: pickTheme(settings.building, round),
      seed: seedFromUrl() ?? randomSeed(),
      difficulty: settings.difficulty,
      quality: settings.quality,
      name: settings.name.trim(),
      round,
    });
    setScreen(Screen.Playing);
  };

  const leaveRoom = (): void => {
    squad.leave();
    setShownRound(null);
    setScreen(Screen.Home);
  };

  if (viewer) return <ModelViewer />;
  if (screen === Screen.Playing && config) {
    return (
      <GameScreen
        key={`${config.seed}-${config.round}`}
        config={config}
        settings={settings}
        onSettings={updateSettings}
        online={online}
        onFinish={(r) => {
          setResult(r);
          setScreen(Screen.Results);
        }}
        onQuit={() => {
          if (!online) {
            setScreen(Screen.Home);
            return;
          }
          online.room.leaveRound();
          setScreen(Screen.Lobby);
        }}
      />
    );
  }
  if (screen === Screen.Results && result && config) {
    return (
      <ResultsScreen
        result={result}
        squad={online ? { isHost: squad.view?.isHost ?? false } : null}
        onAgain={() => {
          unlockAudio(settings.quality === Quality.Low);
          if (online) squad.room?.startRound(seedFromUrl() ?? undefined);
          else start(config.round + 1);
        }}
        onMenu={() => setScreen(online ? Screen.Lobby : Screen.Home)}
      />
    );
  }
  if (screen === Screen.Lobby && squad.view) {
    return (
      <LobbyScreen
        view={squad.view}
        onSettings={(s) => squad.room?.setSettings(s)}
        onStart={() => {
          unlockAudio(settings.quality === Quality.Low);
          squad.room?.startRound(seedFromUrl() ?? undefined);
        }}
        onLeave={leaveRoom}
      />
    );
  }
  return (
    <HomeScreen
      settings={settings}
      onChange={updateSettings}
      onPlaySolo={() => start(config ? config.round + 1 : 0)}
      squad={{
        open: squad.panelOpen,
        code: squad.inviteCode,
        busy: squad.busy,
        error: squad.error,
        onOpen: () => squad.setPanelOpen(true),
        onClose: () => squad.setPanelOpen(false),
        onCreate: () => {
          unlockAudio(settings.quality === Quality.Low);
          squad.create().then((ok) => ok && setScreen(Screen.Lobby));
        },
        onJoin: (code) => {
          unlockAudio(settings.quality === Quality.Low);
          squad.join(code).then((ok) => ok && setScreen(Screen.Lobby));
        },
      }}
    />
  );
};
