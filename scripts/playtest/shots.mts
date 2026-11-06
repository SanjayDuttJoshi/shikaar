import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";

/**
 * Quick visual check: opens the built game headless, starts a solo round and saves screenshots.
 * Usage: node scripts/playtest/shots.mts <outDir> [seed] [asylum|haveli] [quality]
 */
const [outDir = ".workshop/shots", seed = "5", building = "asylum", quality = "medium"] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const PORT = 4180;
const server = spawn("node", ["scripts/serve.mts"], { env: { ...process.env, PORT: String(PORT) }, stdio: "ignore" });
await new Promise((r) => setTimeout(r, 800));

const browser = await chromium.launch({
  channel: "chrome",
  args: ["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=default", "--enable-unsafe-swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
await page.addInitScript(([b, q]) => {
  localStorage.setItem("shikaar-settings-v1", JSON.stringify({ name: "Tester", difficulty: "normal", building: b, quality: q, sensitivity: 1, volume: 0.8 }));
}, [building, quality]);
await page.goto(`http://localhost:${PORT}/?debug=1&noclick=1&seed=${seed}`);
await page.waitForTimeout(1500);
await page.screenshot({ path: `${outDir}/00-home.png` });
await page.getByTestId("play-solo").click();
await page.waitForFunction(() => !!window.__shikaar, null, { timeout: 60000 });
await page.waitForTimeout(1500);
await page.screenshot({ path: `${outDir}/01-intro.png` });
await page.waitForTimeout(6000);
const fps = await page.evaluate(() => new Promise<number>((resolve) => {
  let n = 0;
  const t0 = performance.now();
  const step = () => {
    n += 1;
    if (performance.now() - t0 > 2000) resolve((n * 1000) / (performance.now() - t0));
    else requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}));
console.log("fps", fps.toFixed(1));
for (let i = 0; i < 4; i += 1) {
  await page.evaluate((k) => {
    const p = window.__shikaar;
    if (p) p.input.yaw += k === 0 ? 0 : Math.PI / 2;
  }, i);
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${outDir}/02-look-${i}.png` });
}
// Visit a few rooms (teleport) to see furniture, lights, doors.
const rooms = await page.evaluate(() => {
  const p = window.__shikaar;
  if (!p) return [];
  return p.ctx.level.rooms
    .filter((r) => r.kind !== "corridor")
    .slice(0, 6)
    .map((r) => ({ x: (r.rect.x + 0.6) * 3, z: (r.rect.y + 0.6) * 3, kind: r.kind, cx: (r.rect.x + r.rect.w / 2) * 3, cz: (r.rect.y + r.rect.h / 2) * 3 }));
});
for (const [i, r] of rooms.entries()) {
  await page.evaluate((room) => {
    const p = window.__shikaar;
    if (!p) return;
    const me = p.state.players[0];
    me.x = room.x;
    me.z = room.z;
    p.input.yaw = Math.atan2(-(room.cx - room.x), -(room.cz - room.z));
    p.input.pitch = -0.1;
  }, r);
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${outDir}/03-room-${i}-${r.kind}.png` });
}
// Look at the monster from a few metres away.
await page.evaluate(() => {
  const p = window.__shikaar;
  if (!p) return;
  const m = p.state.monsters[0];
  const me = p.state.players[0];
  const nav = p.ctx.nav;
  for (let k = 0; k < 16; k += 1) {
    const a = (k / 16) * Math.PI * 2;
    const x = m.x + Math.sin(a) * 3;
    const z = m.z + Math.cos(a) * 3;
    const idx = Math.floor(z / 0.5) * nav.w + Math.floor(x / 0.5);
    if (!nav.blocked[idx]) {
      me.x = x;
      me.z = z;
      m.yaw = a;
      p.input.yaw = Math.atan2(-(m.x - x), -(m.z - z));
      break;
    }
  }
  p.input.pitch = 0.12;
  me.torchOn = true;
});
await page.waitForTimeout(300);
await page.screenshot({ path: `${outDir}/04-monster.png` });
console.log("errors", errors.length, errors.slice(0, 5));
await browser.close();
server.kill();
