import { describe, expect, it } from "vitest";
import { Difficulty, GameEventKind, InteractKind, MonsterMode, PlayerStatus, RoundPhase, Stance } from "@/types/game";
import type { GameEvent } from "@/types/game";
import { ItemKind, MonsterKind, SetPieceKind, Theme } from "@/types/world";
import { STORY_ENVELOPES, monsterPlan } from "@/world/constants";
import { TICK_DT } from "@/game/constants";
import { createGameContext, createWorldState } from "@/game/context";
import { applyInteract } from "@/game/interact";
import { STARE_LIMIT } from "@/game/monster-kinds";
import { monsterSees } from "@/game/monster-ai";
import { nearestOpen } from "@/game/nav";
import { hostStep } from "@/game/round";
import { generateLevel } from "@/world/generate-level";
import { FILMS } from "@/content/films";
import { subtitleFor, voicePath } from "@/lib/voice";
import { Language } from "@/types/ui";
import { KEY_PRESETS, rebind } from "@/lib/key-bindings";
import { ControlPreset, KeyAction } from "@/types/ui";

const setup = (theme: Theme, players = 1, seed = 13) => {
  const level = generateLevel({ seed, theme, players });
  const ctx = createGameContext(level, seed + 5);
  const state = createWorldState(
    level,
    Array.from({ length: players }, (_, i) => ({ id: `p${i}`, name: `P${i}`, color: i })),
    Difficulty.Normal,
  );
  state.phase = RoundPhase.Playing;
  state.time = 120;
  return { level, ctx, state };
};

/** Puts player 0 in open floor `d` metres in front of monster `i`, the monster facing them. */
const faceOff = (s: ReturnType<typeof setup>, i: number, d: number): void => {
  const m = s.state.monsters[i];
  const p = s.state.players[0];
  for (let k = 0; k < 24; k += 1) {
    const a = (k / 24) * Math.PI * 2;
    const spot = { x: m.x + Math.sin(a) * d, z: m.z + Math.cos(a) * d };
    const idx = nearestOpen(s.ctx.nav, spot);
    const open = { x: ((idx % s.ctx.nav.w) + 0.5) * 0.5, z: (Math.floor(idx / s.ctx.nav.w) + 0.5) * 0.5 };
    if (Math.abs(Math.hypot(open.x - m.x, open.z - m.z) - d) > 0.6) continue;
    p.x = open.x;
    p.z = open.z;
    m.yaw = Math.atan2(p.x - m.x, p.z - m.z);
    p.yaw = Math.atan2(-(m.x - p.x), -(m.z - p.z));
    if (monsterSees(s.ctx, s.state, { ...m, kind: MonsterKind.Shikari }, p)) return;
  }
};

describe("monster roster", () => {
  it("never leaves you with just one monster, and guardians own a wing", () => {
    expect(monsterPlan(1, Theme.Asylum)).toEqual([MonsterKind.Shikari, MonsterKind.Mareez]);
    expect(monsterPlan(4, Theme.Haveli)).toEqual([MonsterKind.Shikari, MonsterKind.Chudail, MonsterKind.Chudail]);
    expect(monsterPlan(8, Theme.Asylum).length).toBe(4);
    for (const theme of [Theme.Asylum, Theme.Haveli]) {
      for (const players of [1, 4, 8]) {
        const level = generateLevel({ seed: 99, theme, players });
        expect(level.monsterSpawns.length).toBe(monsterPlan(players, theme).length);
        for (const m of level.monsterSpawns) {
          if (m.kind === MonsterKind.Shikari) expect(m.wing).toBe(-1);
          else {
            expect(m.wing).toBeGreaterThanOrEqual(0);
            const room = level.rooms[level.roomOf[Math.floor(m.z / 3) * level.width + Math.floor(m.x / 3)]];
            expect(room.wing).toBe(m.wing);
          }
        }
      }
    }
  });

  it("Andha Mareez can't see you, but hears you run", () => {
    const s = setup(Theme.Asylum);
    const idx = s.state.monsters.findIndex((m) => m.kind === MonsterKind.Mareez);
    faceOff(s, idx, 5);
    const m = s.state.monsters[idx];
    const p = s.state.players[0];
    p.torchOn = true;
    expect(monsterSees(s.ctx, s.state, m, p)).toBe(false);
    p.noise = 13;
    p.stance = Stance.Sprint;
    s.state.monsters.forEach((o, i) => {
      if (i !== idx) o.x = -200;
    });
    const events: GameEvent[] = [];
    hostStep(s.ctx, s.state, TICK_DT, events);
    expect(m.mode).toBe(MonsterMode.Chase);
  });

  it("the Chudail shrieks and rages if you hold her in your torchlight", () => {
    const s = setup(Theme.Haveli);
    const idx = s.state.monsters.findIndex((m) => m.kind === MonsterKind.Chudail);
    s.state.monsters.forEach((o, i) => {
      if (i !== idx) o.x = -200;
    });
    faceOff(s, idx, 9);
    const m = s.state.monsters[idx];
    m.yaw += Math.PI;
    m.mode = MonsterMode.Patrol;
    m.timer = 30;
    m.path = [];
    const p = s.state.players[0];
    p.torchOn = true;
    const events: GameEvent[] = [];
    for (let t = 0; t < (STARE_LIMIT + 0.3) / TICK_DT; t += 1) {
      p.noise = 0;
      hostStep(s.ctx, s.state, TICK_DT, events);
    }
    expect(events.map((e) => e.kind)).toContain(GameEventKind.MonsterScream);
    expect(m.rage).toBeGreaterThan(0);
  });
});

