interface EnvelopeOverlayProps {
  title: string;
  touch: boolean;
  onPlay: () => void;
  onLater: () => void;
}

/** A sealed envelope just opened: watch the memory now, or later from the pause menu. */
export const EnvelopeOverlay = ({ title, touch, onPlay, onLater }: EnvelopeOverlayProps) => (
  <div className="pointer-events-auto absolute inset-0 z-30 flex items-center justify-center bg-black/55 px-4" data-testid="envelope-overlay">
    <div
      className="w-full max-w-sm -rotate-1 animate-rise rounded-sm px-6 py-5 text-center text-[#2b1a12] shadow-[0_10px_40px_rgba(0,0,0,0.8)]"
      style={{ background: "radial-gradient(ellipse at 30% 20%, #efe4c6, #d8c79d 70%, #b9a274)" }}
    >
      <div className="mx-auto mb-2 h-9 w-9 rounded-full bg-[#7a0d0a] shadow-inner" />
      <p className="text-[11px] tracking-[0.3em] text-[#6b4a30] uppercase">Ek purana lifafa</p>
      <h3 className="mt-1 font-display text-2xl leading-tight">{title}</h3>
      <div className="mt-4 flex flex-col gap-2">
        <button type="button" data-testid="film-play" onClick={onPlay} className="rounded bg-[#2b1a12] px-4 py-2.5 font-display text-lg text-[#efe4c6] hover:bg-[#4a2a1a]">
          ▶ Play {touch ? "" : "(E)"}
        </button>
        <button type="button" onClick={onLater} className="rounded border border-[#6b4a30]/50 px-4 py-2 text-sm text-[#4a2a1a]">
          Baad mein dekhenge {touch ? "" : "(F)"}
        </button>
      </div>
    </div>
  </div>
);

interface FilmOverlayProps {
  title: string | null;
  subtitle: string;
  progress: number;
  touch: boolean;
  onSkip: () => void;
}

/** Letterbox bars, the title card, subtitles and a skip hint over a playing story film. */
export const FilmOverlay = ({ title, subtitle, progress, touch, onSkip }: FilmOverlayProps) => (
  <div className="pointer-events-auto absolute inset-0 z-30" data-testid="film-overlay" onClick={onSkip}>
    <div className="absolute inset-x-0 top-0 h-[11%] bg-black" />
    <div className="absolute inset-x-0 bottom-0 h-[11%] bg-black" />
    {title && (
      <div className="absolute inset-0 flex items-center justify-center">
        <p className="animate-rise font-display text-3xl text-[#e9d6cc] sm:text-4xl">{title}</p>
      </div>
    )}
    {subtitle && (
      <p className="absolute inset-x-0 bottom-[13%] mx-auto max-w-2xl px-6 text-center font-display text-lg text-[#f3e6c0] [text-shadow:0_2px_6px_#000] sm:text-xl">
        {subtitle}
      </p>
    )}
    <div className="absolute right-4 bottom-[3%] text-xs text-ash">{touch ? "Tap karke skip" : "E / click se skip"}</div>
    <div className="absolute inset-x-0 bottom-0 h-0.5 bg-white/10">
      <div className="h-full bg-[#b3140f]" style={{ width: `${Math.round(progress * 100)}%` }} />
    </div>
  </div>
);
