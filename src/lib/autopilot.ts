import { InteractKind, MonsterMode, PlayerStatus, RoundPhase } from "@/types/game";
import type { PlayerState, WorldState } from "@/types/game";
import { DoorKind, ItemKind } from "@/types/world";
import type { Vec2 } from "@/types/world";
import type { InputState } from "@/client/input-state";
import { FLASH_COST } from "@/game/constants";
import type { GameContext } from "@/game/context";
import { doorGap, doorPanelBox, sightBlocked } from "@/game/collision";
import { doorOpenness } from "@/game/context";
import { hideSpotFront } from "@/game/hiding";
import { findInteractTarget } from "@/game/interact";
import { findPath, walkable } from "@/game/nav";
import type { NavGrid } from "@/game/nav";
import { CELL, NAV_RES } from "@/world/constants";
import { doorCenter } from "@/world/geometry";

const TICK_MS = 100;
const ARRIVE = 0.7;
const REPLAN_SECONDS = 1.5;
const FLEE_RANGE = 11;
/** Envelopes are worth a detour only when the walk (not the straight line through a wall) is short. */
const ENVELOPE_WALK = 10;
/** A goal not reached in this long is skipped for a while (no circling around one spot). */
const GIVE_UP_SECONDS = 25;
const SKIP_SECONDS = 40;
/** A downed friend this far away (walking) is worth running to. */
const REVIVE_WALK = 45;
/** With nothing left to fetch, stay this close to a friend instead of standing alone. */
const FOLLOW_GAP = 3;

/**
 * Test player for automated playtests and trailer recording (?debug=1&autopilot=1).
 * Collects keys and fuses, opens doors, flashes and runs from the Shikari, then escapes.
 */
export interface Autopilot {
  stop: () => void;
  /** Latest decision, for logs. */
  status: () => string;
}

const dist = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.z - b.z);

/** Walking distance along a route. */
const walkLength = (from: Vec2, route: Vec2[]): number => route.reduce((sum, q, i) => sum + dist(i === 0 ? from : route[i - 1], q), 0);

/** Player nav: like the monster's, but doors we can't open count as walls. */
const playerNav = (ctx: GameContext, state: WorldState): NavGrid => {
  const blocked = ctx.nav.blocked.slice();
  ctx.level.doors.forEach((door, id) => {
    const ds = state.doors[id];
    const usable = door.kind === DoorKind.MainGate ? state.gateOpen : !ds.locked || (door.lock !== null && state.keys.includes(door.lock));
    if (usable) return;
    const box = doorPanelBox(door);
    const pad = doorGap(door.kind) * 0.1 + NAV_RES;
    for (let z = box.minZ - pad; z <= box.maxZ + pad; z += NAV_RES / 2) {
      for (let x = box.minX - pad; x <= box.maxX + pad; x += NAV_RES / 2) {
        const i = Math.floor(z / NAV_RES) * ctx.nav.w + Math.floor(x / NAV_RES);
        if (i >= 0 && i < blocked.length) blocked[i] = 1;
      }
    }
  });
  return { w: ctx.nav.w, h: ctx.nav.h, blocked };
};

const outsideOfGate = (ctx: GameContext): Vec2 => {
  const gate = ctx.level.doors[ctx.level.exitDoorId];
  const lv = ctx.level;
  const aInside = lv.roomOf[gate.cy * lv.width + gate.cx] >= 0;
  return gate.vertical
    ? { x: (gate.cx + (aInside ? 1.7 : 0.3)) * CELL, z: (gate.cy + 0.5) * CELL }
    : { x: (gate.cx + 0.5) * CELL, z: (gate.cy + (aInside ? 1.7 : 0.3)) * CELL };
};

export interface AutopilotHooks {
  /** Stand still (a recording script is showing something). */
  hold: () => boolean;
  /** A story film is offered or playing: the autopilot keeps playing the round instead (Later / skip). */
  inFilm: () => boolean;
}

const NO_HOOKS: AutopilotHooks = { hold: () => false, inFilm: () => false };

