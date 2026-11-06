import { Bus } from "@/types/audio";
import { maybeRecordMix } from "@/lib/audio-recorder";
import type { Vec2 } from "@/types/world";

export interface PlayOptions {
  bus: Bus;
  gain?: number;
  rate?: number;
  /** World position for 3D sound; omitted = plays "in your head". */
  at?: { x: number; y?: number; z: number };
  /** Muffle as if heard through a wall. */
  occluded?: boolean;
  refDistance?: number;
  loop?: boolean;
}

export interface PlayingSound {
  source: AudioBufferSourceNode;
  gain: GainNode;
  panner: PannerNode | null;
  filter: BiquadFilterNode | null;
  stop: (fadeSeconds?: number) => void;
  moveTo: (p: Vec2, y?: number) => void;
  setOccluded: (occluded: boolean) => void;
}

const OCCLUDED_CUTOFF = 750;
const OPEN_CUTOFF = 20000;
const OCCLUDED_GAIN = 0.5;

/** Mixer: master → compressor → speakers, with one gain per bus, plus helpers to fire buffers. */
export const createAudioGraph = (ctx: AudioContext) => {
  const master = ctx.createGain();
  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -14;
  compressor.ratio.value = 3.5;
  master.connect(compressor).connect(ctx.destination);
  maybeRecordMix(ctx, compressor);
  const buses: Record<Bus, GainNode> = {
    [Bus.Ambience]: ctx.createGain(),
    [Bus.Music]: ctx.createGain(),
    [Bus.Sfx]: ctx.createGain(),
    [Bus.Voice]: ctx.createGain(),
  };
  buses[Bus.Ambience].gain.value = 0.75;
  buses[Bus.Music].gain.value = 0.55;
  buses[Bus.Sfx].gain.value = 1;
  buses[Bus.Voice].gain.value = 1;
  for (const b of Object.values(buses)) b.connect(master);

  const play = (buffer: AudioBuffer | null, opts: PlayOptions): PlayingSound | null => {
    if (!buffer) return null;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = !!opts.loop;
    source.playbackRate.value = opts.rate ?? 1;
    const gain = ctx.createGain();
    const base = opts.gain ?? 1;
    let filter: BiquadFilterNode | null = null;
    let panner: PannerNode | null = null;
    let node: AudioNode = source;
    if (opts.at) {
      filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = opts.occluded ? OCCLUDED_CUTOFF : OPEN_CUTOFF;
      node = node.connect(filter);
      panner = ctx.createPanner();
      panner.panningModel = "HRTF";
      panner.distanceModel = "inverse";
      panner.refDistance = opts.refDistance ?? 2;
      panner.rolloffFactor = 1.3;
      panner.maxDistance = 60;
      panner.positionX.value = opts.at.x;
      panner.positionY.value = opts.at.y ?? 1.2;
      panner.positionZ.value = opts.at.z;
      node = node.connect(panner);
    }
    gain.gain.value = base * (opts.occluded ? OCCLUDED_GAIN : 1);
    node.connect(gain).connect(buses[opts.bus]);
    source.start();
    const playing: PlayingSound = {
      source,
      gain,
      panner,
      filter,
      stop: (fade = 0.05) => {
        const now = ctx.currentTime;
        gain.gain.cancelScheduledValues(now);
        gain.gain.setValueAtTime(gain.gain.value, now);
        gain.gain.linearRampToValueAtTime(0, now + fade);
        source.stop(now + fade + 0.02);
      },
      moveTo: (p, y = 1.2) => {
        if (!panner) return;
        const now = ctx.currentTime;
        panner.positionX.setTargetAtTime(p.x, now, 0.05);
        panner.positionY.setTargetAtTime(y, now, 0.05);
        panner.positionZ.setTargetAtTime(p.z, now, 0.05);
      },
      setOccluded: (occluded) => {
        if (!filter) return;
        filter.frequency.setTargetAtTime(occluded ? OCCLUDED_CUTOFF : OPEN_CUTOFF, ctx.currentTime, 0.15);
      },
    };
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
      filter?.disconnect();
      panner?.disconnect();
    };
    return playing;
  };

  const setListener = (x: number, y: number, z: number, yaw: number): void => {
    const l = ctx.listener;
    const fx = -Math.sin(yaw);
    const fz = -Math.cos(yaw);
    const now = ctx.currentTime;
    if (l.positionX) {
      l.positionX.setTargetAtTime(x, now, 0.02);
      l.positionY.setTargetAtTime(y, now, 0.02);
      l.positionZ.setTargetAtTime(z, now, 0.02);
      l.forwardX.setTargetAtTime(fx, now, 0.02);
      l.forwardY.setTargetAtTime(0, now, 0.02);
      l.forwardZ.setTargetAtTime(fz, now, 0.02);
      l.upX.value = 0;
      l.upY.value = 1;
      l.upZ.value = 0;
    } else {
      l.setPosition(x, y, z);
      l.setOrientation(fx, 0, fz, 0, 1, 0);
    }
  };

  return { ctx, master, buses, play, setListener };
};

export type AudioGraph = ReturnType<typeof createAudioGraph>;
