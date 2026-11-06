import type { HudSnapshot } from "@/types/ui";

/** Tiny external store so React can read the HUD without re-rendering every frame. */
export interface HudStore {
  get: () => HudSnapshot | null;
  set: (next: HudSnapshot) => void;
  subscribe: (listener: () => void) => () => void;
}

export const createHudStore = (): HudStore => {
  let snapshot: HudSnapshot | null = null;
  const listeners = new Set<() => void>();
  return {
    get: () => snapshot,
    set: (next) => {
      snapshot = next;
      for (const l of listeners) l();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
};
