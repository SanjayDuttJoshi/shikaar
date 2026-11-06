import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";
import type { Page } from "@playwright/test";

/**
 * Screenshots of every scripted scare and of each monster, for review and the showcase folder.
 * Usage: node scripts/playtest/scares.mts <outDir>
 */
const [outDir = ".workshop/scares"] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const PORT = 4270;
const server = spawn("node", ["scripts/serve.mts"], { env: { ...process.env, PORT: String(PORT) }, stdio: "ignore" });
await new Promise((r) => setTimeout(r, 800));
const browser = await chromium.launch({ channel: "chrome", args: ["--enable-gpu", "--ignore-gpu-blocklist"] });
const errors: string[] = [];

const open = async (building: string, seed: number): Promise<Page> => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.addInitScript((b) => {
    localStorage.setItem("shikaar-settings-v1", JSON.stringify({ name: "Raju", difficulty: "normal", building: b, quality: "high", sensitivity: 1, volume: 0.8, brightness: 1.3 }));
  }, building);
  await page.goto(`http://localhost:${PORT}/?debug=1&noclick=1&seed=${seed}`);
  await page.getByTestId("play-solo").click();
  await page.waitForFunction(() => !!window.__shikaar, null, { timeout: 60000 });
  await page.evaluate(() => {
    const p = window.__shikaar;
    if (!p) return;
    p.state.phaseTimer = 0;
    for (const m of p.state.monsters) {
      m.mode = "stunned" as never;
      m.timer = 9999;
      m.x = -80;
      m.z = -80;
    }
  });
  await page.waitForTimeout(1500);
  return page;
};

const shot = async (page: Page, name: string, wait = 700): Promise<void> => {
  await page.waitForTimeout(wait);
  await page.screenshot({ path: `${outDir}/${name}.png` });
  console.log("shot", name);
};

/** Walks up to the first scare of a kind: one shot from a distance, one right after it fires. */
const scare = async (page: Page, kind: string, name: string, far: number, near: number, afterMs: number): Promise<void> => {
  const ok = await page.evaluate(
    ([k, f]) => {
      const p = window.__shikaar;
      const sp = p?.ctx.level.setPieces.find((s) => s.kind === k);
      if (!p || !sp) return false;
      return p.placeNear?.({ x: sp.x, z: sp.z }, Number(f), sp.kind === "cat" ? 0.35 : sp.kind === "falling-body" ? 0.25 : -0.12, sp.kind !== "cat") ?? false;
    },
    [kind, String(far)],
  );
  if (!ok) {
    console.log("skip", kind);
    return;
  }
  await shot(page, `${name}-pehle`, 900);
  await page.evaluate(
    ([k, n]) => {
      const p = window.__shikaar;
      const sp = p?.ctx.level.setPieces.find((s) => s.kind === k);
      if (!p || !sp) return;
      p.placeNear?.({ x: sp.x, z: sp.z }, Number(n), sp.kind === "cat" ? 0.3 : sp.kind === "falling-body" ? 0.3 : -0.1, sp.kind !== "cat");
    },
    [kind, String(near)],
  );
  await shot(page, `${name}-baad`, afterMs);
};

/** Stands in the corridor 3.5 m from the drop point, looking along the corridor at it, then lets it drop. */
const bodyDrop = async (page: Page, name: string): Promise<void> => {
  const ok = await page.evaluate(() => {
    const p = window.__shikaar;
    const sp = p?.ctx.level.setPieces.find((s) => s.kind === "falling-body");
    if (!p || !sp) return false;
    const room = p.ctx.level.rooms[sp.roomId];
    const alongX = room.rect.w >= room.rect.h;
    const me = p.state.players[0];
    for (const sign of [1, -1]) {
      const spot = alongX ? { x: sp.x + sign * 3.6, z: sp.z } : { x: sp.x, z: sp.z + sign * 3.6 };
      const idx = Math.floor(spot.z / 0.5) * p.ctx.nav.w + Math.floor(spot.x / 0.5);
      if (p.ctx.nav.blocked[idx]) continue;
      me.x = spot.x;
      me.z = spot.z;
      p.input.yaw = Math.atan2(-(sp.x - spot.x), -(sp.z - spot.z));
      p.input.pitch = 0.22;
      return true;
    }
    return false;
  });
  if (!ok) {
    console.log("skip body");
    return;
  }
  await shot(page, `${name}-baad`, 1400);
};

/** Puts a monster 3.5 m in front of the player in its own wing, facing them, mid-stride. */
const monster = async (page: Page, kind: string, name: string): Promise<void> => {
  await page.evaluate((k) => {
    const p = window.__shikaar;
    if (!p) return;
    const idx = p.ctx.level.monsterSpawns.findIndex((s) => s.kind === k);
    if (idx < 0) return;
    const spawn = p.ctx.level.monsterSpawns[idx];
    const m = p.state.monsters[idx];
    p.placeNear?.(spawn, 3.6, 0.12);
    const me = p.state.players[0];
    m.x = spawn.x;
    m.z = spawn.z;
    m.mode = "attack" as never;
    m.timer = 9999;
    m.target = me.id;
    m.yaw = Math.atan2(me.x - spawn.x, me.z - spawn.z);
    me.torchOn = true;
  }, kind);
  await shot(page, name, 1400);
};

const asylum = await open("asylum", 21);
await monster(asylum, "shikari", "01-shikari-chowkidar");
await monster(asylum, "mareez", "02-andha-mareez");
await bodyDrop(asylum, "03-laash-girti");
await scare(asylum, "crying-figure", "04-kone-mein-rota-mareez", 4.5, 2.6, 450);
await scare(asylum, "cat", "05-billi", 4.5, 2.4, 350);
await scare(asylum, "radio", "06-radio", 4, 2.5, 800);
await asylum.close();

const haveli = await open("haveli", 8);
await monster(haveli, "chudail", "07-chudail");
await monster(haveli, "shikari", "08-shikari-haveli");
await scare(haveli, "crying-figure", "09-kone-mein-roti-aurat", 4.5, 2.6, 450);
await scare(haveli, "rooster", "10-murga", 4.5, 2.8, 350);
await scare(haveli, "rocking-chair", "11-rocking-chair", 4, 3, 1500);
await bodyDrop(haveli, "12-haveli-laash");
await scare(haveli, "cat", "13-haveli-billi", 4.5, 2.4, 350);
await haveli.close();

console.log("errors", errors);
await browser.close();
server.kill();
