/**
 * Playtest helper (?debug=1&recordaudio=1): records the game's final mix so automated
 * gameplay videos can carry sound (browser screen recordings are silent).
 */
export interface AudioCapture {
  startedAt: number;
  stop: () => Promise<string>;
}

declare global {
  interface Window {
    __shikaarAudio?: AudioCapture;
  }
}

export const maybeRecordMix = (ctx: AudioContext, mix: AudioNode): void => {
  if (typeof window === "undefined" || window.__shikaarAudio) return;
  const q = new URLSearchParams(window.location.search);
  if (q.get("debug") !== "1" || q.get("recordaudio") !== "1" || typeof MediaRecorder === "undefined") return;
  const dest = ctx.createMediaStreamDestination();
  mix.connect(dest);
  const recorder = new MediaRecorder(dest.stream, { mimeType: "audio/webm;codecs=opus", audioBitsPerSecond: 128000 });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => chunks.push(e.data);
  recorder.start(1000);
  window.__shikaarAudio = {
    startedAt: Date.now(),
    stop: () =>
      new Promise((resolve) => {
        recorder.onstop = () => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(String(reader.result).split(",")[1] ?? "");
          reader.readAsDataURL(new Blob(chunks, { type: "audio/webm" }));
        };
        recorder.stop();
      }),
  };
};
