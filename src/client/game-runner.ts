import * as THREE from "three";
import { GameEventKind, InteractKind, MonsterMode, PlayerStatus, RoundPhase, ScareKind, Stance } from "@/types/game";
import type { GameEvent, InteractTarget, PlayerInput, PlayerState } from "@/types/game";
import { MessageTone, type HudMessage } from "@/types/ui";
import { HideKind, MonsterKind, Theme } from "@/types/world";
import { UiSound } from "@/types/audio";
import type { AudioSink } from "@/audio/audio-sink";
import { createCameraRig } from "@/client/camera-rig";
import type { CameraRig } from "@/client/camera-rig";
import { createMateSteps, pickWatched } from "@/client/squad-view";
import { messageFor, objectiveText } from "@/client/event-messages";
import type { HudStore } from "@/client/hud-store";
import type { InputState } from "@/client/input-state";
import type { Session } from "@/client/session";
import { FLASH_COOLDOWN, REVIVE_SECONDS } from "@/game/constants";
import { findInteractTarget } from "@/game/interact";
import type { SceneView } from "@/render3d/scene-view";
import type { FilmFrame, FilmPlayer } from "@/film/film-player";
import type { Film } from "@/types/story";
import { Language } from "@/types/ui";

const HUD_INTERVAL = 0.1;
const MAX_FRAME_DT = 0.1;
const HIDE_LOOK = 0.9;
const HIDE_PITCH = 0.45;
const DREAD_RANGE = 18;
/** After dying or escaping online, the camera lingers on your own body this long before following a friend. */
const WATCH_AFTER = 3;

/** The first time each monster shows up, one line on how to survive it. */
const MONSTER_HINT: Record<MonsterKind, string> = {
  [MonsterKind.Shikari]: "Laal lalten... Chowkidar aa gaya. Nazar se bacho, chhup jao!",
  [MonsterKind.Mareez]: "Woh andha hai... par sab sunta hai. Jhuk ke, bina awaaz chalo.",
  [MonsterKind.Chudail]: "Usse zyada der mat dekho... torch neeche karo!",
};

const TINT: Record<Theme, THREE.Color> = {
  [Theme.Asylum]: new THREE.Color(0.92, 1.0, 0.94),
  [Theme.Haveli]: new THREE.Color(1.04, 0.97, 0.88),
};

export interface RunnerOptions {
  view: SceneView;
  session: Session;
  input: InputState;
  hud: HudStore;
  audio: AudioSink;
  /** Called for every game event after the runner handled it (tests, debug probe). */
  onEvent?: (e: GameEvent) => void;
  /** Story films of this building, played when envelopes are opened. */
  film: FilmPlayer;
  films: Film[];
  language: Language;
}

export interface GameRunner {
  start: () => void;
  stop: () => void;
  setPaused: (paused: boolean) => void;
  isPaused: () => boolean;
  setAudio: (audio: AudioSink) => void;
  audio: () => AudioSink;
  /** Replays a story film already unlocked (from the pause menu). */
  playFilm: (index: number) => void;
  /** Shows a spoken line as a subtitle (monsters, announcer, radio). */
  subtitle: (text: string) => void;
}

