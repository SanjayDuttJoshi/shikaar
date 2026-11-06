import { GameEventKind, PlayerStatus } from "@/types/game";
import type { PlayerState, WorldState } from "@/types/game";
import { ActionKind, Channel } from "@/types/net";
import { MAX_STEP } from "@/client/session";
import type { Session } from "@/client/session";
import { FLASH_COOLDOWN, FLASH_COST } from "@/game/constants";
import type { GameContext } from "@/game/context";
import { toggleTorch } from "@/game/interact";
import { stepPlayerMotion } from "@/game/player-motion";
import { encodePose } from "@/net/messages";
import type { ActMessage } from "@/net/messages";
import type { RoundLink } from "@/net/round-link";
import { advance, createTrack, retarget, snapTrack } from "@/net/smoother";
import { MODES, STATUSES, applyWorld, parseSnapshot, stanceOf } from "@/net/snapshot";
import type { SnapshotWire } from "@/net/snapshot";

/** Poses per second to the host. */
const POSE_INTERVAL = 1 / 20;
/** After pressing torch/flash, trust our own guess for this long (the host's answer is on its way). */
const PREDICT_HOLD = 0.6;
/** Holding E on a downed friend counts while the runner keeps asking. */
const REVIVE_HOLD = 0.25;
const INBOX_MAX = 30;
/** Say "loaded" again this often while the host still lists us as loading (the first message can get lost). */
const READY_RESEND = 2;
/** No snapshot for this long means the host's connection is struggling. */
const STALE_AFTER = 2.5;

export interface ClientSessionOptions {
  ctx: GameContext;
  state: WorldState;
  selfId: string;
  link: RoundLink;
}

