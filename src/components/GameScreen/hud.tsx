import { PlayerStatus, RoundPhase } from "@/types/game";
import { MessageTone } from "@/types/ui";
import type { HudSnapshot } from "@/types/ui";
import { ObjectivePanel } from "@/components/GameScreen/objective-panel";
import { HideOverlay } from "@/components/GameScreen/hide-overlay";
import { StatusBars } from "@/components/GameScreen/status-bars";

const TONE_CLASS: Record<MessageTone, string> = {
  [MessageTone.Info]: "text-bone",
  [MessageTone.Good]: "text-[#cfe9c8]",
  [MessageTone.Danger]: "text-[#ff7a66] text-glow-red",
  [MessageTone.Voice]: "italic text-[#d8cfe8]",
};

interface HudProps {
  hud: HudSnapshot;
  touch: boolean;
}

/** In-game overlay. Purely visual: pointer events pass through to the canvas. */
export const Hud = ({ hud, touch }: HudProps) => {
  if (hud.phase === RoundPhase.Intro || hud.film) return null;
  const alive = hud.status === PlayerStatus.Alive || hud.status === PlayerStatus.Hiding;
  return (
    <div className="pointer-events-none absolute inset-0 select-none" data-testid="hud">
      <div className="absolute top-[max(0.75rem,env(safe-area-inset-top))] left-3">
        <ObjectivePanel hud={hud} />
      </div>
      {hud.gateTimer >= 0 && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 animate-pulse-red font-display text-2xl tracking-widest sm:text-3xl">
          GATE {Math.ceil(hud.gateTimer)}
        </div>
      )}
      <div className="absolute top-1/2 left-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/50" />
      {hud.prompt && alive && (
        <div className="absolute top-[58%] left-1/2 flex -translate-x-1/2 flex-col items-center gap-1">
          <div className="flex items-center gap-2 rounded bg-black/55 px-3 py-1.5 text-sm text-bone sm:text-base">
            {!touch && <kbd className="rounded border border-white/40 px-1.5 font-semibold">E</kbd>}
            <span>{hud.prompt}</span>
          </div>
          {hud.promptHold > 0 && (
            <div className="h-1 w-32 overflow-hidden rounded bg-white/15">
              <div className="h-full bg-[#cfe9c8]" style={{ width: `${Math.min(100, hud.promptHold * 100)}%` }} />
            </div>
          )}
        </div>
      )}
      <div className="absolute top-[30%] left-1/2 flex w-[min(92vw,34rem)] -translate-x-1/2 flex-col items-center gap-1.5">
        {hud.messages.map((m) => (
          <p key={m.id} className={`animate-rise text-center font-display text-lg sm:text-xl ${TONE_CLASS[m.tone]}`}>
            {m.text}
          </p>
        ))}
      </div>
      {hud.trouble && (
        <p className="absolute top-14 left-1/2 -translate-x-1/2 animate-pulse rounded border border-ember/40 bg-black/70 px-3 py-1.5 text-sm text-[#ffcfb0]" data-testid="net-trouble">
          📶 {hud.trouble}
        </p>
      )}
      {hud.watching && (
        <p className="absolute bottom-[18%] left-1/2 -translate-x-1/2 rounded bg-black/55 px-3 py-1.5 text-center text-sm text-bone" data-testid="watching">
          {hud.watching} ko dekh rahe ho · {touch ? "Use button" : "E"} se badlo
        </p>
      )}
      {hud.status === PlayerStatus.Downed && (
        <p className="absolute bottom-[38%] left-1/2 -translate-x-1/2 animate-pulse-red font-display text-xl">Khoon beh raha hai... {Math.ceil(hud.bleed)}</p>
      )}
      {hud.teammates.length > 0 && (
        <ul className="absolute top-3 right-3 space-y-0.5 rounded-md bg-black/35 px-3 py-2 text-xs text-ash">
          {hud.teammates.map((t) => (
            <li key={t.id}>
              {t.name} · {t.status === PlayerStatus.Alive || t.status === PlayerStatus.Hiding ? `${Math.round(t.distance)}m` : t.status}
            </li>
          ))}
        </ul>
      )}
      {alive && (
        <div className={`absolute left-3 ${touch ? "top-[max(5.5rem,calc(env(safe-area-inset-top)+5rem))]" : "bottom-[max(0.75rem,env(safe-area-inset-bottom))]"}`}>
          <StatusBars hud={hud} />
        </div>
      )}
      {hud.hidden && <HideOverlay kind={hud.hideKind} />}

    </div>
  );
};
