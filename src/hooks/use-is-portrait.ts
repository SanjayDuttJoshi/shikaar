import { useSyncExternalStore } from "react";

const QUERY = "(orientation: portrait)";

const subscribe = (cb: () => void): (() => void) => {
  const mq = window.matchMedia?.(QUERY);
  mq?.addEventListener?.("change", cb);
  return () => mq?.removeEventListener?.("change", cb);
};

/** True while the screen is taller than wide (a phone held upright). */
export const useIsPortrait = (): boolean =>
  useSyncExternalStore(subscribe, () => window.matchMedia?.(QUERY).matches ?? false, () => false);
