import { useSyncExternalStore } from "react";
import type { HudStore } from "@/client/hud-store";
import type { HudSnapshot } from "@/types/ui";

const NO_STORE: HudStore = { get: () => null, set: () => undefined, subscribe: () => () => undefined };

export const useHud = (store: HudStore | null): HudSnapshot | null => {
  const s = store ?? NO_STORE;
  return useSyncExternalStore(s.subscribe, s.get, () => null);
};
