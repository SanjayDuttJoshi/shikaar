import { GameEventKind, PlayerStatus, RoundPhase } from "@/types/game";
import type { GameEvent, WorldState } from "@/types/game";
import { SetPieceKind } from "@/types/world";
import { sightBlocked } from "@/game/collision";
import { doorOpenness } from "@/game/context";
import type { GameContext } from "@/game/context";
import { forwardOf } from "@/game/player-motion";

/** You must be looking roughly at the spot for the body to drop (so it happens in front of you). */
const BODY_FACING_COS = Math.cos((50 * Math.PI) / 180);
const BODY_MIN_DISTANCE = 1.6;

/** How far each scare is heard. A crowing rooster can bring a monster running. */
const NOISE: Record<SetPieceKind, number> = {
  [SetPieceKind.FallingBody]: 10,
  [SetPieceKind.CryingFigure]: 12,
  [SetPieceKind.Cat]: 8,
  [SetPieceKind.Rooster]: 16,
  [SetPieceKind.RockingChair]: 0,
  [SetPieceKind.Radio]: 7,
};

/** Fires each scripted scare once, the first time a player walks into it. Runs on the host. */
export const stepSetPieces = (ctx: GameContext, state: WorldState, dt: number, events: GameEvent[]): void => {
  const live = state.phase === RoundPhase.Playing || state.phase === RoundPhase.GateOpening;
  ctx.level.setPieces.forEach((sp, i) => {
    const st = state.setPieces[i];
    if (!st) return;
    if (st.fired) {
      st.t += dt;
      return;
    }
    if (!live) return;
    for (const p of state.players) {
      if (p.status !== PlayerStatus.Alive) continue;
      const d = Math.hypot(p.x - sp.tx, p.z - sp.tz);
      if (d > sp.radius) continue;
      if (sp.kind === SetPieceKind.FallingBody) {
        const f = forwardOf(p.yaw);
        if (d < BODY_MIN_DISTANCE || ((sp.x - p.x) * f.x + (sp.z - p.z) * f.z) / d < BODY_FACING_COS) continue;
      }
      // The cat sits on top of a tall cupboard (which blocks sight), so it only needs you close by.
      const needsSight = sp.kind !== SetPieceKind.RockingChair && sp.kind !== SetPieceKind.Cat;
      if (needsSight && sightBlocked(ctx.world, p, sp, doorOpenness(state))) continue;
      st.fired = true;
      st.t = 0;
      st.by = p.id;
      events.push({ kind: GameEventKind.SetPiece, setPiece: sp.id, player: p.id, x: sp.x, z: sp.z });
      if (NOISE[sp.kind] > 0) ctx.noises.push({ x: sp.x, z: sp.z, radius: NOISE[sp.kind], player: null });
      break;
    }
  });
};
