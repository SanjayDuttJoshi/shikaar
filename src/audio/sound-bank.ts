import { assetUrl } from "@/lib/asset-url";

/** Decoded one-shot buffers by path ("monster/growl-1.mp3"). Missing files simply stay silent. */
export interface SoundBank {
  get: (path: string) => AudioBuffer | null;
  /** Exact loop length from the manifest (MP3 decoders may pad the end). */
  loopEnd: (path: string) => number | null;
  /** Random pick among variants that loaded ("monster/footstep-heavy-" + 1..4). */
  pick: (paths: string[]) => AudioBuffer | null;
  load: (paths: string[], onProgress?: (fraction: number) => void) => Promise<void>;
}

export const createSoundBank = (ctx: AudioContext): SoundBank => {
  const buffers = new Map<string, AudioBuffer>();
  const failed = new Set<string>();
  const durations = new Map<string, number>();
  const manifest = fetch(assetUrl("audio/manifest.json"))
    .then((r) => (r.ok ? r.json() : []))
    .then((list: Array<{ path?: string; durationSec?: number; loop?: boolean }>) => {
      for (const e of list) if (e.path && e.loop && typeof e.durationSec === "number") durations.set(e.path, e.durationSec);
    })
    .catch(() => undefined);
  const loadOne = async (path: string): Promise<void> => {
    if (buffers.has(path) || failed.has(path)) return;
    try {
      const res = await fetch(assetUrl(`audio/${path}`));
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.arrayBuffer();
      buffers.set(path, await ctx.decodeAudioData(data));
    } catch {
      failed.add(path);
    }
  };
  return {
    get: (path) => buffers.get(path) ?? null,
    loopEnd: (path) => durations.get(path) ?? null,
    pick: (paths) => {
      const ok = paths.filter((p) => buffers.has(p));
      return ok.length > 0 ? (buffers.get(ok[Math.floor(Math.random() * ok.length)]) as AudioBuffer) : null;
    },
    load: async (paths, onProgress) => {
      let done = 0;
      const queue = [...new Set(paths)];
      const worker = async (): Promise<void> => {
        for (let next = queue.shift(); next; next = queue.shift()) {
          await loadOne(next);
          done += 1;
          onProgress?.(done / paths.length);
        }
      };
      await Promise.all([worker(), worker(), worker(), worker(), manifest]);
    },
  };
};

export const variants = (prefix: string, count: number): string[] =>
  Array.from({ length: count }, (_, i) => `${prefix}${i + 1}.mp3`);