/** A squad member who isn't the host: moves its own body, mirrors everything else from the host's snapshots. */
export const createClientSession = ({ ctx, state, selfId, link }: ClientSessionOptions): Session => {
  const selfIndex = state.players.findIndex((p) => p.id === selfId);
  const monsterTracks = state.monsters.map((m) => createTrack(m.x, m.z, m.yaw));
  const playerTracks = state.players.map((p) => createTrack(p.x, p.z, p.yaw));
  const epochs = state.players.map(() => 0);
  const inbox: SnapshotWire[] = [];
  let lastSeq = 0;
  let clock = 0;
  let lastSnapAt = -1;
  let poseTimer = 0;
  let waiting: string[] = [];
  let torchHold = -1;
  let flashHold = -1;
  let reviveIndex = -1;
  let reviveAt = -1;
  let readyAt = 0;

  link.on(Channel.Snap, (data, peer) => {
    if (peer !== link.hostId) return;
    const wire = parseSnapshot(data);
    if (!wire || wire.n <= lastSeq) return;
    lastSeq = wire.n;
    inbox.push(wire);
    // A hidden tab stops the game loop; keep only the latest few (doors and items get a full copy every 2 s anyway).
    if (inbox.length > INBOX_MAX) inbox.splice(0, inbox.length - INBOX_MAX);
  });

  const send = (act: ActMessage): void => link.send(Channel.Act, act, link.hostId);

  const applySelf = (p: PlayerState, row: number[]): void => {
    const [x, z, , , , , , , , battery, torch, flashCd, , , , , , epoch] = row;
    p.battery = battery;
    if (clock > torchHold) p.torchOn = torch === 1;
    if (clock > flashHold) p.flashCooldown = flashCd;
    if (epoch === epochs[selfIndex]) return;
    epochs[selfIndex] = epoch;
    p.x = x;
    p.z = z;
    p.vx = 0;
    p.vz = 0;
  };

  const applyBodies = (wire: SnapshotWire): void => {
    const interval = lastSnapAt < 0 ? 1 / 15 : clock - lastSnapAt;
    lastSnapAt = clock;
    wire.p.forEach((row, idx) => {
      const p = state.players[idx];
      if (!p) return;
      const [x, z, yaw, pitch, vx, vz, stance, status, health, battery, torch, flashCd, carrying, hideSpot, bleed, revive, sinceHit, epoch, noise, stamina] = row;
      p.status = STATUSES[status] ?? p.status;
      p.health = health;
      p.carrying = carrying;
      p.hideSpot = hideSpot;
      p.bleed = bleed;
      p.revive = revive;
      p.sinceHit = sinceHit;
      if (idx === selfIndex) {
        applySelf(p, row);
        return;
      }
      p.battery = battery;
      p.torchOn = torch === 1;
      p.flashCooldown = flashCd;
      p.pitch = pitch;
      p.vx = vx;
      p.vz = vz;
      p.stance = stanceOf(stance);
      p.noise = noise;
      p.stamina = stamina;
      if (epoch !== epochs[idx]) {
        epochs[idx] = epoch;
        snapTrack(playerTracks[idx], x, z, yaw);
      } else {
        retarget(playerTracks[idx], x, z, yaw, interval);
      }
    });
    wire.m.forEach((row, idx) => {
      const m = state.monsters[idx];
      if (!m) return;
      const [x, z, yaw, speed, mode, target, rage, stare] = row;
      m.speed = speed;
      m.mode = MODES[mode] ?? m.mode;
      m.target = target >= 0 ? (state.players[target]?.id ?? null) : null;
      m.rage = rage;
      m.stare = stare;
      retarget(monsterTracks[idx], x, z, yaw, interval);
    });
  };

  const glide = (dt: number): void => {
    state.monsters.forEach((m, idx) => {
      const pose = advance(monsterTracks[idx], dt);
      m.x = pose.x;
      m.z = pose.z;
      m.yaw = pose.yaw;
    });
    state.players.forEach((p, idx) => {
      if (idx === selfIndex) return;
      const pose = advance(playerTracks[idx], dt);
      p.x = pose.x;
      p.z = pose.z;
      p.yaw = pose.yaw;
    });
    state.time += dt;
    state.phaseTimer -= dt;
    state.lightsBurst = Math.max(0, state.lightsBurst - dt);
    for (const sp of state.setPieces) if (sp.fired) sp.t += dt;
  };

  return {
    ctx,
    state,
    selfId,
    online: true,
    waitingFor: () => waiting,
    trouble: () => (lastSnapAt >= 0 && clock - lastSnapAt > STALE_AFTER ? "Host se connection kamzor hai... jod rahe hain" : ""),
    step: (input, dt, events) => {
      clock += dt;
      for (const wire of inbox.splice(0)) {
        applyWorld(state, wire);
        applyBodies(wire);
        waiting = wire.w;
        for (const e of wire.e) if (!(e.kind === GameEventKind.Flash && e.player === selfId)) events.push(e);
      }
      const me = state.players[selfIndex];
      if (me && waiting.includes(me.name) && clock - readyAt > READY_RESEND) {
        readyAt = clock;
        link.send(Channel.Ready, { round: link.round }, link.hostId);
      }
      let left = dt;
      while (left > 1e-6 && me) {
        const slice = Math.min(MAX_STEP, left);
        stepPlayerMotion(ctx, state, me, input, slice);
        left -= slice;
      }
      glide(dt);
      if (clock - reviveAt > REVIVE_HOLD) reviveIndex = -1;
      poseTimer += dt;
      if (poseTimer < POSE_INTERVAL || !me) return;
      poseTimer = 0;
      link.send(Channel.Pose, encodePose(me, epochs[selfIndex], reviveIndex), link.hostId);
    },
    interact: (target) => send({ a: ActionKind.Interact, k: target.kind, id: Number(target.id) }),
    revive: (targetId) => {
      reviveIndex = state.players.findIndex((p) => p.id === targetId);
      reviveAt = clock;
    },
    flash: (events) => {
      const me = state.players[selfIndex];
      send({ a: ActionKind.Flash });
      if (!me || me.status !== PlayerStatus.Alive || me.flashCooldown > 0 || me.battery < FLASH_COST) return;
      me.flashCooldown = FLASH_COOLDOWN;
      me.battery -= FLASH_COST;
      flashHold = clock + PREDICT_HOLD;
      events.push({ kind: GameEventKind.Flash, player: selfId, x: me.x, z: me.z });
    },
    toggleTorch: () => {
      const me = state.players[selfIndex];
      send({ a: ActionKind.Torch });
      if (!me) return;
      toggleTorch(me);
      torchHold = clock + PREDICT_HOLD;
    },
    dispose: () => link.dispose(),
  };
};
