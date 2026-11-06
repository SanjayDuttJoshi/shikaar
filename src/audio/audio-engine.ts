import { Bus, UiSound } from "@/types/audio";
import { GameEventKind, MonsterMode, PlayerStatus, ScareKind } from "@/types/game";
import type { GameEvent, WorldState } from "@/types/game";
import { HideKind, LightKind, MonsterKind, SetPieceKind, Theme } from "@/types/world";
import type { Level, Vec2 } from "@/types/world";
import { createAudioGraph } from "@/audio/audio-graph";
import type { PlayingSound } from "@/audio/audio-graph";
import type { AudioFrame, AudioSink } from "@/audio/audio-sink";
import { createSoundBank } from "@/audio/sound-bank";
import { AMBIENCE, MONSTER_LINES, MONSTER_LOOPS, MONSTER_ROARS, MONSTER_STEPS, PA_LINES, RADIO_LINE, SOUNDS, soundsFor } from "@/audio/sound-list";
import type { Language } from "@/types/ui";
import { voicePath } from "@/lib/voice";
import { sightBlocked } from "@/game/collision";
import { doorOpenness } from "@/game/context";
import type { GameContext } from "@/game/context";

const OCCLUSION_INTERVAL = 0.3;
const STINGER_GAP = 8;
const HUM_POOL = 2;

export type AudioEngine = AudioSink;

const smooth = (x: number): number => x * x * (3 - 2 * x);

