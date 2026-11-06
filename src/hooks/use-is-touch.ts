import { useSyncExternalStore } from "react";

const QUERY = "(pointer: coarse)";

const subscribe = (cb: () => void): (() => void) => {
  const mq = window.matchMedia?.(QUERY);
  mq?.addEventListener?.("change", cb);
  return () => mq?.removeEventListener?.("change", cb);
};

/** True on phones/tablets (coarse pointer): show on-screen controls instead of mouse look. */
export const useIsTouch = (): boolean =>
  useSyncExternalStore(subscribe, () => window.matchMedia?.(QUERY).matches ?? false, () => false);
