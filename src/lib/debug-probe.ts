import type { Scene } from "three";
import type { WorldState } from "@/types/game";
import type { InputState } from "@/client/input-state";
import type { Vec2 } from "@/types/world";
import { sightBlocked } from "@/game/collision";
import { doorOpenness } from "@/game/context";
import type { GameContext } from "@/game/context";
import { startAutopilot } from "@/lib/autopilot";

export interface DebugProbe {
  ctx: GameContext;
  state: WorldState;
  input: InputState;
  selfId: string;
  autopilot?: string;
  /** Recording scripts set this to make the autopilot stand still for a moment (e.g. while showing a friend's view). */
  hold?: boolean;
  /** Scene graph, for screenshot scripts that need to find things (e.g. wall writing). */
  scene?: Scene;
  /** Stands the player `distance` m from a point with a clear view of it, facing it. */
  placeNear?: (target: Vec2, distance: number, pitch?: number, needSight?: boolean) => boolean;
  /** Plays story film `index` as if its envelope had been opened. */
  playFilm?: (index: number) => void;
  /** True while a story film is loading or playing. */
  filmPlaying?: () => boolean;
  /** True while an opened envelope offers its film (Play / Later). */
  filmOffered?: () => boolean;
}

const placeNearFor = (probe: DebugProbe) => (target: Vec2, distance: number, pitch = 0, needSight = true): boolean => {
  const me = probe.state.players.find((p) => p.id === probe.selfId);
  if (!me) return false;
  const nav = probe.ctx.nav;
  for (const d of [distance, distance * 0.75, distance * 0.5, distance * 1.3]) {
    for (let k = 0; k < 24; k += 1) {
      const a = (k / 24) * Math.PI * 2;
      const spot = { x: target.x + Math.sin(a) * d, z: target.z + Math.cos(a) * d };
      const i = Math.floor(spot.z / 0.5) * nav.w + Math.floor(spot.x / 0.5);
      if (i < 0 || i >= nav.blocked.length || nav.blocked[i]) continue;
      if (needSight && sightBlocked(probe.ctx.world, spot, target, doorOpenness(probe.state))) continue;
      me.x = spot.x;
      me.z = spot.z;
      probe.input.yaw = Math.atan2(-(target.x - spot.x), -(target.z - spot.z));
      probe.input.pitch = pitch;
      return true;
    }
  }
  return false;
};

declare global {
  interface Window {
    __shikaar?: DebugProbe;
  }
}

/** With ?debug=1 the live game is reachable from the console / automated playtests. */
export const exposeDebugProbe = (probe: DebugProbe): (() => void) => {
  if (typeof window === "undefined") return () => undefined;
  const params = new URLSearchParams(window.location.search);
  if (params.get("debug") !== "1") return () => undefined;
  probe.placeNear = placeNearFor(probe);
  window.__shikaar = probe;
  const pilot = params.get("autopilot") === "1" ? startAutopilot(probe.ctx, probe.state, probe.input, probe.selfId, {
          hold: () => probe.hold === true,
          inFilm: () => (probe.filmPlaying?.() ?? false) || (probe.filmOffered?.() ?? false),
        }) : null;
  const status = pilot ? window.setInterval(() => (probe.autopilot = pilot.status()), 250) : 0;
  return () => {
    pilot?.stop();
    window.clearInterval(status);
    if (window.__shikaar === probe) delete window.__shikaar;
  };
};
