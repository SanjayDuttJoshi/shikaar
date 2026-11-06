import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";

/**
 * Lets the autopilot play a full solo round and reports what happened.
 * Usage: node scripts/playtest/autoplay.mts <outDir> <seed> <asylum|haveli> <difficulty> [record] [minutes]
 */
const [outDir = ".workshop/autoplay", seed = "5", building = "asylum", difficulty = "normal", record = "", minutes = "12"] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const PORT = 4190 + Math.floor(Math.random() * 50);
const server = spawn("node", ["scripts/serve.mts"], { env: { ...process.env, PORT: String(PORT) }, stdio: "ignore" });
await new Promise((r) => setTimeout(r, 800));
const browser = await chromium.launch({ channel: "chrome", args: ["--enable-gpu", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"] });
const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  ...(record ? { recordVideo: { dir: outDir, size: { width: 1280, height: 720 } } } : {}),
});
const page = await context.newPage();
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => {
  if (m.type() === "error" && !m.text().includes("404")) errors.push(m.text());
});
await page.addInitScript(([b, d]) => {
  localStorage.setItem("shikaar-settings-v1", JSON.stringify({ name: "Bot", difficulty: d, building: b, quality: "medium", sensitivity: 1, volume: 0.8 }));
}, [building, difficulty]);
const videoStart = Date.now();
await page.goto(`http://localhost:${PORT}/?debug=1&noclick=1&autopilot=1&recordaudio=${record ? 1 : 0}&seed=${seed}`);
await page.getByTestId("play-solo").click();
await page.waitForFunction(() => !!window.__shikaar, null, { timeout: 60000 });
const t0 = Date.now();
writeFileSync(`${outDir}/round-${building}-${seed}.offset`, String((t0 - videoStart) / 1000));
const log: string[] = [];
let lastLine = "";
for (;;) {
  await page.waitForTimeout(1000);
  const snap = await page.evaluate(() => {
    const p = window.__shikaar;
    if (!p) return null;
    const me = p.state.players[0];
    return {
      t: Math.round(p.state.time),
      phase: p.state.phase,
      status: me.status,
      hp: me.health,
      keys: p.state.keys.length,
      fuses: `${p.state.fusesInserted}/${p.state.fusesNeeded}`,
      carrying: me.carrying >= 0,
      monster: p.state.monsters.map((m) => `${m.mode}:${Math.round(Math.hypot(m.x - me.x, m.z - me.z))}m`).join(","),
      pilot: p.autopilot ?? "",
      outcome: p.state.outcome,
    };
  });
  const results = await page.getByTestId("results").isVisible().catch(() => false);
  if (!snap || results) {
    log.push(`results screen after ${Math.round((Date.now() - t0) / 1000)}s`);
    break;
  }
  const line = `t=${snap.t} ${snap.phase} ${snap.status} hp=${snap.hp} keys=${snap.keys} fuses=${snap.fuses}${snap.carrying ? "+1" : ""} monsters=[${snap.monster}] pilot=${snap.pilot}`;
  if (line !== lastLine) log.push(line);
  lastLine = line;
  if (Date.now() - t0 > Number(minutes) * 60000) {
    log.push("timeout");
    break;
  }
}
await page.waitForTimeout(2500);
const resultText = await page.getByTestId("results").innerText().catch(() => "");
const capture = record
  ? await page.evaluate(async () => {
      const a = window.__shikaarAudio;
      return a ? { startedAt: a.startedAt, data: await a.stop() } : null;
    })
  : null;
if (capture?.data) {
  writeFileSync(`${outDir}/audio-${building}-${seed}.webm`, Buffer.from(capture.data, "base64"));
  writeFileSync(`${outDir}/audio-${building}-${seed}.offset`, String((capture.startedAt - videoStart) / 1000));
}
writeFileSync(`${outDir}/log-${building}-${seed}.txt`, [...log, "", resultText, "", "errors:", ...errors].join("\n"));
console.log(log.slice(-6).join("\n"));
console.log("RESULT:", resultText.split("\n").slice(0, 3).join(" | "), "errors:", errors.length);
const video = page.video();
await context.close();
if (video) {
  const { renameSync } = await import("node:fs");
  renameSync(await video.path(), `${outDir}/video-${building}-${seed}.webm`);
}
await browser.close();
server.kill();
