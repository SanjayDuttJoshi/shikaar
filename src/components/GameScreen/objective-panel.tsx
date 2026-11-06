import type { HudSnapshot } from "@/types/ui";
import { KEY_COLORS } from "@/world/level-queries";
import { KEY_HEX, keyLabel } from "@/lib/labels";

/** Top-left: what to do next, keys collected, fuses in the box. */
export const ObjectivePanel = ({ hud }: { hud: HudSnapshot }) => (
  <div className="max-w-[min(20rem,70vw)] rounded-md bg-black/35 px-3 py-2 backdrop-blur-[2px]">
    <p className="font-display text-sm leading-snug text-bone sm:text-base">{hud.objective}</p>
    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ash">
      {hud.keysTotal > 0 && (
        <span className="flex items-center gap-1">
          Chaabi:
          {KEY_COLORS.slice(0, hud.keysTotal).map((c) => (
            <span
              key={c}
              title={keyLabel(c)}
              className="inline-block h-2.5 w-2.5 rounded-full border border-white/30"
              style={{ background: hud.keys.includes(c) ? KEY_HEX[c] : "transparent", boxShadow: hud.keys.includes(c) ? `0 0 8px ${KEY_HEX[c]}` : "none" }}
            />
          ))}
        </span>
      )}
      {hud.notesTotal > 0 && (
        <span>
          Yaadein: {hud.notesFound}/{hud.notesTotal}
        </span>
      )}
      <span>
        Fuse: {hud.fusesInserted}/{hud.fusesNeeded}
        {hud.carrying && <span className="ml-1 text-[#ffcf4a]">(haath mein 1)</span>}
      </span>
    </div>
  </div>
);
