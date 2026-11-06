import { SRC } from "./load-src.mts";

/** Prints a level as ASCII: `node scripts/dump-level.mts <seed> <asylum|haveli> <players>`. */
const [seedArg = "1", themeArg = "asylum", playersArg = "2"] = process.argv.slice(2);
const { generateLevel } = await SRC.import<typeof import("../src/world/generate-level.ts")>("@/world/generate-level");
const level = generateLevel({ seed: Number(seedArg), theme: themeArg as never, players: Number(playersArg) });
const CELL = 3;
const W = level.width * 2 + 1;
const H = level.height * 2 + 1;
const grid: string[][] = Array.from({ length: H }, () => Array.from({ length: W }, () => " "));
const KIND = ["?", ".", ":", "~"];
const LOCK = "RBGYP";
for (let y = 0; y < level.height; y += 1) {
  for (let x = 0; x < level.width; x += 1) {
    const i = y * level.width + x;
    const room = level.roomOf[i];
    grid[y * 2 + 1][x * 2 + 1] = room < 0 ? " " : KIND[level.kindOf[i]];
    const right = x + 1 < level.width ? level.roomOf[i + 1] : -1;
    const down = y + 1 < level.height ? level.roomOf[i + level.width] : -1;
    if (room >= 0 || right >= 0) {
      const e = level.edgeX[i];
      const door = level.doorX[i] >= 0 ? level.doors[level.doorX[i]] : null;
      grid[y * 2 + 1][x * 2 + 2] = e === 1 ? "|" : e === 2 ? (door?.kind === "main-gate" ? "E" : door?.lock != null ? LOCK[door.lock] : "d") : KIND[level.kindOf[i]];
    }
    if (room >= 0 || down >= 0) {
      const e = level.edgeY[i];
      const door = level.doorY[i] >= 0 ? level.doors[level.doorY[i]] : null;
      grid[y * 2 + 2][x * 2 + 1] = e === 1 ? "-" : e === 2 ? (door?.kind === "main-gate" ? "E" : door?.lock != null ? LOCK[door.lock] : "d") : KIND[level.kindOf[i]];
    }
    if (room >= 0) grid[y * 2 + 2][x * 2 + 2] = "+";
  }
}
const mark = (x: number, z: number, ch: string): void => {
  grid[Math.floor(z / CELL) * 2 + 1][Math.floor(x / CELL) * 2 + 1] = ch;
};
for (const it of level.items) mark(it.x, it.z, it.kind === "key" ? LOCK[it.color ?? 0].toLowerCase() : it.kind === "fuse" ? "F" : it.kind === "battery" ? "b" : "m");
for (const m of level.monsterSpawns) mark(m.x, m.z, "X");
mark(level.spawns[0].x, level.spawns[0].z, "S");
console.log(grid.map((r) => r.join("")).join("\n"));
console.log(`\n${level.width}x${level.height} cells (${level.width * CELL}m x ${level.height * CELL}m), rooms ${level.rooms.length}, doors ${level.doors.length}, props ${level.props.length}, hide ${level.hideSpots.length}, lights ${level.lights.length} (${level.lights.filter((l) => !l.dead).length} on), items ${level.items.length}, fuses ${level.fusesNeeded}, monsters ${level.monsterSpawns.length}`);
console.log("wings", level.wings.map((w) => `${w.id}:depth${w.depth}${w.lock === null ? "" : ":" + LOCK[w.lock]}`).join(" "));
