import { PlayerStatus } from "@/types/game";
import type { WorldState } from "@/types/game";
import type { RoundResult } from "@/types/ui";
import type { Level } from "@/types/world";

export const buildResult = (state: WorldState, level: Level, selfId: string, timesHit: number): RoundResult => {
  const me = state.players.find((p) => p.id === selfId);
  return {
    outcome: state.outcome,
    theme: state.theme,
    seconds: Math.round(state.time),
    keysFound: state.keys.length,
    keysTotal: level.wings.filter((w) => w.lock !== null).length,
    fusesInserted: state.fusesInserted,
    fusesNeeded: state.fusesNeeded,
    timesHit,
    escaped: me?.status === PlayerStatus.Escaped,
    notesFound: state.notesFound.length,
    notesTotal: level.notes.length,
  };
};
