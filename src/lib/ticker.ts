/**
 * A steady interval that keeps running in background tabs. Browsers heavily
 * throttle main-thread timers in hidden tabs, so the beat comes from a tiny
 * dedicated worker when one is available.
 */
export interface Ticker {
  start: (intervalMs: number) => void;
  stop: () => void;
  dispose: () => void;
}

const WORKER_SOURCE = `let id = null;
onmessage = (e) => {
  if (id !== null) clearInterval(id);
  id = null;
  if (e.data > 0) id = setInterval(() => postMessage(0), e.data);
};`;

export const createTicker = (onTick: () => void): Ticker => {
  let worker: Worker | null = null;
  let fallbackId: ReturnType<typeof setInterval> | null = null;
  let workerUrl: string | null = null;
  try {
    if (typeof Worker !== "undefined" && typeof Blob !== "undefined") {
      workerUrl = URL.createObjectURL(new Blob([WORKER_SOURCE], { type: "text/javascript" }));
      worker = new Worker(workerUrl);
      worker.onmessage = () => onTick();
    }
  } catch {
    worker = null;
  }
  const stop = (): void => {
    worker?.postMessage(0);
    if (fallbackId !== null) clearInterval(fallbackId);
    fallbackId = null;
  };
  return {
    start: (intervalMs) => {
      stop();
      if (worker) worker.postMessage(intervalMs);
      else fallbackId = setInterval(onTick, intervalMs);
    },
    stop,
    dispose: () => {
      stop();
      worker?.terminate();
      worker = null;
      if (workerUrl) URL.revokeObjectURL(workerUrl);
    },
  };
};
