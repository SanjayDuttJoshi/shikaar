"use client";

import { PlayerStatus } from "@/types/game";
import type { TeammateInfo } from "@/types/ui";
import { MATE_STATUS } from "@/lib/labels";
import { stillInside } from "@/client/squad-view";

interface SquadHudProps {
  teammates: TeammateInfo[];
  /** Id of the friend whose eyes the screen shows ("" for your own). */
  viewing: string;
  /** Name of the friend you're peeking at while still in the round ("" when not). */
  peeking: string;
  touch: boolean;
  onView: (index: number) => void;
}

const mateLine = (t: TeammateInfo): string => {
  if (t.status === PlayerStatus.Alive) return `${Math.round(t.distance)}m`;
  if (t.status === PlayerStatus.Hiding) return `${MATE_STATUS[t.status]} · ${Math.round(t.distance)}m`;
  return MATE_STATUS[t.status];
};

/**
 * Squad list (top right): how many are in the round and how each friend is doing.
 * A friend's screen is never shown by itself: tap their name (or press their number) to see through their eyes.
 */
export const SquadHud = ({ teammates, viewing, peeking, touch, onView }: SquadHudProps) => {
  const shownIndex = teammates.findIndex((t) => t.id === viewing);
  return (
    <>
      <div className="no-select absolute top-[max(0.75rem,env(safe-area-inset-top))] right-3 z-20 flex flex-col items-end gap-1" data-testid="squad-list">
        <p className="rounded bg-black/45 px-2 py-0.5 text-[11px] font-semibold tracking-[0.2em] text-ash uppercase" data-testid="squad-count">
          Squad · {teammates.length + 1} log
        </p>
        {teammates.map((t, i) => {
          const active = t.id === viewing;
          const downed = t.status === PlayerStatus.Downed;
          return (
            <button
              key={t.id}
              type="button"
              disabled={!stillInside(t.status)}
              onClick={() => onView(i)}
              aria-pressed={active}
              data-testid={`mate-${i + 1}`}
              className={`pointer-events-auto flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-colors disabled:opacity-55 ${
                active ? "border-[#ffd27a]/70 bg-[#3a2a10]/85 text-[#ffe2a8]" : downed ? "border-blood/50 bg-black/55 text-[#ff7a66]" : "border-white/10 bg-black/45 text-bone"
              }`}
            >
              {!touch && <kbd className="rounded border border-white/30 px-1 text-[10px] text-ash">{i + 1}</kbd>}
              <span className="font-semibold">{t.name}</span>
              <span className={active ? "text-[#ffe2a8]/80" : "text-ash"}>· {mateLine(t)}</span>
              {stillInside(t.status) && <span aria-hidden>👁</span>}
            </button>
          );
        })}
        <p className="rounded bg-black/40 px-2 py-0.5 text-[10px] text-ash/90">{touch ? "Naam dabao = dost ki nazar" : "1–5 dabao = dost ki nazar"}</p>
      </div>
      {peeking && (
        <>
          <div className="pointer-events-none absolute inset-0 z-[15] border-4 border-[#ffd27a]/35" />
          <div
            className="absolute bottom-[max(1.25rem,env(safe-area-inset-bottom))] left-1/2 z-20 flex max-w-[min(92vw,30rem)] -translate-x-1/2 items-center gap-3 rounded-md border border-[#ffd27a]/40 bg-black/70 px-3 py-2 text-sm text-[#ffe2a8]"
            data-testid="peek-banner"
          >
            <span>
              👁 <b>{peeking}</b> ki nazar se · tum apni jagah khade ho
            </span>
            {touch ? (
              <button type="button" onClick={() => onView(shownIndex)} className="pointer-events-auto rounded border border-white/25 bg-white/10 px-3 py-1 font-semibold text-bone" data-testid="peek-back">
                Wapas
              </button>
            ) : (
              <span className="text-xs text-ash">chalo ya {shownIndex + 1} dabao = wapas</span>
            )}
          </div>
        </>
      )}
    </>
  );
};