describe("set pieces and story", () => {
  it("every building gets scares in every wing and all story pages", () => {
    for (const theme of [Theme.Asylum, Theme.Haveli]) {
      for (const seed of [1, 2, 3, 4, 5]) {
        const level = generateLevel({ seed, theme, players: 3 });
        const crying = level.setPieces.filter((p) => p.kind === SetPieceKind.CryingFigure);
        expect(crying.length, `${theme} ${seed}`).toBeGreaterThanOrEqual(level.wings.length - 1);
        expect(level.setPieces.some((p) => p.kind === SetPieceKind.FallingBody)).toBe(true);
        expect(level.setPieces.some((p) => p.kind === SetPieceKind.Cat)).toBe(true);
        const envelopes = level.items.filter((i) => i.kind === ItemKind.Envelope);
        expect(envelopes.length).toBe(STORY_ENVELOPES);
        expect(FILMS[theme].length).toBe(STORY_ENVELOPES);
      }
    }
  });

  it("a scare fires once when you walk up to it", () => {
    const s = setup(Theme.Haveli, 1, 21);
    s.state.monsters.length = 0;
    const id = s.level.setPieces.findIndex((p) => p.kind === SetPieceKind.CryingFigure);
    const piece = s.level.setPieces[id];
    const p = s.state.players[0];
    const idx = nearestOpen(s.ctx.nav, { x: piece.x + Math.sin(piece.yaw + Math.PI) * 1.8, z: piece.z + Math.cos(piece.yaw + Math.PI) * 1.8 });
    p.x = ((idx % s.ctx.nav.w) + 0.5) * 0.5;
    p.z = (Math.floor(idx / s.ctx.nav.w) + 0.5) * 0.5;
    const events: GameEvent[] = [];
    for (let t = 0; t < 30; t += 1) hostStep(s.ctx, s.state, TICK_DT, events);
    expect(events.filter((e) => e.kind === GameEventKind.SetPiece && e.setPiece === id).length).toBe(1);
    expect(s.state.setPieces[id].fired).toBe(true);
  });

  it("the cat on a cupboard jumps when you walk close, even though the cupboard blocks sight", () => {
    const s = setup(Theme.Asylum, 1, 21);
    s.state.monsters.length = 0;
    const id = s.level.setPieces.findIndex((p) => p.kind === SetPieceKind.Cat);
    if (id < 0) return;
    const cat = s.level.setPieces[id];
    const idx = nearestOpen(s.ctx.nav, { x: cat.x + Math.sin(cat.yaw) * 1.6, z: cat.z + Math.cos(cat.yaw) * 1.6 });
    const p = s.state.players[0];
    p.x = ((idx % s.ctx.nav.w) + 0.5) * 0.5;
    p.z = (Math.floor(idx / s.ctx.nav.w) + 0.5) * 0.5;
    const events: GameEvent[] = [];
    for (let t = 0; t < 10; t += 1) hostStep(s.ctx, s.state, TICK_DT, events);
    expect(s.state.setPieces[id].fired).toBe(true);
  });

  it("envelopes unlock the story films in order, whichever one you open", () => {
    const s = setup(Theme.Asylum);
    const ids = s.level.items.map((it, i) => ({ it, i })).filter(({ it }) => it.kind === ItemKind.Envelope).map(({ i }) => i);
    const p = s.state.players[0];
    const events: GameEvent[] = [];
    for (const id of [...ids].reverse()) {
      p.x = s.level.items[id].x;
      p.z = s.level.items[id].z;
      applyInteract(s.ctx, s.state, p.id, { kind: InteractKind.PickUp, id, label: "", holdSeconds: 0 }, events);
    }
    expect(s.state.notesFound).toEqual([0, 1, 2, 3]);
    expect(events.filter((e) => e.kind === GameEventKind.EnvelopeOpened).map((e) => e.note)).toEqual([0, 1, 2, 3]);
    expect(p.status).toBe(PlayerStatus.Alive);
  });

  it("every film line and monster line exists in Hindi and English", () => {
    for (const theme of [Theme.Asylum, Theme.Haveli]) {
      for (const film of FILMS[theme]) {
        for (const shot of film.shots) {
          expect(subtitleFor(shot.line, Language.Hindi), shot.line).not.toBe("");
          expect(subtitleFor(shot.line, Language.English), shot.line).not.toBe("");
          expect(voicePath(shot.line, Language.English)).toBe(`voice/en/${shot.line}.mp3`);
        }
      }
    }
  });
});

describe("key bindings", () => {
  it("rebinding moves a key off its old action", () => {
    const keys = rebind(KEY_PRESETS[ControlPreset.Wasd], KeyAction.Torch, 0, "KeyE");
    expect(keys[KeyAction.Torch][0]).toBe("KeyE");
    expect(keys[KeyAction.Use]).not.toContain("KeyE");
    const cleared = rebind(keys, KeyAction.Forward, 1, null);
    expect(cleared[KeyAction.Forward]).toEqual(["KeyW"]);
  });
});
