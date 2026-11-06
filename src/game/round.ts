import { GameEventKind, PlayerStatus, RoundOutcome, RoundPhase } from "@/types/game";
import type { GameEvent, WorldState } from "@/types/game";
import { END_SECONDS } from "@/game/constants";
import type { GameContext } from "@/game/context";
import { setDoorTarget } from "@/game/doors";
import { stepDirector } from "@/game/director";
import { stepDoors } from "@/game/doors";
import { stepMonster, stepStare } from "@/game/monster-ai";
import { stepSetPieces } from "@/game/set-pieces";
import { CELL } from "@/world/constants";
import { roomIdAt } from "@/world/level-queries";

const stillInside = (s: PlayerStatus): boolean =>
  s === PlayerStatus.Alive || s === PlayerStatus.Hiding || s === PlayerStatus.Downed;

const decideOutcome = (state: WorldState): RoundOutcome => {
  const escaped = state.players.filter((p) => p.status === PlayerStatus.Escaped).length;
  if (escaped === state.players.length) return RoundOutcome.AllEscaped;
  return escaped > 0 ? RoundOutcome.SomeEscaped : RoundOutcome.AllCaught;
};

/** Phases, bleeding out, escaping through the open gate, and the end of the round. */
export const stepRound = (ctx: GameContext, state: WorldState, dt: number, events: GameEvent[]): void => {
  state.time += dt;
  if (state.phase === RoundPhase.Ended) return;
  if (state.phase === RoundPhase.Intro) {
    state.phaseTimer -= dt;
    if (state.phaseTimer <= 0) state.phase = RoundPhase.Playing;
    return;
  }
  if (state.phase === RoundPhase.GateOpening) {
    state.phaseTimer -= dt;
    if (state.phaseTimer <= 0 && !state.gateOpen) {
      state.gateOpen = true;
      state.doors[ctx.level.exitDoorId].locked = false;
      setDoorTarget(ctx, state, ctx.level.exitDoorId, true, events);
      events.push({ kind: GameEventKind.GateOpen });
    }
  }

  const anyoneUp = state.players.some((p) => p.status === PlayerStatus.Alive || p.status === PlayerStatus.Hiding);
  for (const p of state.players) {
    if (p.status === PlayerStatus.Downed) {
      p.bleed -= dt;
      if (p.bleed <= 0 || !anyoneUp) {
        p.status = PlayerStatus.Dead;
        events.push({ kind: GameEventKind.PlayerDied, player: p.id, x: p.x, z: p.z });
      }
    }
    if (p.status === PlayerStatus.Alive && state.gateOpen) {
      const outside = roomIdAt(ctx.level, Math.floor(p.x / CELL), Math.floor(p.z / CELL)) < 0;
      if (outside) {
        p.status = PlayerStatus.Escaped;
        p.torchOn = false;
        events.push({ kind: GameEventKind.PlayerEscaped, player: p.id, x: p.x, z: p.z });
      }
    }
  }

  if (!state.players.some((p) => stillInside(p.status))) {
    if (state.outcome === RoundOutcome.None) {
      state.outcome = decideOutcome(state);
      state.phaseTimer = END_SECONDS;
    }
    state.phaseTimer -= dt;
    if (state.phaseTimer <= 0) {
      state.phase = RoundPhase.Ended;
      events.push({ kind: GameEventKind.RoundEnd });
    }
  }
};

/** Everything the host simulates each tick besides the players' own bodies. */
export const hostStep = (ctx: GameContext, state: WorldState, dt: number, events: GameEvent[]): void => {
  stepDoors(ctx, state, dt, events);
  stepSetPieces(ctx, state, dt, events);
  stepStare(ctx, state, dt, events);
  for (const m of state.monsters) stepMonster(ctx, state, m, dt, events);
  stepDirector(ctx, state, dt, events);
  stepRound(ctx, state, dt, events);
  ctx.noises.length = 0;
};
