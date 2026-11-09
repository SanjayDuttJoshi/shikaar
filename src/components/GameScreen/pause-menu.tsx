import { HorrorButton } from "@/components/Common/horror-button";

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

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}

const Slider = ({ label, value, min, max, step, onChange }: SliderProps) => (
  <label className="flex flex-col gap-1 text-sm text-ash">
    {label}
    <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="h-6 accent-[#b3140f]" />
  </label>
);

/**
 * Pause: look/brightness/volume, memories found so far, resume and quit.
 * On a phone held sideways (short screen) settings and actions sit side by side, and it scrolls if needed.
 */
export const PauseMenu = ({ touch, sensitivity, volume, brightness, onBrightness, onSensitivity, onVolume, onResume, onQuit, onControls, films, onFilm, online }: PauseMenuProps) => (
  <div className="absolute inset-0 z-40 flex overflow-y-auto bg-black/75 px-4 py-4 backdrop-blur-sm" data-testid="pause-menu">
    <div className="m-auto flex w-full max-w-sm flex-col gap-5 rounded-lg border border-white/10 bg-panel p-6 short:max-w-3xl short:gap-3 short:p-4">
      <header className="text-center">
        <h2 className="font-display text-3xl text-bone short:text-2xl">Ruko...</h2>
        {online && <p className="mt-1 text-sm text-[#ffb4a8]">Online game rukta nahi! Shikari abhi bhi chal raha hai.</p>}
      </header>
      <div className="flex flex-col gap-5 short:grid short:grid-cols-2 short:gap-x-6 short:gap-y-3">
        <div className="flex flex-col gap-4 short:gap-2">
          <Slider label={`${touch ? "Touch" : "Mouse"} speed: ${sensitivity.toFixed(1)}`} value={sensitivity} min={0.3} max={2.5} step={0.1} onChange={onSensitivity} />
          <Slider label={`Roshni (brightness): ${Math.round(brightness * 100)}%`} value={brightness} min={0.6} max={2} step={0.05} onChange={onBrightness} />
          <Slider label={`Awaaz: ${Math.round(volume * 100)}%`} value={volume} min={0} max={1} step={0.05} onChange={onVolume} />
        </div>
        <div className="flex flex-col gap-3 short:gap-2">
          {films.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs tracking-[0.2em] text-ash uppercase">Yaadein (mili hui)</span>
              {films.map((f) => (
                <button key={f.index} type="button" onClick={() => onFilm(f.index)} className="rounded border border-white/15 bg-black/40 px-3 py-2 text-left text-sm text-bone hover:border-blood/60 short:py-1.5">
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
    </div>
  </div>
);
