import { PlayerStatus, RoundPhase } from "@/types/game";
import type { PlayerState, WorldState } from "@/types/game";
import type { InputState } from "@/client/input-state";
import { stillInside } from "@/client/squad-view";

/**
 * "Dost ki nazar": tap a friend's name (or press 1–5) to see the round through their eyes.
 * Your own body stands still meanwhile. Walking, pressing any action, getting spotted or hurt,
 * or tapping the same name again brings your own view back.
 */
export interface FriendView {
  /**
   * Handles a name tap / number key and ends the peek when you act. Call every frame before your input is used.
   * Returns the friend asked for while you're out of the round (dead or escaped), so the watch camera can switch.
   */
  update: (p: PlayerState, blocked: boolean) => string | null;
  /** Back to your own eyes at once (something happened to you). */
  stop: () => void;
  /** The friend you're peeking at while still in the round, or null. */
  peeking: () => string | null;
}

const isLive = (phase: RoundPhase): boolean => phase === RoundPhase.Playing || phase === RoundPhase.GateOpening;

export const createFriendView = (state: WorldState, selfId: string, online: boolean, input: InputState): FriendView => {
  let peek: string | null = null;
  let look = { yaw: input.yaw, pitch: input.pitch };
  /** While peeking, dragging or moving the mouse doesn't turn your own (unseen) body. */
  const holdLook = (): void => {
    input.yaw = look.yaw;
    input.pitch = look.pitch;
  };
  const end = (): void => {
    if (peek) holdLook();
    peek = null;
  };

  return {
    update: (p, blocked) => {
      const index = input.viewPressed;
      input.viewPressed = -1;
      if (!online || blocked) return null;
      const out = p.status === PlayerStatus.Dead || p.status === PlayerStatus.Escaped;
      const asked = index >= 0 ? state.players.filter((q) => q.id !== selfId)[index] : undefined;
      if (asked && stillInside(asked.status)) {
        if (out) return asked.id;
        if (isLive(state.phase)) {
          if (peek === asked.id) end();
          else {
            if (!peek) look = { yaw: input.yaw, pitch: input.pitch };
            peek = asked.id;
          }
          return null;
        }
      }
      if (!peek) return null;
      const mate = state.players.find((q) => q.id === peek);
      const moved = input.moveX !== 0 || input.moveZ !== 0;
      const acted = input.interactPressed || input.flashPressed || input.torchPressed;
      holdLook();
      if (moved || acted || out || !isLive(state.phase) || !mate || !stillInside(mate.status)) {
        end();
        // A press that only brings your eyes back does nothing else (you couldn't see what it would hit).
        if (acted) {
          input.interactPressed = false;
          input.flashPressed = false;
          input.torchPressed = false;
        }
      }
      return null;
    },
    stop: end,
    peeking: () => peek,
  };
};