export const createAudioEngine = async (
  audioCtx: AudioContext,
  game: GameContext,
  volume: number,
  lang: Language,
  onProgress: (f: number) => void,
): Promise<AudioEngine> => {
  const level = game.level;
  const graph = createAudioGraph(audioCtx);
  graph.master.gain.value = volume;
  const bank = createSoundBank(audioCtx);
  await bank.load(soundsFor(level.theme, lang), onProgress);
  let lineListener: (id: string) => void = () => undefined;
  const voice = (id: string): AudioBuffer | null => bank.get(voicePath(id, lang));
  let listener = { x: 0, y: 1.6, z: 0, yaw: 0 };
  let lastStinger = -99;
  let clock = 0;
  let occlusionTimer = 0;
  let paVoice: PlayingSound | null = null;
  const paQueue: string[] = [];

  const loop = (path: string, bus: Bus, gain: number, at?: Vec2): PlayingSound | null => {
    const playing = graph.play(bank.get(path), { bus, gain, loop: true, at: at ? { x: at.x, z: at.z } : undefined, refDistance: 2.5 });
    const end = bank.loopEnd(path);
    if (playing && end && end < (playing.source.buffer?.duration ?? 0)) playing.source.loopEnd = end;
    return playing;
  };

  const ambience = AMBIENCE[level.theme].map((p, i) => loop(p, Bus.Ambience, i === 0 ? 1 : 0.55));
  const tension = loop(SOUNDS.tension, Bus.Music, 0);
  const chase = loop(SOUNDS.chase, Bus.Music, 0);
  const heartbeat = loop(SOUNDS.heartbeat, Bus.Sfx, 0);
  const breath = loop(SOUNDS.breath, Bus.Sfx, 0);
  const monsterLoops = level.monsterSpawns.map((m) => MONSTER_LOOPS[m.kind].map((path) => loop(path, Bus.Sfx, 0, m)));
  const kindOf = (id: number | undefined): MonsterKind => level.monsterSpawns[id ?? 0]?.kind ?? MonsterKind.Shikari;
  /** Sobbing from the corner figures, until each one is disturbed. */
  const cryingLoops = new Map<number, PlayingSound | null>();
  for (const sp of level.setPieces) {
    if (sp.kind !== SetPieceKind.CryingFigure) continue;
    cryingLoops.set(sp.id, loop(level.theme === Theme.Asylum ? SOUNDS.manCrying : SOUNDS.womanCrying, Bus.Sfx, 0.9, sp));
  }
  const pieceLoops: PlayingSound[] = [];
  const tubes = level.lights.filter((l) => !l.dead && (l.kind === LightKind.TubeLight || l.kind === LightKind.Bulb));
  const hums = level.theme === Theme.Asylum ? Array.from({ length: HUM_POOL }, () => loop(SOUNDS.hum, Bus.Ambience, 0.0, { x: 0, z: 0 })) : [];

  const blocked = (x: number, z: number, state: WorldState): boolean =>
    sightBlocked(game.world, { x: listener.x, z: listener.z }, { x, z }, doorOpenness(state));

  const at3d = (paths: string[], x: number, z: number, state: WorldState, gain = 1, y = 1.2, ref = 2): void => {
    graph.play(bank.pick(paths), { bus: Bus.Sfx, gain, at: { x, y, z }, occluded: blocked(x, z, state), refDistance: ref, rate: 0.94 + Math.random() * 0.12 });
  };
  const flat = (paths: string[], gain = 1, bus = Bus.Sfx): void => {
    graph.play(bank.pick(paths), { bus, gain, rate: 0.96 + Math.random() * 0.08 });
  };
  const stinger = (): void => {
    if (clock - lastStinger < STINGER_GAP) return;
    lastStinger = clock;
    flat(SOUNDS.stinger, 0.8, Bus.Music);
  };
  const playPa = (id: string): void => {
    if (paVoice) {
      if (paQueue.length < 1) paQueue.push(id);
      return;
    }
    paVoice = graph.play(voice(id), { bus: Bus.Voice, gain: 0.9 });
    if (paVoice) lineListener(id);
    if (paVoice) {
      paVoice.source.addEventListener("ended", () => {
        paVoice = null;
        const next = paQueue.shift();
        if (next) playPa(next);
      });
    }
  };
  playPa(level.theme === Theme.Asylum ? PA_LINES.introAsylum : PA_LINES.introHaveli);

  const event = (e: GameEvent, state: WorldState, _level: Level, selfId: string): void => {
    const x = e.x ?? listener.x;
    const z = e.z ?? listener.z;
    const mine = e.player === selfId;
    switch (e.kind) {
      case GameEventKind.MonsterStep: {
        const kind = kindOf(e.monster);
        at3d(MONSTER_STEPS[kind], x, z, state, kind === MonsterKind.Chudail ? 0.7 : 1.1, 0.2, 2.5);
        break;
      }
      case GameEventKind.MonsterRoar:
        at3d(Math.random() < 0.7 ? MONSTER_ROARS[kindOf(e.monster)] : SOUNDS.growls, x, z, state, 1.2, 2, 4);
        break;
      case GameEventKind.MonsterScream:
        at3d(MONSTER_ROARS[kindOf(e.monster)], x, z, state, 1.4, 1.8, 5);
        if (mine) flat(SOUNDS.stingerChudail, 0.9, Bus.Music);
        break;
      case GameEventKind.SetPiece:
        playSetPiece(e.setPiece ?? -1, state);
        break;
      case GameEventKind.MonsterSpotted:
        if (mine) stinger();
        break;
      case GameEventKind.MonsterTaunt:
      {
        const options = MONSTER_LINES[kindOf(e.monster)];
        const id = options[Math.floor(Math.random() * options.length)];
        const played = graph.play(voice(id), { bus: Bus.Voice, gain: 1.15, at: { x, y: 2, z }, occluded: blocked(x, z, state), refDistance: 3.5 });
        if (played && Math.hypot(x - listener.x, z - listener.z) < 20) lineListener(id);
      }
        break;
      case GameEventKind.MonsterSniff:
        at3d(SOUNDS.sniff, x, z, state, 1, 1.9, 2.5);
        break;
      case GameEventKind.MonsterStunned:
        at3d(SOUNDS.monsterScream, x, z, state, 1, 2, 4);
        break;
      case GameEventKind.PlayerHit:
        at3d(SOUNDS.attack, x, z, state, 1.2);
        if (mine) {
          flat(SOUNDS.hurt, 1);
          flat(SOUNDS.stinger, 0.9, Bus.Music);
        }
        break;
      case GameEventKind.PlayerDowned:
        at3d(SOUNDS.downed, x, z, state);
        if (!mine) playPa(PA_LINES.downed);
        break;
      case GameEventKind.PlayerDied:
        if (mine) flat(SOUNDS.death, 1, Bus.Music);
        break;
      case GameEventKind.PlayerRevived:
        at3d(SOUNDS.revive, x, z, state);
        break;
      case GameEventKind.PlayerEscaped:
        if (mine) flat(SOUNDS.escape, 1, Bus.Music);
        break;
      case GameEventKind.PlayerHid:
      case GameEventKind.PlayerUnhid:
      case GameEventKind.PlayerPulledOut: {
        const me = state.players.find((p) => p.id === e.player);
        const spot = me && me.hideSpot >= 0 ? level.hideSpots[me.hideSpot] : null;
        const wood = level.theme === Theme.Haveli || spot?.kind === HideKind.Wardrobe;
        const opening = e.kind !== GameEventKind.PlayerHid;
        at3d(wood ? (opening ? SOUNDS.wardrobeOpen : SOUNDS.wardrobeClose) : opening ? SOUNDS.lockerOpen : SOUNDS.lockerClose, x, z, state, 0.9);
        if (e.kind === GameEventKind.PlayerPulledOut && mine) flat(SOUNDS.monsterScream, 1.1);
        break;
      }
      case GameEventKind.DoorOpened:
        at3d(SOUNDS.doorOpen, x, z, state, 0.8);
        break;
      case GameEventKind.DoorClosed:
        at3d(SOUNDS.doorClose, x, z, state, 0.8);
        break;
      case GameEventKind.DoorLocked:
        if (mine) at3d(SOUNDS.doorLocked, x, z, state, 0.9);
        break;
      case GameEventKind.DoorUnlocked:
        at3d(SOUNDS.doorUnlock, x, z, state);
        break;
      case GameEventKind.KeyFound:
        at3d(SOUNDS.key, x, z, state);
        playPa(PA_LINES.key);
        break;
      case GameEventKind.FuseFound:
      case GameEventKind.BatteryFound:
      case GameEventKind.MedkitUsed:
        at3d(SOUNDS.item, x, z, state, 0.9);
        break;
      case GameEventKind.FuseInserted:
        at3d(SOUNDS.item, x, z, state);
        if (state.fusesInserted < state.fusesNeeded) playPa(PA_LINES.fuse);
        break;
      case GameEventKind.PowerRestored:
        flat(SOUNDS.power, 1);
        playPa(PA_LINES.power);
        break;
      case GameEventKind.GateOpen: {
        const gate = level.doors[level.exitDoorId];
        at3d(SOUNDS.gate, (gate.cx + 1) * 3, (gate.cy + 1) * 3, state, 1.3, 1.5, 6);
        playPa(PA_LINES.gate);
        break;
      }
      case GameEventKind.Flash:
        if (mine) flat(SOUNDS.flash, 0.9);
        break;
      case GameEventKind.Scare:
        if (!mine) break;
        playScare(e.scare ?? ScareKind.Whisper, x, z, state);
        break;
      default:
        break;
    }
  };

  const playSetPiece = (id: number, state: WorldState): void => {
    const sp = level.setPieces[id];
    if (!sp) return;
    switch (sp.kind) {
      case SetPieceKind.FallingBody: {
        at3d(SOUNDS.bodyDrop, sp.x, sp.z, state, 1.3, 2.2, 4);
        flat(SOUNDS.stingerLow, 1, Bus.Music);
        const creak = loop(SOUNDS.ropeCreak, Bus.Sfx, 0.7, sp);
        if (creak) pieceLoops.push(creak);
        break;
      }
      case SetPieceKind.CryingFigure: {
        const crying = cryingLoops.get(id);
        crying?.stop(0.15);
        cryingLoops.set(id, null);
        at3d(level.theme === Theme.Asylum ? MONSTER_ROARS[MonsterKind.Mareez] : MONSTER_ROARS[MonsterKind.Chudail], sp.x, sp.z, state, 1.3, 1.2, 4);
        flat(SOUNDS.stinger, 0.9, Bus.Music);
        break;
      }
      case SetPieceKind.Cat:
        at3d(SOUNDS.catHiss, sp.x, sp.z, state, 1.2, sp.y, 3);
        window.setTimeout(() => at3d(SOUNDS.catRun, sp.x, sp.z, state, 0.9, 0.3, 3), 350);
        break;
      case SetPieceKind.Rooster:
        at3d(SOUNDS.chickenFlap, sp.x, sp.z, state, 1.2, 0.6, 3);
        at3d(SOUNDS.rooster, sp.x, sp.z, state, 1.3, 0.8, 5);
        break;
      case SetPieceKind.RockingChair: {
        const rock = loop(SOUNDS.rockingChair, Bus.Sfx, 0.9, sp);
        if (rock) pieceLoops.push(rock);
        break;
      }
      case SetPieceKind.Radio: {
        const hiss = loop(SOUNDS.radioStatic, Bus.Sfx, 0.6, sp);
        if (hiss) pieceLoops.push(hiss);
        graph.play(voice(RADIO_LINE), { bus: Bus.Voice, gain: 0.9, at: { x: sp.x, y: 1, z: sp.z }, refDistance: 2.5 });
        lineListener(RADIO_LINE);
        break;
      }
      default:
        break;
    }
  };

  const playScare = (kind: ScareKind, x: number, z: number, state: WorldState): void => {
    switch (kind) {
      case ScareKind.Whistle:
        at3d(SOUNDS.whistle, x, z, state, 0.9, 1.6, 8);
        break;
      case ScareKind.BabyCry:
        at3d(SOUNDS.babyCry, x, z, state, 0.8, 1.2, 6);
        break;
      case ScareKind.MusicBox:
        at3d(SOUNDS.musicBox, x, z, state, 0.9, 1, 3);
        break;
      case ScareKind.DoorSlam:
        at3d(SOUNDS.doorSlam, x, z, state, 1.2, 1.2, 4);
        break;
      case ScareKind.DistantScream:
        at3d(SOUNDS.screams, x, z, state, 0.9, 2, 6);
        break;
      case ScareKind.Whisper:
        graph.play(bank.pick(SOUNDS.whispers), { bus: Bus.Voice, gain: 0.8, at: { x, y: 1.7, z }, refDistance: 1 });
        break;
      case ScareKind.BreathBehind:
        graph.play(bank.pick(SOUNDS.breathBehind), { bus: Bus.Voice, gain: 0.9, at: { x, y: 1.7, z }, refDistance: 1 });
        break;
      case ScareKind.LightsBurst:
        flat(SOUNDS.glass, 0.35);
        break;
      case ScareKind.ObjectFall:
        at3d(SOUNDS.fall, x, z, state, 1, 0.5, 4);
        break;
      case ScareKind.MetalScrape:
        at3d(Math.random() < 0.5 ? SOUNDS.scrape : SOUNDS.chains, x, z, state, 0.9, 1, 4);
        break;
      case ScareKind.ChildLaugh:
        at3d(Math.random() < 0.6 ? SOUNDS.childLaugh : SOUNDS.piano, x, z, state, 0.8, 1, 5);
        break;
      case ScareKind.FootstepsAbove:
        graph.play(bank.pick(SOUNDS.runningAbove), { bus: Bus.Sfx, gain: 0.8, at: { x: listener.x + 2, y: 5, z: listener.z - 1 }, refDistance: 4 });
        break;
      case ScareKind.Knock:
        at3d(SOUNDS.knock, x, z, state, 1, 1.2, 3);
        break;
      default:
        at3d(SOUNDS.glass, x, z, state, 0.8, 1, 4);
    }
  };

  const update = ({ listener: l, state, self, dt, dread, chasing }: AudioFrame): void => {
    clock += dt;
    listener = l;
    graph.setListener(l.x, l.y, l.z, l.yaw);
    const now = audioCtx.currentTime;
    const ramp = (s: PlayingSound | null, v: number, tc = 0.4): void => {
      s?.gain.gain.setTargetAtTime(v, now, tc);
    };
    const alive = self && (self.status === PlayerStatus.Alive || self.status === PlayerStatus.Hiding || self.status === PlayerStatus.Downed);
    ramp(tension, alive ? 0.25 + dread * 0.5 : 0, 1.2);
    ramp(chase, alive && chasing ? 0.9 : 0, chasing ? 0.15 : 1.5);
    ramp(heartbeat, alive ? smooth(Math.min(1, dread * 1.2)) * 0.9 : 0, 0.3);
    // The loop is one beat at 60 bpm: 70 bpm when calm, up to ~150 when it is right behind you.
    if (heartbeat) heartbeat.source.playbackRate.setTargetAtTime(1.15 + dread * 1.35, now, 0.5);
    const tired = self ? Math.max(0, 1 - self.stamina / 70) : 0;
    ramp(breath, alive ? smooth(Math.min(1, tired)) * 0.7 : 0, 0.5);
    const duck = paVoice ? 0.55 : 1;
    ambience.forEach((s, i) => ramp(s, (i === 0 ? 1 : 0.5) * duck, 0.6));

    occlusionTimer -= dt;
    const recheck = occlusionTimer <= 0;
    if (recheck) occlusionTimer = OCCLUSION_INTERVAL;
    state.monsters.forEach((m, i) => {
      const chasing = m.mode === MonsterMode.Chase || m.mode === MonsterMode.Attack;
      (monsterLoops[i] ?? []).forEach((s, j) => {
        if (!s) return;
        s.moveTo(m, m.kind === MonsterKind.Mareez && j === 0 ? 0.1 : 1.8);
        let gain = 0.8;
        if (m.kind === MonsterKind.Shikari) gain = j === 0 ? (chasing ? 1.2 : 0.85) : Math.min(0.7, 0.2 + m.speed * 0.15);
        if (m.kind === MonsterKind.Chudail) gain = chasing ? 0 : 0.85;
        if (m.kind === MonsterKind.Mareez) gain = j === 0 ? Math.min(1, m.speed / 2.5) : chasing ? 0.2 : 0.75;
        if (m.mode === MonsterMode.Stunned) gain *= 0.3;
        ramp(s, gain, 0.3);
        if (recheck) s.setOccluded(blocked(m.x, m.z, state));
      });
    });
    if (hums.length > 0 && recheck) {
      const near = [...tubes].sort((a, b) => Math.hypot(a.x - l.x, a.z - l.z) - Math.hypot(b.x - l.x, b.z - l.z));
      hums.forEach((h, i) => {
        const light = near[i];
        if (!h || !light) return;
        h.moveTo(light, light.y);
        ramp(h, Math.hypot(light.x - l.x, light.z - l.z) < 14 ? 0.5 : 0, 0.5);
      });
    }
  };

  return {
    event,
    update,
    footstep: (x, z, loud, self) => {
      const wood = level.theme === Theme.Haveli;
      const paths = wood ? SOUNDS.woodSteps : SOUNDS.tileSteps;
      if (self) graph.play(bank.pick(paths), { bus: Bus.Sfx, gain: 0.35 + loud * 0.45, rate: 0.92 + Math.random() * 0.16 });
      else graph.play(bank.pick(paths), { bus: Bus.Sfx, gain: 0.3 + loud * 0.5, at: { x, y: 0.2, z } });
    },
    ui: (sound) => {
      if (sound === UiSound.TorchClick) flat(SOUNDS.torch, 0.7);
    },
    setPaused: (paused) => {
      if (paused) audioCtx.suspend().catch(() => undefined);
      else audioCtx.resume().catch(() => undefined);
    },
    setVolume: (v) => graph.master.gain.setTargetAtTime(v, audioCtx.currentTime, 0.1),
    onLine: (fn) => {
      lineListener = fn;
    },
    playLine: (id) => {
      const played = graph.play(voice(id), { bus: Bus.Voice, gain: 1 });
      if (played) lineListener(id);
      return played ? (played.source.buffer?.duration ?? 0) : 0;
    },
    loadLines: (ids) => bank.load(ids.map((id) => voicePath(id, lang))),
    duck: (amount) => {
      const base: Array<[Bus, number]> = [
        [Bus.Ambience, 0.75],
        [Bus.Music, 0.55],
        [Bus.Sfx, 1],
      ];
      for (const [bus, gain] of base) graph.buses[bus].gain.setTargetAtTime(gain * (1 - amount), audioCtx.currentTime, 0.3);
    },
    dispose: () => {
      for (const s of [...ambience, tension, chase, heartbeat, breath, ...monsterLoops.flat(), ...hums, ...cryingLoops.values(), ...pieceLoops]) s?.stop(0.3);
      paVoice?.stop(0.2);
      window.setTimeout(() => graph.master.disconnect(), 500);
    },
  };
};
