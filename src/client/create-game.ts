import type { Difficulty, GameEvent } from "@/types/game";
import type { Quality } from "@/types/render";
import type { Theme } from "@/types/world";
import type { KeyBindings, Language } from "@/types/ui";
import { createAudioEngine } from "@/audio/audio-engine";
import { sharedAudioContext } from "@/audio/audio-context";
import { SILENT_AUDIO } from "@/audio/audio-sink";
import { attachDesktopInput } from "@/client/desktop-input";
import { createGameRunner } from "@/client/game-runner";
import type { GameRunner } from "@/client/game-runner";
import { createHudStore } from "@/client/hud-store";
import type { HudStore } from "@/client/hud-store";
import { createInputState } from "@/client/input-state";
import type { InputState } from "@/client/input-state";
import { createLocalSession } from "@/client/session";
import { createHostSession } from "@/net/host-session";
import { createClientSession } from "@/net/client-session";
import type { RoundLink } from "@/net/round-link";
import { levelFingerprint } from "@/lib/level-fingerprint";
import { survivorFor } from "@/lib/squad";
import type { Session } from "@/client/session";
import { createGameContext, createWorldState } from "@/game/context";
import type { PlayerSeed } from "@/game/context";
import { loadSceneAssets } from "@/render3d/asset-library";
import type { ProgressFn } from "@/render3d/asset-library";
import { createSceneView } from "@/render3d/scene-view";
import type { SceneView } from "@/render3d/scene-view";
import { exposeDebugProbe } from "@/lib/debug-probe";
import { generateLevel } from "@/world/generate-level";
import { FILMS } from "@/content/films";
import { createFilmPlayer } from "@/film/film-player";
import { speakerOf, subtitleFor } from "@/lib/voice";

/** Who is speaking, shown before each subtitle. */
const SPEAKER_NAME: Record<string, string> = {
  shikari: "Shikari",
  chudail: "Chudail",
  mareez: "Mareez",
  pa: "📢",
  radio: "📻",
  kamla: "Kamla",
  raghu: "Raghu",
};
import { mixSeed } from "@/world/rng";

export interface CreateGameOptions {
  canvas: HTMLCanvasElement;
  theme: Theme;
  seed: number;
  difficulty: Difficulty;
  quality: Quality;
  players: PlayerSeed[];
  selfId: string;
  sensitivity: () => number;
  bindings: () => KeyBindings;
  invertY: () => boolean;
  onPause: () => void;
  onEvent?: (e: GameEvent) => void;
  volume: number;
  brightness: number;
  language: Language;
  /** Squad round: the room's channels, whether this tab is the host, and the host's level check. */
  online?: { link: RoundLink; host: boolean; fingerprint: string } | null;
}

/** Thrown when this tab's game build makes a different building than the host's. */
export const BUILD_MISMATCH = "build-mismatch";

export interface GameHandle {
  runner: GameRunner;
  hud: HudStore;
  input: InputState;
  view: SceneView;
  session: Session;
  dispose: () => void;
}

export const createGame = async (opts: CreateGameOptions, onProgress: ProgressFn): Promise<GameHandle> => {
  onProgress(0.05, "Naksha ban raha hai...");
  const level = generateLevel({ seed: opts.seed, theme: opts.theme, players: opts.players.length });
  const ctx = createGameContext(level, mixSeed(opts.seed, 77));
  if (opts.online && levelFingerprint(level) !== opts.online.fingerprint) throw new Error(BUILD_MISMATCH);
  const state = createWorldState(level, opts.players, opts.difficulty);
  const mates = opts.players.filter((p) => p.id !== opts.selfId);
  const survivors = [...new Set(mates.map((m) => survivorFor(m.color)))];
  onProgress(0.15, "Saaman aa raha hai...");
  const assets = await loadSceneAssets(opts.theme, (f, label) => onProgress(0.15 + f * 0.45, label), survivors);
  const audioCtx = sharedAudioContext();
  const audio = audioCtx
    ? await createAudioEngine(audioCtx, ctx, opts.volume, opts.language, (f) => onProgress(0.6 + f * 0.35, "Awaazein aa rahi hain...")).catch(() => SILENT_AUDIO)
    : SILENT_AUDIO;
  const view = createSceneView(opts.canvas, level, opts.quality, assets, mates);
  view.setBrightness(opts.brightness);
  const self = state.players.find((p) => p.id === opts.selfId) ?? state.players[0];
  const input = createInputState(self.yaw);
  const online = opts.online;
  const session = !online
    ? createLocalSession(ctx, state, opts.selfId)
    : online.host
      ? createHostSession({ ctx, state, selfId: opts.selfId, link: online.link })
      : createClientSession({ ctx, state, selfId: opts.selfId, link: online.link });
  const hud = createHudStore();
  const film = createFilmPlayer(view.renderer, view.materials, assets.propModels, () => audio);
  const runner = createGameRunner({ view, session, input, hud, audio, onEvent: opts.onEvent, film, films: FILMS[opts.theme], language: opts.language });
  audio.onLine((id) => runner.subtitle(`${SPEAKER_NAME[speakerOf(id)] ?? ""}: ${subtitleFor(id, opts.language)}`));
  const detach = attachDesktopInput({
    canvas: opts.canvas,
    input,
    sensitivity: opts.sensitivity,
    bindings: opts.bindings,
    invertY: opts.invertY,
    onPause: opts.onPause,
    enabled: () => !runner.isPaused(),
  });
  const parent = opts.canvas.parentElement ?? opts.canvas;
  const fit = (): void => {
    view.resize(parent.clientWidth, parent.clientHeight);
    film.resize(parent.clientWidth, parent.clientHeight);
  };
  fit();
  const observer = new ResizeObserver(fit);
  observer.observe(parent);
  const removeProbe = exposeDebugProbe({
    ctx,
    state,
    input,
    selfId: opts.selfId,
    scene: view.scene,
    playFilm: (index) => {
      for (let i = 0; i <= index; i += 1) if (!state.notesFound.includes(i)) state.notesFound.push(i);
      runner.playFilm(index);
    },
    filmPlaying: () => film.isPlaying(),
  });
  onProgress(1, "Taiyaar");
  return {
    runner,
    hud,
    input,
    view,
    session,
    dispose: () => {
      runner.stop();
      detach();
      observer.disconnect();
      removeProbe();
      view.dispose();
      session.dispose();
      audio.dispose();
    },
  };
};
