import { describe, expect, it } from "vitest";
import { ItemKind, KeyColor, PropKind, RoomKind, Theme } from "@/types/world";
import type { Level } from "@/types/world";
import { CELL, MAX_PLAYERS, fusesFor } from "@/world/constants";
import { generateLevel } from "@/world/generate-level";
import { boxesOverlap, footprint } from "@/world/geometry";
import { cellOfPoint, levelCell, reachableCells, roomIdAt } from "@/world/level-queries";

const THEMES = [Theme.Asylum, Theme.Haveli];
const SEEDS = Array.from({ length: 40 }, (_, i) => 1000 + i * 7919);

/** Plays the lock-and-key loop: pick up every reachable key until nothing new opens. */
const unlockAll = (level: Level): { keys: Set<KeyColor>; reach: Uint8Array } => {
  const [sx, sy] = cellOfPoint(level.spawns[0].x, level.spawns[0].z);
  const keys = new Set<KeyColor>();
  for (;;) {
    const reach = reachableCells(level, sx, sy, keys);
    const before = keys.size;
    for (const item of level.items) {
      if (item.kind !== ItemKind.Key || item.color === null) continue;
      const [cx, cy] = cellOfPoint(item.x, item.z);
      if (reach[levelCell(level, cx, cy)]) keys.add(item.color);
    }
    if (keys.size === before) return { keys, reach };
  }
};

describe("generateLevel", () => {
  it("is deterministic for a seed", () => {
    const a = generateLevel({ seed: 42, theme: Theme.Asylum, players: 3 });
    const b = generateLevel({ seed: 42, theme: Theme.Asylum, players: 3 });
    expect(JSON.stringify(a.props)).toBe(JSON.stringify(b.props));
    expect(JSON.stringify(a.items)).toBe(JSON.stringify(b.items));
    expect(Array.from(a.edgeX)).toEqual(Array.from(b.edgeX));
  });

  it("grows with the number of players", () => {
    const area = (players: number): number => {
      const level = generateLevel({ seed: 7, theme: Theme.Asylum, players });
      return level.width * level.height;
    };
    expect(area(1)).toBeLessThan(area(4));
    expect(area(4)).toBeLessThan(area(8));
    expect(generateLevel({ seed: 7, theme: Theme.Haveli, players: 8 }).wings.length).toBe(6);
  });

  for (const theme of THEMES) {
    for (const players of [1, 2, 3, 4, 5, 6, 7, 8]) {
      it(`${theme} with ${players} players is always beatable`, () => {
        for (const seed of SEEDS) {
          const level = generateLevel({ seed, theme, players });
          const { keys, reach } = unlockAll(level);
          const locks = new Set(level.wings.map((w) => w.lock).filter((l) => l !== null));
          expect(keys.size, `seed ${seed}: all keys collectable`).toBe(locks.size);
          for (let y = 0; y < level.height; y += 1) {
            for (let x = 0; x < level.width; x += 1) {
              if (roomIdAt(level, x, y) >= 0) expect(reach[levelCell(level, x, y)], `seed ${seed}: cell ${x},${y} reachable`).toBe(1);
            }
          }
          const fuses = level.items.filter((i) => i.kind === ItemKind.Fuse);
          expect(fuses.length, `seed ${seed}: fuses`).toBe(fusesFor(players));
          expect(level.fusesNeeded).toBe(fuses.length);
          const exit = level.doors[level.exitDoorId];
          const inside = roomIdAt(level, exit.cx, exit.cy) >= 0 ? [exit.cx, exit.cy] : exit.vertical ? [exit.cx + 1, exit.cy] : [exit.cx, exit.cy + 1];
          expect(reach[levelCell(level, inside[0], inside[1])]).toBe(1);
          expect(level.props[level.fuseBoxPropId].kind).toBe(PropKind.FuseBox);
          expect(level.monsterSpawns.length).toBeGreaterThan(0);
        }
      });
    }
  }

  it("never puts furniture in a doorway or on top of other furniture", () => {
    for (const theme of THEMES) {
      for (const seed of SEEDS.slice(0, 15)) {
        const level = generateLevel({ seed, theme, players: 6 });
        const solids = level.props.filter((p) => p.solid && p.kind !== PropKind.Pillar);
        for (const door of level.doors) {
          const c = door.vertical ? { x: (door.cx + 1) * CELL, z: (door.cy + 0.5) * CELL } : { x: (door.cx + 0.5) * CELL, z: (door.cy + 1) * CELL };
          for (const p of solids) {
            const box = footprint(p.x, p.z, p.w, p.d, p.yaw);
            const gap = Math.hypot(Math.max(box.minX - c.x, 0, c.x - box.maxX), Math.max(box.minZ - c.z, 0, c.z - box.maxZ));
            expect(gap, `seed ${seed} ${theme}: ${p.kind} near door ${door.id}`).toBeGreaterThan(1.2);
          }
        }
        for (let i = 0; i < solids.length; i += 1) {
          for (let j = i + 1; j < solids.length; j += 1) {
            const a = footprint(solids[i].x, solids[i].z, solids[i].w, solids[i].d, solids[i].yaw);
            const b = footprint(solids[j].x, solids[j].z, solids[j].w, solids[j].d, solids[j].yaw);
            expect(boxesOverlap(a, b), `seed ${seed}: ${solids[i].kind} overlaps ${solids[j].kind}`).toBe(false);
          }
        }
      }
    }
  });

  it("gives every wing hiding spots and the haveli its courtyards", () => {
    for (const seed of SEEDS.slice(0, 10)) {
      const haveli = generateLevel({ seed, theme: Theme.Haveli, players: MAX_PLAYERS });
      expect(haveli.rooms.filter((r) => r.kind === RoomKind.Courtyard).length).toBe(haveli.wings.length);
      for (const theme of THEMES) {
        const level = generateLevel({ seed, theme, players: 4 });
        for (const wing of level.wings) {
          const spots = level.hideSpots.filter((h) => level.rooms[level.props[h.propId].roomId].wing === wing.id);
          expect(spots.length, `seed ${seed} ${theme} wing ${wing.id}`).toBeGreaterThanOrEqual(2);
        }
      }
    }
  });
});
