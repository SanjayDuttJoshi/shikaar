import type { HudSnapshot } from "@/types/ui";
import { MAX_HEALTH } from "@/game/constants";

interface BarProps {
  label: string;
  value: number;
  color: string;
  warn?: boolean;
}

const Bar = ({ label, value, color, warn = false }: BarProps) => (
  <div className="flex items-center gap-2">
    <span className={`w-12 text-[11px] font-semibold tracking-widest uppercase ${warn ? "animate-pulse-red" : "text-ash"}`}>{label}</span>
    <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/10 sm:w-32">
      <div className="h-full rounded-full transition-[width] duration-200" style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }} />
    </div>
  </div>
);

/** Torch battery, breath (stamina), health drops and flash readiness, bottom-left. */
export const StatusBars = ({ hud }: { hud: HudSnapshot }) => (
  <div className="flex flex-col gap-1.5 rounded-md bg-black/35 px-3 py-2 backdrop-blur-[2px]">
    <Bar label={hud.torchOn ? "Torch" : "Torch ✕"} value={hud.battery} color={hud.battery < 20 ? "#ff5a3a" : "#f2e3b8"} warn={hud.battery < 20} />
    <Bar label="Saans" value={hud.stamina} color={hud.exhausted ? "#ff5a3a" : "#9cc4ff"} warn={hud.exhausted} />
    <div className="flex items-center gap-2">
      <span className="w-12 text-[11px] font-semibold tracking-widest text-ash uppercase">Jaan</span>
      <div className="flex gap-1">
        {Array.from({ length: MAX_HEALTH }, (_, i) => (
          <span key={i} className={`h-2.5 w-5 rounded-sm ${i < hud.health ? "bg-blood shadow-[0_0_8px_rgba(179,20,15,0.8)]" : "bg-white/10"}`} />
        ))}
      </div>
      <span className={`ml-2 text-[11px] tracking-widest uppercase ${hud.flashReady >= 1 && hud.battery >= 20 ? "text-bone" : "text-ash/50"}`}>Flash</span>
    </div>
  </div>
);
