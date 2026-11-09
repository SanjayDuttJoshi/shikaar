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

/** Phone held upright during a round: a gentle nudge to turn it (doesn't block play). */
export const PortraitHint = () => (
  <p
    className="pointer-events-none absolute bottom-[calc(10.5rem+env(safe-area-inset-bottom))] left-1/2 z-20 w-max max-w-[90vw] -translate-x-1/2 animate-breathe rounded-full border border-white/15 bg-black/70 px-4 py-2 text-center text-sm text-bone"
    data-testid="portrait-hint"
  >
    📱↻ Phone ko tircha (landscape) karo, zyada dikhega
  </p>
);
