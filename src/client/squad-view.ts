import { PlayerStatus, Stance } from "@/types/game";
import type { WorldState } from "@/types/game";
import type { AudioSink } from "@/audio/audio-sink";

export interface MateSteps {
  /** Plays squad members' footsteps where they walk. */
  update: (state: WorldState, selfId: string, dt: number, audio: AudioSink) => void;
}

const STRIDE: Record<Stance, number> = { [Stance.Walk]: 1.25, [Stance.Sprint]: 1.7, [Stance.Crouch]: 0.9 };
const LOUD: Record<Stance, number> = { [Stance.Walk]: 0.45, [Stance.Sprint]: 0.9, [Stance.Crouch]: 0.15 };

export const createMateSteps = (): MateSteps => {
  const travelled = new Map<string, number>();
  return {
    update: (state, selfId, dt, audio) => {
      for (const p of state.players) {
        if (p.id === selfId || (p.status !== PlayerStatus.Alive && p.status !== PlayerStatus.Downed)) continue;
        const speed = Math.hypot(p.vx, p.vz);
        if (speed < 0.4) {
          travelled.set(p.id, 0);
          continue;
        }
        const stride = STRIDE[p.stance];
        const d = (travelled.get(p.id) ?? 0) + speed * dt;
        if (d < stride) {
          travelled.set(p.id, d);
          continue;
        }
        travelled.set(p.id, d - stride);
        audio.footstep(p.x, p.z, LOUD[p.stance], false);
      }
    },
  };
};

/** Still in the building (can be watched or peeked at). */
export const stillInside = (s: PlayerStatus): boolean => s === PlayerStatus.Alive || s === PlayerStatus.Hiding || s === PlayerStatus.Downed;

/**
 * Who a fallen or escaped player watches: the current pick while they're still inside,
 * otherwise (or when `next` is asked for) the following squad member still in the building.
 */
export const pickWatched = (state: WorldState, selfId: string, current: string | null, next: boolean): string | null => {
  const inside = state.players.filter((p) => p.id !== selfId && stillInside(p.status));
  if (inside.length === 0) return null;
  const i = inside.findIndex((p) => p.id === current);
  if (i >= 0 && !next) return current;
  return inside[(i + 1) % inside.length].id;
};
