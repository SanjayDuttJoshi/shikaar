import type { GameEvent, InteractTarget, PlayerInput, WorldState } from "@/types/game";
import { TICK_DT } from "@/game/constants";
import type { GameContext } from "@/game/context";
import { applyFlash, applyInteract, applyRevive, toggleTorch } from "@/game/interact";
import { stepPlayerMotion } from "@/game/player-motion";
import { hostStep } from "@/game/round";

/** What the client loop talks to. A solo game runs the host here; online games talk to the room's host. */
export interface Session {
  ctx: GameContext;
  state: WorldState;
  selfId: string;
  /** Online rounds never stop: pausing or watching a film only stops your own controls. */
  online: boolean;
  /** Squad members the host is still waiting for (loading the round). */
  waitingFor: () => string[];
  step: (input: PlayerInput, dt: number, events: GameEvent[]) => void;
  interact: (target: InteractTarget, events: GameEvent[]) => void;
  revive: (targetId: string, dt: number, events: GameEvent[]) => void;
  flash: (events: GameEvent[]) => void;
  toggleTorch: () => void;
  dispose: () => void;
}

/** Longest slice of player movement per physics step (keeps collisions solid on slow frames). */
export const MAX_STEP = 1 / 30;

export const createLocalSession = (ctx: GameContext, state: WorldState, selfId: string): Session => {
  let accumulator = 0;
  const self = () => state.players.find((p) => p.id === selfId);
  return {
    ctx,
    state,
    selfId,
    online: false,
    waitingFor: () => [],
    step: (input, dt, events) => {
      const me = self();
      let left = dt;
      while (left > 1e-6) {
        const slice = Math.min(MAX_STEP, left);
        if (me) stepPlayerMotion(ctx, state, me, input, slice);
        left -= slice;
      }
      accumulator += dt;
      while (accumulator >= TICK_DT) {
        hostStep(ctx, state, TICK_DT, events);
        accumulator -= TICK_DT;
      }
    },
    interact: (target, events) => applyInteract(ctx, state, selfId, target, events),
    revive: (targetId, dt, events) => applyRevive(state, selfId, targetId, dt, events),
    flash: (events) => applyFlash(ctx, state, selfId, events),
    toggleTorch: () => {
      const me = self();
      if (me) toggleTorch(me);
    },
    dispose: () => undefined,
  };
};
