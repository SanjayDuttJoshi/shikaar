import { assetUrl } from "@/lib/asset-url";
import { unlockAudio } from "@/audio/audio-context";

let source: AudioBufferSourceNode | null = null;
let gain: GainNode | null = null;
let buffer: Promise<AudioBuffer | null> | null = null;
/** False once a round starts, so a decode that finishes late doesn't start music mid-game. */
let wanted = false;

/** Eerie loop on the menu. Starts after the first tap/click (browsers block sound before that). */
export const startMenuMusic = async (volume: number): Promise<void> => {
  wanted = true;
  const ctx = unlockAudio();
  if (!ctx || source) return;
  buffer ??= fetch(assetUrl("audio/music/menu-loop.mp3"))
    .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error("missing"))))
    .then((data) => ctx.decodeAudioData(data))
    .catch(() => null);
  const decoded = await buffer;
  if (!decoded || source || !wanted) return;
  gain = ctx.createGain();
  gain.gain.value = 0;
  gain.gain.setTargetAtTime(0.45 * volume, ctx.currentTime, 1.2);
  gain.connect(ctx.destination);
  source = ctx.createBufferSource();
  source.buffer = decoded;
  source.loop = true;
  source.connect(gain);
  source.start();
};

export const stopMenuMusic = (): void => {
  wanted = false;
  if (!source || !gain) return;
  const ctx = gain.context;
  const s = source;
  gain.gain.setTargetAtTime(0, ctx.currentTime, 0.3);
  s.stop(ctx.currentTime + 1.2);
  source = null;
  gain = null;
};