export const createGameRunner = ({ view, session, input, hud, audio: initialAudio, onEvent, film, films, language }: RunnerOptions): GameRunner => {
  const { ctx, state, selfId } = session;
  const level = ctx.level;
  const me = (): PlayerState | undefined => state.players.find((p) => p.id === selfId);
  const first = me() as PlayerState;
  const rig = createCameraRig(first);
  let audio = initialAudio;
  let raf = 0;
  let last = 0;
  let t = 0;
  let paused = false;
  let hudTimer = 0;
  let flash = 0;
  let damage = 0;
  let panic = 0;
  let black = 1;
  let messageId = 0;
  let messages: HudMessage[] = [];
  let target: InteractTarget = { kind: InteractKind.None, id: -1, label: "", holdSeconds: 0 };
  let hideAnchor = first.yaw;
  /** Envelope just opened: the film it offers, waiting for Play / Later. */
  let offer = -1;
  let filmLoading = false;
  let filmFrame: FilmFrame | null = null;
  const hinted = new Set<MonsterKind>();
  let wasHiding = false;
  const events: GameEvent[] = [];
  const online = session.online;
  const mateSteps = createMateSteps();
  /** Online, once you're out of the round you watch a friend still inside (E switches). */
  let watching: string | null = null;
  let watchRig: CameraRig | null = null;
  let outFor = 0;

  /** Standing still: what an online round sends while you're in a menu or watching a film. */
  const idleInput = (p: PlayerState): PlayerInput => ({ moveX: 0, moveZ: 0, yaw: p.yaw, pitch: p.pitch, sprint: false, crouch: p.stance === Stance.Crouch });

  const pushMessage = (text: string, tone: MessageTone, seconds: number): void => {
    messageId += 1;
    messages = [...messages.filter((m) => m.text !== text), { id: messageId, text, tone, until: t + seconds }].slice(-4);
  };

  const nearestMonster = (x: number, z: number): { d: number; chasing: boolean; at: { x: number; z: number } | null } => {
    let best = Number.POSITIVE_INFINITY;
    let at: { x: number; z: number } | null = null;
    let chasing = false;
    for (const m of state.monsters) {
      const d = Math.hypot(m.x - x, m.z - z);
      if (d < best) {
        best = d;
        at = { x: m.x, z: m.z };
      }
      if ((m.mode === MonsterMode.Chase || m.mode === MonsterMode.Attack) && m.target === selfId) chasing = true;
    }
    return { d: best, chasing, at };
  };

  const handleEvent = (e: GameEvent): void => {
    const mine = e.player === selfId;
    if (mine && e.kind === GameEventKind.PlayerHit) {
      damage = 1;
      rig.shake(1.3);
      const nm = nearestMonster(rig.pose.x, rig.pose.z);
      if (nm.at) rig.lookAt(nm.at, 0.7);
    }
    if (mine && e.kind === GameEventKind.Flash) flash = 1;
    if (mine && e.kind === GameEventKind.EnvelopeOpened && e.note !== undefined) offer = e.note;
    if (mine && e.kind === GameEventKind.PlayerPulledOut) rig.shake(1.2);
    // Online the world doesn't wait while you watch a film: getting hurt ends it.
    const hurt = e.kind === GameEventKind.PlayerHit || e.kind === GameEventKind.PlayerDowned || e.kind === GameEventKind.PlayerPulledOut;
    if (mine && hurt && film.isPlaying()) film.stop();
    if (e.kind === GameEventKind.MonsterSpotted && e.player === selfId) rig.shake(0.5);
    if (e.kind === GameEventKind.Scare && e.scare === ScareKind.DoorSlam && e.x !== undefined && e.z !== undefined) {
      const d = Math.hypot(e.x - rig.pose.x, e.z - rig.pose.z);
      if (d < 14) rig.shake(0.35);
    }
    if (e.kind === GameEventKind.MonsterStep && e.x !== undefined && e.z !== undefined) {
      const d = Math.hypot(e.x - rig.pose.x, e.z - rig.pose.z);
      if (d < 6) rig.shake(0.12 * (1 - d / 6));
    }
    if ((e.kind === GameEventKind.MonsterSpotted || e.kind === GameEventKind.MonsterScream) && e.monster !== undefined) {
      const kind = state.monsters[e.monster]?.kind;
      if (kind && !hinted.has(kind) && Math.hypot((e.x ?? 0) - rig.pose.x, (e.z ?? 0) - rig.pose.z) < 25) {
        hinted.add(kind);
        pushMessage(MONSTER_HINT[kind], MessageTone.Voice, 4.5);
      }
    }
    const spec = messageFor(e, state, level, selfId);
    if (spec) pushMessage(spec.text, spec.tone, spec.seconds);
    audio.event(e, state, level, selfId);
    onEvent?.(e);
  };

  const publishHud = (p: PlayerState): void => {
    messages = messages.filter((m) => m.until > t);
    const locks = level.wings.filter((w) => w.lock !== null).length;
    hud.set({
      phase: state.phase,
      outcome: state.outcome,
      theme: state.theme,
      status: p.status,
      health: p.health,
      stamina: p.stamina,
      exhausted: p.exhausted,
      battery: p.battery,
      torchOn: p.torchOn,
      flashReady: 1 - p.flashCooldown / FLASH_COOLDOWN,
      prompt: target.label,
      promptHold: target.kind === InteractKind.Revive ? (state.players.find((q) => q.id === target.id)?.revive ?? 0) / REVIVE_SECONDS : 0,
      keys: [...state.keys],
      keysTotal: locks,
      fusesInserted: state.fusesInserted,
      fusesNeeded: state.fusesNeeded,
      carrying: p.carrying >= 0,
      objective: objectiveText(state, level, selfId),
      gateTimer: state.phase === RoundPhase.GateOpening && !state.gateOpen ? Math.max(0, state.phaseTimer) : -1,
      messages,
      teammates: state.players
        .filter((q) => q.id !== selfId)
        .map((q) => ({ id: q.id, name: q.name, status: q.status, distance: Math.hypot(q.x - p.x, q.z - p.z) })),
      hidden: p.status === PlayerStatus.Hiding,
      hideKind: p.status === PlayerStatus.Hiding ? (level.hideSpots[p.hideSpot]?.kind ?? null) : null,
      offer,
      offerTitle: offer >= 0 && films[offer] ? (language === Language.English ? films[offer].title.en : films[offer].title.hi) : "",
      film: filmFrame && (filmFrame.playing || filmLoading) ? { title: filmFrame.title, subtitle: filmFrame.subtitle, progress: filmFrame.progress } : filmLoading ? { title: "...", subtitle: "", progress: 0 } : null,
      filmsUnlocked: state.notesFound.map((i) => ({ index: i, title: films[i] ? (language === Language.English ? films[i].title.en : films[i].title.hi) : "" })),
      notesFound: state.notesFound.length,
      notesTotal: level.notes.length,
      bleed: p.bleed,
      time: state.time,
      paused,
      online,
      waiting: state.phase === RoundPhase.Intro ? session.waitingFor().join(", ") : "",
      watching: watching ? (state.players.find((q) => q.id === watching)?.name ?? "") : "",
    });
  };

  const startFilm = (index: number): void => {
    const chosen = films[index];
    offer = -1;
    if (!chosen) return;
    filmLoading = true;
    film
      .play(chosen, language)
      .catch(() => undefined)
      .finally(() => {
        filmLoading = false;
      });
  };

  const tick = (now: number): void => {
    raf = requestAnimationFrame(tick);
    const dt = Math.min(MAX_FRAME_DT, last === 0 ? 0 : (now - last) / 1000);
    last = now;
    const p = me();
    if (!p) return;
    if (filmLoading || film.isPlaying()) {
      if (input.interactPressed || input.flashPressed) film.stop();
      input.interactPressed = false;
      input.flashPressed = false;
      input.torchPressed = false;
      if (online) {
        events.length = 0;
        session.step(idleInput(p), dt, events);
        for (const e of events) handleEvent(e);
      }
      filmFrame = film.update(dt);
      if (film.isPlaying()) film.render();
      hudTimer -= dt;
      if (hudTimer <= 0) {
        hudTimer = HUD_INTERVAL;
        publishHud(p);
      }
      return;
    }
    if (offer >= 0) {
      if (input.interactPressed) startFilm(offer);
      else if (input.flashPressed || input.torchPressed) offer = -1;
      input.interactPressed = false;
      input.flashPressed = false;
      input.torchPressed = false;
      if (offer < 0 || filmLoading) publishHud(p);
    }
    const blocked = paused || offer >= 0;
    const pressedUse = input.interactPressed;
    if (online && blocked) {
      events.length = 0;
      t += dt;
      input.interactPressed = false;
      input.flashPressed = false;
      input.torchPressed = false;
      session.step(idleInput(p), dt, events);
      for (const e of events) handleEvent(e);
    } else if (!blocked) {
      t += dt;
      if (p.status === PlayerStatus.Hiding) {
        if (!wasHiding && p.hideSpot >= 0) {
          const spot = level.hideSpots[p.hideSpot];
          if (spot) {
            const look = spot.kind === HideKind.UnderBed ? spot.yaw - Math.PI / 2 : spot.yaw + Math.PI;
            hideAnchor = look;
            input.yaw = look;
            input.pitch = 0;
          }
        }
        let rel = input.yaw - hideAnchor;
        while (rel > Math.PI) rel -= Math.PI * 2;
        while (rel < -Math.PI) rel += Math.PI * 2;
        input.yaw = hideAnchor + Math.max(-HIDE_LOOK, Math.min(HIDE_LOOK, rel));
        input.pitch = Math.max(-HIDE_PITCH, Math.min(HIDE_PITCH, input.pitch));
      }
      wasHiding = p.status === PlayerStatus.Hiding;
      const frozen = state.phase === RoundPhase.Intro || state.phase === RoundPhase.Ended;
      const moveInput = {
        moveX: frozen ? 0 : input.moveX,
        moveZ: frozen ? 0 : input.moveZ,
        yaw: input.yaw,
        pitch: input.pitch,
        sprint: input.sprint,
        crouch: input.crouch,
      };
      events.length = 0;
      if (input.torchPressed) {
        session.toggleTorch();
        audio.ui(UiSound.TorchClick);
      }
      if (input.flashPressed) session.flash(events);
      target = frozen ? { kind: InteractKind.None, id: -1, label: "", holdSeconds: 0 } : findInteractTarget(ctx, state, p);
      if (input.interactPressed && target.kind !== InteractKind.None && target.kind !== InteractKind.Revive) session.interact(target, events);
      if (input.interactHeld && target.kind === InteractKind.Revive) session.revive(String(target.id), dt, events);
      input.interactPressed = false;
      input.flashPressed = false;
      input.torchPressed = false;
      session.step(moveInput, dt, events);
      for (const e of events) handleEvent(e);
    }

    if (online) mateSteps.update(state, selfId, dt, audio);
    const out = online && (p.status === PlayerStatus.Dead || p.status === PlayerStatus.Escaped) && state.phase !== RoundPhase.Ended;
    outFor = out ? outFor + dt : 0;
    const pick = outFor > WATCH_AFTER ? pickWatched(state, selfId, watching, pressedUse && !blocked) : null;
    if (pick !== watching) {
      watching = pick;
      const target = state.players.find((q) => q.id === pick);
      watchRig = target ? createCameraRig(target) : null;
    }
    const viewed = (watching && state.players.find((q) => q.id === watching)) || p;
    const pose =
      viewed !== p && watchRig
        ? watchRig.update(viewed, level, dt, () => undefined)
        : rig.update(p, level, paused && !online ? 0 : dt, (loud) => audio.footstep(p.x, p.z, loud, true));
    const nm = nearestMonster(pose.x, pose.z);
    const dread = Math.max(0, 1 - nm.d / DREAD_RANGE);
    flash = Math.max(0, flash - dt * 5);
    damage = Math.max(p.health < 2 && p.status === PlayerStatus.Alive ? 0.35 : 0, damage - dt * 0.9);
    if (p.status === PlayerStatus.Downed) damage = Math.max(damage, 0.6);
    panic += ((nm.chasing ? 1 : dread * 0.6) - panic) * Math.min(1, dt * 3);
    const wantBlack = state.phase === RoundPhase.Intro ? Math.min(1, state.phaseTimer / 2) : p.status === PlayerStatus.Dead ? 0.85 : state.phase === RoundPhase.Ended ? 1 : 0;
    black += (wantBlack - black) * Math.min(1, dt * 2.5);

    view.frame({
      state,
      eye: pose,
      torchOn: viewed.torchOn && viewed.status === PlayerStatus.Alive,
      battery: viewed.battery,
      flash,
      showHand: viewed.status === PlayerStatus.Alive,
      insideProp:
        viewed.status === PlayerStatus.Hiding && level.hideSpots[viewed.hideSpot] && level.hideSpots[viewed.hideSpot].kind !== HideKind.UnderBed
          ? level.hideSpots[viewed.hideSpot].propId
          : -1,
      viewer: viewed.id,
      fx: { damage, panic, flash: flash * 0.6, black, tint: TINT[state.theme] },
      dt,
      t,
    });
    audio.update({ listener: { x: pose.x, y: pose.y, z: pose.z, yaw: pose.yaw }, state, self: p, dt: paused && !online ? 0 : dt, dread, chasing: nm.chasing });

    hudTimer -= dt;
    if (hudTimer <= 0) {
      hudTimer = HUD_INTERVAL;
      publishHud(p);
    }
  };

  return {
    start: () => {
      last = 0;
      raf = requestAnimationFrame(tick);
    },
    stop: () => cancelAnimationFrame(raf),
    setPaused: (next) => {
      paused = next;
      audio.setPaused(next && !online);
      const p = me();
      if (p) publishHud(p);
    },
    isPaused: () => paused,
    setAudio: (next) => {
      audio = next;
    },
    audio: () => audio,
    playFilm: (index) => {
      if (state.notesFound.includes(index)) startFilm(index);
    },
    subtitle: (text) => {
      if (film.isPlaying() || filmLoading || !text) return;
      pushMessage(text, MessageTone.Voice, 4);
    },
  };
};
