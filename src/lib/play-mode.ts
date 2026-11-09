type LockableOrientation = ScreenOrientation & { lock?: (orientation: string) => Promise<void> };

/**
 * On phones, a round plays fullscreen and sideways: more room to see, no browser bars.
 * Must run inside a tap. Browsers that can't (iPhone Safari) just keep the normal page.
 */
export const enterPlayMode = (): void => {
  if (typeof window === "undefined" || !window.matchMedia?.("(pointer: coarse)").matches) return;
  const root = document.documentElement;
  if (document.fullscreenElement || typeof root.requestFullscreen !== "function") return;
  root
    .requestFullscreen({ navigationUI: "hide" })
    .then(() => (screen.orientation as LockableOrientation | undefined)?.lock?.("landscape"))
    .catch(() => undefined);
};
