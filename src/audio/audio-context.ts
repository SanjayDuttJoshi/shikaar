/** One AudioContext for the whole app, created inside a click so browsers let it play. */
let shared: AudioContext | null = null;

export const unlockAudio = (lowRate = false): AudioContext | null => {
  if (typeof window === "undefined") return null;
  try {
    if (!shared) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      shared = lowRate ? new Ctor({ sampleRate: 22050 }) : new Ctor();
    }
    if (shared.state === "suspended") shared.resume().catch(() => undefined);
    return shared;
  } catch {
    return null;
  }
};

export const sharedAudioContext = (): AudioContext | null => shared;
