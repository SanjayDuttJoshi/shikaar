import { HorrorButton } from "@/components/Common/horror-button";
import { RoundOutcome } from "@/types/game";
import type { RoundResult } from "@/types/ui";
import { THEME_TITLE } from "@/lib/labels";
import { formatClock } from "@/lib/format";
import { STORY } from "@/lib/story";

interface ResultsScreenProps {
  result: RoundResult;
  onAgain: () => void;
  onMenu: () => void;
  /** Squad round: only the host starts the next one; everyone else waits for it. */
  squad?: { isHost: boolean } | null;
}

const TITLE: Record<RoundOutcome, string> = {
  [RoundOutcome.AllEscaped]: "BACH GAYE",
  [RoundOutcome.SomeEscaped]: "KUCH BACH GAYE",
  [RoundOutcome.AllCaught]: "SHIKARI JEET GAYA",
  [RoundOutcome.None]: "...",
};

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-md border border-white/10 bg-black/40 px-3 py-2">
    <p className="text-[11px] tracking-[0.2em] text-ash uppercase">{label}</p>
    <p className="font-display text-xl text-bone">{value}</p>
  </div>
);

export const ResultsScreen = ({ result, onAgain, onMenu, squad = null }: ResultsScreenProps) => {
  const won = result.outcome === RoundOutcome.AllEscaped || result.escaped;
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10" data-testid="results">
      <section className="flex w-full max-w-md animate-rise flex-col gap-6 text-center">
        <p className="text-sm tracking-[0.4em] text-ash uppercase">{THEME_TITLE[result.theme]}</p>
        <h1 className={`font-display text-5xl sm:text-6xl ${won ? "text-[#d8ecd2]" : "animate-flicker text-[#ff6a55] text-glow-red"}`}>{TITLE[result.outcome]}</h1>
        <p className="font-display text-ash italic">{won ? STORY[result.theme].escaped : STORY[result.theme].caught}</p>
        <div className="grid grid-cols-2 gap-2 text-left">
          <Stat label="Waqt" value={formatClock(result.seconds)} />
          <Stat label="Chaabi" value={`${result.keysFound}/${result.keysTotal}`} />
          <Stat label="Fuse" value={`${result.fusesInserted}/${result.fusesNeeded}`} />
          <Stat label="Chot" value={`${result.timesHit}`} />
          <Stat label="Kahani ke panne" value={`${result.notesFound}/${result.notesTotal}`} />
        </div>
        <div className="flex flex-col gap-3">
          {(!squad || squad.isHost) && (
            <HorrorButton testId="play-again" onClick={onAgain}>
              {squad ? "Agla round (sab ke saath)" : "Phir se andar jao"}
            </HorrorButton>
          )}
          {squad && !squad.isHost && <p className="animate-breathe text-sm text-ash">Host agla round shuru karega, tum apne aap andar pahunch jaoge...</p>}
          <HorrorButton variant="ghost" testId="results-menu" onClick={onMenu}>
            {squad ? "Room mein wapas" : "Menu"}
          </HorrorButton>
        </div>
      </section>
    </main>
  );
};
