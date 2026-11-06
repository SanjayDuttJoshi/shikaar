import { HorrorButton } from "@/components/Common/horror-button";
import type { Theme } from "@/types/world";
import { THEME_TITLE } from "@/lib/labels";
import { STORY } from "@/lib/story";

export const LoadingOverlay = ({ progress, label }: { progress: number; label: string }) => (
  <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-night" data-testid="loading">
    <p className="animate-flicker font-display text-3xl text-[#e9d6cc] text-glow-red">SHIKAAR</p>
    <div className="h-1 w-56 overflow-hidden rounded bg-white/10">
      <div className="h-full bg-blood transition-[width] duration-300" style={{ width: `${Math.round(progress * 100)}%` }} />
    </div>
    <p className="text-sm text-ash">{label}</p>
  </div>
);

const INTRO_LINES: Record<Theme, string> = {
  asylum: "Darwaza peeche se band ho gaya. Bijli gayi hui hai. Fuse lagao, gate kholo. Laal lalten dikhe toh chhup jao, aur andhe mareez ke paas awaaz mat karna.",
  haveli: "Haveli ka darwaza khud band ho gaya. Diye bujh rahe hain. Fuse lagao, gate kholo. Laal lalten dikhe toh chhup jao, aur safed saree waali ko zyada der mat dekhna.",
};

export const IntroOverlay = ({ theme, waiting }: { theme: Theme; waiting: string }) => (
  <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 px-6 text-center">
    <p className="animate-rise text-sm tracking-[0.4em] text-ash uppercase">Raat 2:47</p>
    <h2 className="animate-rise font-display text-4xl text-[#e9d6cc] sm:text-5xl">{THEME_TITLE[theme]}</h2>
    <p className="animate-rise text-sm text-[#c9a99a] italic">{STORY[theme].hook}</p>
    <p className="max-w-md animate-rise text-base text-ash sm:text-lg">{INTRO_LINES[theme]}</p>
    {waiting && <p className="animate-breathe text-sm text-[#ffcfb0]" data-testid="waiting-for">Dosto ka intezaar: {waiting}...</p>}
  </div>
);

interface PauseMenuProps {
  touch: boolean;
  sensitivity: number;
  volume: number;
  brightness: number;
  onBrightness: (v: number) => void;
  onSensitivity: (v: number) => void;
  onVolume: (v: number) => void;
  onResume: () => void;
  onQuit: () => void;
  onControls: () => void;
  films: Array<{ index: number; title: string }>;
  onFilm: (index: number) => void;
  /** Squad round: the world keeps running, and quitting goes back to the room. */
  online: boolean;
}

export const PauseMenu = ({ touch, sensitivity, volume, brightness, onBrightness, onSensitivity, onVolume, onResume, onQuit, onControls, films, onFilm, online }: PauseMenuProps) => (
  <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/75 px-4 backdrop-blur-sm" data-testid="pause-menu">
    <div className="flex w-full max-w-sm flex-col gap-5 rounded-lg border border-white/10 bg-panel p-6">
      <h2 className="text-center font-display text-3xl text-bone">Ruko...</h2>
      {online && <p className="-mt-3 text-center text-sm text-[#ffb4a8]">Online game rukta nahi! Shikari abhi bhi chal raha hai.</p>}
      <label className="flex flex-col gap-1 text-sm text-ash">
        Mouse/touch speed: {sensitivity.toFixed(1)}
        <input type="range" min={0.3} max={2.5} step={0.1} value={sensitivity} onChange={(e) => onSensitivity(Number(e.target.value))} className="accent-[#b3140f]" />
      </label>
      <label className="flex flex-col gap-1 text-sm text-ash">
        Roshni (brightness): {Math.round(brightness * 100)}%
        <input type="range" min={0.6} max={2} step={0.05} value={brightness} onChange={(e) => onBrightness(Number(e.target.value))} className="accent-[#b3140f]" />
      </label>
      <label className="flex flex-col gap-1 text-sm text-ash">
        Awaaz: {Math.round(volume * 100)}%
        <input type="range" min={0} max={1} step={0.05} value={volume} onChange={(e) => onVolume(Number(e.target.value))} className="accent-[#b3140f]" />
      </label>
      {films.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs tracking-[0.2em] text-ash uppercase">Yaadein (mili hui)</span>
          {films.map((f) => (
            <button key={f.index} type="button" onClick={() => onFilm(f.index)} className="rounded border border-white/15 bg-black/40 px-3 py-2 text-left text-sm text-bone hover:border-blood/60">
              ▶ {f.title}
            </button>
          ))}
        </div>
      )}
      {!touch && (
        <HorrorButton variant="ghost" onClick={onControls}>
          Controls / keys badlo
        </HorrorButton>
      )}
      <HorrorButton testId="resume" onClick={onResume}>
        Wapas chalo
      </HorrorButton>
      <HorrorButton variant="ghost" testId="quit-round" onClick={onQuit}>
        {online ? "Round chhodo (room mein wapas)" : "Menu pe jao"}
      </HorrorButton>
    </div>
  </div>
);

export const ClickToStart = ({ onStart }: { onStart: () => void }) => (
  <button type="button" onClick={onStart} className="absolute inset-0 z-20 flex items-end justify-center pb-[18vh]" data-testid="click-to-start">
    <span className="animate-breathe rounded bg-black/60 px-4 py-2 font-display text-lg text-bone">Click karo, phir mouse se dekho</span>
  </button>
);

export const FailureOverlay = ({ message, onBack }: { message: string; onBack: () => void }) => (
  <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-black/90 px-6 text-center" data-testid="round-failed">
    <p className="max-w-sm text-bone">{message}</p>
    <div className="w-full max-w-xs">
      <HorrorButton onClick={onBack}>Wapas</HorrorButton>
    </div>
  </div>
);