export const startAutopilot = (ctx: GameContext, state: WorldState, input: InputState, selfId: string, hooks: AutopilotHooks = NO_HOOKS): Autopilot => {
  let path: Vec2[] = [];
  let goal: Vec2 | null = null;
  let goalKind = "";
  let replanIn = 0;
  let lastPos: Vec2 = { x: 0, z: 0 };
  let stuckFor = 0;
  let pressCooldown = 0;
  let note = "start";
  let hiddenFor = 0;
  let hideCooldown = 0;
  /** Item this autopilot committed to (-1 none), how long it has been at it, and items it gave up on (until when). */
  /** Backing off a wall corner: how long it still lasts and to which side. */
  let unstickFor = 0;
  let unstickSide = 1;
  let goalItem = -1;
  let goalFor = 0;
  const skipped = new Map<number, number>();
  const me = (): PlayerState | undefined => state.players.find((p) => p.id === selfId);

  const press = (): void => {
    if (pressCooldown > 0) return;
    input.interactPressed = true;
    pressCooldown = 0.6;
  };

  const chooseGoal = (p: PlayerState, nav: NavGrid): { at: Vec2; kind: string } | null => {
    const chosen = goalItem;
    goalItem = -1;
    // A friend on the floor comes first: that's what a real squad does.
    const downed = state.players
      .filter((q) => q.id !== selfId && q.status === PlayerStatus.Downed)
      .map((q) => {
        const route = findPath(nav, p, q);
        return { q, walk: route.length > 0 ? walkLength(p, route) : dist(p, q) < 2 ? 0 : Number.POSITIVE_INFINITY };
      })
      .filter((c) => c.walk < REVIVE_WALK)
      .sort((a, b) => a.walk - b.walk)[0];
    if (downed) return { at: { x: downed.q.x, z: downed.q.z }, kind: "revive" };
    if (state.gateOpen) return { at: outsideOfGate(ctx), kind: "exit" };
    const box = ctx.level.props[ctx.level.fuseBoxPropId];
    const boxFront = { x: box.x + Math.sin(box.yaw) * 0.9, z: box.z + Math.cos(box.yaw) * 0.9 };
    if (p.carrying >= 0) return { at: boxFront, kind: "fuse-box" };
    if (state.powerOn) return { at: boxFront, kind: "wait" };
    const now = state.time;
    // Stay on the item already chosen while it's still there and reachable: switching back and forth
    // between two goals is how autopilots ended up circling one spot.
    const kept = chosen >= 0 ? state.items[chosen] : undefined;
    if (kept && !kept.taken && (skipped.get(chosen) ?? 0) <= now && findPath(nav, p, kept).length > 0) {
      goalItem = chosen;
      return { at: { x: kept.x, z: kept.z }, kind: ctx.level.items[chosen].kind };
    }
    const candidates = ctx.level.items
      .map((it, id) => ({ it, id, s: state.items[id] }))
      .filter(
        ({ it, id, s }) =>
          !s.taken &&
          (skipped.get(id) ?? 0) <= now &&
          (it.kind === ItemKind.Key || it.kind === ItemKind.Fuse || (it.kind === ItemKind.Battery && p.battery < 50) || (it.kind === ItemKind.Envelope && dist(p, s) < ENVELOPE_WALK)),
      )
      .map((c) => {
        const route = findPath(nav, p, c.s);
        return { ...c, route, walk: walkLength(p, route) };
      })
      .filter((c) => c.route.length > 0 && (c.it.kind !== ItemKind.Envelope || c.walk < ENVELOPE_WALK))
      .sort((a, b) => {
        const rank = (k: ItemKind): number => (k === ItemKind.Envelope ? 0 : k === ItemKind.Key ? 1 : k === ItemKind.Battery ? 2 : 3);
        return rank(a.it.kind) - rank(b.it.kind) || a.walk - b.walk;
      });
    // In a squad each autopilot takes a different item (by its place in the squad), so friends spread out
    // like real players instead of walking in one clump.
    const seat = Math.max(0, state.players.findIndex((q) => q.id === selfId));
    const best = candidates[seat % Math.max(1, candidates.length)];
    if (best) {
      if (best.id !== chosen) goalFor = 0;
      goalItem = best.id;
      return { at: { x: best.s.x, z: best.s.z }, kind: best.it.kind };
    }
    const locked = ctx.level.doors
      .map((d, id) => ({ d, id }))
      .filter(({ d, id }) => state.doors[id].locked && d.lock !== null && state.keys.includes(d.lock))
      .map(({ d }) => doorCenter(d))
      .sort((a, b) => dist(p, a) - dist(p, b))[0];
    if (locked) return { at: locked, kind: "locked-door" };
    // Nothing to fetch: walk with the nearest friend still inside rather than standing alone.
    const friend = state.players
      .filter((q) => q.id !== selfId && (q.status === PlayerStatus.Alive || q.status === PlayerStatus.Hiding))
      .sort((a, b) => dist(p, a) - dist(p, b))[0];
    return friend && dist(p, friend) > FOLLOW_GAP ? { at: { x: friend.x, z: friend.z }, kind: "follow" } : null;
  };

  const tick = (): void => {
    const p = me();
    pressCooldown = Math.max(0, pressCooldown - TICK_MS / 1000);
    if (!p || state.phase === RoundPhase.Intro || state.phase === RoundPhase.Ended) return;
    if (hooks.inFilm()) {
      // Squad rounds don't wait: say "baad mein" to the film (Flash = later / skip).
      input.flashPressed = true;
      note = "skip-film";
      return;
    }
    if (hooks.hold()) {
      input.moveX = 0;
      input.moveZ = 0;
      input.sprint = false;
      input.interactHeld = false;
      note = "hold";
      return;
    }
    if (p.status === PlayerStatus.Hiding) {
      hiddenFor += TICK_MS / 1000;
      const nearest = Math.min(...state.monsters.map((m) => dist(m, p)));
      if (hiddenFor > 4 && (nearest > 14 || hiddenFor > 14)) {
        press();
        hiddenFor = 0;
        hideCooldown = 10;
        note = "unhide";
      } else note = "hiding";
      return;
    }
    if (p.status !== PlayerStatus.Alive) {
      input.moveZ = 0;
      return;
    }
    const nav = playerNav(ctx, state);
    const hunter = state.monsters
      .filter(
        (m) =>
          m.mode !== MonsterMode.Stunned &&
          ((m.target === selfId && (m.mode === MonsterMode.Chase || m.mode === MonsterMode.Attack || m.mode === MonsterMode.Recover)) || dist(m, p) < 7),
      )
      .sort((a, b) => dist(a, p) - dist(b, p))[0];
    input.sprint = false;
    const unseen = hunter ? sightBlocked(ctx.world, hunter, p, doorOpenness(state)) : false;
    hideCooldown = Math.max(0, hideCooldown - TICK_MS / 1000);
    const spot = hunter && unseen && hideCooldown <= 0 && hunter.mode === MonsterMode.Chase && dist(hunter, p) > 4
      ? ctx.level.hideSpots
          .filter((h) => !state.players.some((o) => o.hideSpot === h.id))
          .map((h) => ({ h, front: hideSpotFront(ctx.level, h) }))
          .filter((c) => dist(c.front, p) < 5)
          .sort((a, b) => dist(a.front, p) - dist(b.front, p))[0]
      : undefined;
    if (spot) {
      goal = spot.front;
      goalKind = "hide";
      path = findPath(nav, p, spot.front);
      const target = findInteractTarget(ctx, state, p);
      if (target.kind === InteractKind.Hide) {
        input.moveZ = 0;
        press();
        hiddenFor = 0;
        note = "hide";
        return;
      }
      input.sprint = true;
      note = "to-hide";
    } else if (hunter && dist(hunter, p) < FLEE_RANGE) {
      if (dist(hunter, p) < 7 && p.flashCooldown <= 0 && p.battery > FLASH_COST + 5 && hunter.stunImmunity <= 0) {
        input.yaw = Math.atan2(-(hunter.x - p.x), -(hunter.z - p.z));
        input.flashPressed = true;
        note = "flash";
        return;
      }
      if (goalKind !== "flee" || replanIn <= 0) {
        let best: Vec2 | null = null;
        for (let k = 0; k < 12; k += 1) {
          const a = (k / 12) * Math.PI * 2;
          const q = { x: p.x + Math.sin(a) * 14, z: p.z + Math.cos(a) * 14 };
          const r = findPath(nav, p, q);
          if (r.length === 0) continue;
          const end = r[r.length - 1];
          if (!best || dist(end, hunter) > dist(best, hunter)) best = end;
        }
        if (best) {
          goal = best;
          goalKind = "flee";
          path = findPath(nav, p, best);
          replanIn = 1.2;
        }
      }
      input.sprint = true;
      note = "flee";
    } else if (replanIn <= 0 || !goal || goalKind === "flee") {
      const next = chooseGoal(p, nav);
      goal = next?.at ?? null;
      goalKind = next?.kind ?? "idle";
      path = goal ? findPath(nav, p, goal) : [];
      replanIn = REPLAN_SECONDS;
      note = goalKind;
    }
    replanIn -= TICK_MS / 1000;
    if (goalItem >= 0 && goalKind !== "flee" && goalKind !== "hide") {
      goalFor += TICK_MS / 1000;
      if (goalFor > GIVE_UP_SECONDS) {
        skipped.set(goalItem, state.time + SKIP_SECONDS);
        goalItem = -1;
        goalFor = 0;
        replanIn = 0;
        note = "give-up";
      }
    }

    const target = findInteractTarget(ctx, state, p);
    input.interactHeld = goalKind === "revive" && target.kind === InteractKind.Revive;
    if (input.interactHeld) {
      input.moveZ = 0;
      input.moveX = 0;
      input.yaw = goal ? Math.atan2(-(goal.x - p.x), -(goal.z - p.z)) : input.yaw;
      input.pitch = -0.5;
      note = "reviving";
      replanIn = Math.min(replanIn, 0.5);
      return;
    }
    if (target.kind === InteractKind.Door && state.doors[Number(target.id)].open < 0.5) press();
    if (target.kind === InteractKind.LockedDoor && target.label.includes("kholo")) press();
    if (target.kind === InteractKind.PickUp && goal && dist(p, goal) < 2) press();
    if (target.kind === InteractKind.FuseBox && p.carrying >= 0) press();

    // Walking into a wall corner or a prop: back off to one side for a moment, then plan again.
    if (unstickFor > 0) {
      unstickFor -= TICK_MS / 1000;
      input.moveZ = -0.7;
      input.moveX = unstickSide;
      lastPos = { x: p.x, z: p.z };
      return;
    }
    const moved = dist(p, lastPos);
    lastPos = { x: p.x, z: p.z };
    stuckFor = input.moveZ > 0.2 && moved < 0.04 ? stuckFor + TICK_MS / 1000 : 0;
    if (stuckFor > 1.2) {
      if (target.kind === InteractKind.Door) press();
      unstickFor = 0.5 + Math.random() * 0.5;
      unstickSide = Math.random() < 0.5 ? -1 : 1;
      stuckFor = 0;
      replanIn = 0;
      path = [];
      note = "unstick";
      return;
    }
    while (path.length > 0 && dist(p, path[0]) < ARRIVE) path.shift();
    const next = path[0] ?? goal;
    if (!next) {
      input.moveZ = 0;
      input.moveX = 0;
      return;
    }
    if (goalKind === "follow" && goal && dist(p, goal) < FOLLOW_GAP) {
      input.moveZ = 0;
      input.moveX = 0;
      replanIn = Math.min(replanIn, 0.5);
      return;
    }
    if (goal && dist(p, goal) < 1.4 && goalKind !== "exit" && goalKind !== "flee" && goalKind !== "hide") {
      input.moveZ = dist(p, goal) > 0.9 ? 0.4 : 0;
      input.yaw = Math.atan2(-(goal.x - p.x), -(goal.z - p.z));
      input.pitch = -0.5;
      if (target.kind === InteractKind.PickUp || target.kind === InteractKind.FuseBox || target.kind === InteractKind.LockedDoor) press();
      replanIn = Math.min(replanIn, 0.4);
      return;
    }
    input.yaw = Math.atan2(-(next.x - p.x), -(next.z - p.z));
    input.pitch = 0;
    input.moveZ = 1;
    input.moveX = 0;
    if (!walkable(nav, p, next)) replanIn = 0;
  };

  const timer = window.setInterval(tick, TICK_MS);
  return {
    stop: () => window.clearInterval(timer),
    status: () => `${note}${goal ? ` → ${goal.x.toFixed(1)},${goal.z.toFixed(1)}` : ""}`,
  };
};

