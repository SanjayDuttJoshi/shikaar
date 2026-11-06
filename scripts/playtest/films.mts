import { spawn } from "node:child_process";
import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";

/**
 * Plays all four story films of a building and records them (video + the game's sound) plus stills.
 * Usage: node scripts/playtest/films.mts <outDir> <asylum|haveli> <hi|en>
 */
const [outDir = ".workshop/films", building = "haveli", lang = "hi"] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const PORT = 4290 + (building === "haveli" ? 0 : 1) + (lang === "en" ? 2 : 0);
const server = spawn("node", ["scripts/serve.mts"], { env: { ...process.env, PORT: String(PORT) }, stdio: "ignore" });
await new Promise((r) => setTimeout(r, 800));
const browser = await chromium.launch({ channel: "chrome", args: ["--enable-gpu", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"] });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: outDir, size: { width: 1280, height: 720 } } });
const page = await context.newPage();
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(String(e)));
await page.addInitScript(([b, l]) => {
  localStorage.setItem("shikaar-settings-v1", JSON.stringify({ name: "Raju", difficulty: "normal", building: b, quality: "high", sensitivity: 1, volume: 0.9, brightness: 1.3, language: l }));
}, [building, lang]);
const videoStart = Date.now();
await page.goto(`http://localhost:${PORT}/?debug=1&noclick=1&recordaudio=1&seed=5`);
await page.getByTestId("play-solo").click();
await page.waitForFunction(() => !!window.__shikaar, null, { timeout: 60000 });
await page.evaluate(() => {
  const p = window.__shikaar;
  if (!p) return;
  p.state.phaseTimer = 0;
  p.state.monsters.length = 0;
});
const marks: Array<{ film: number; at: number }> = [];
for (let i = 0; i < 4; i += 1) {
  await page.evaluate((k) => window.__shikaar?.playFilm?.(k), i);
  marks.push({ film: i, at: (Date.now() - videoStart) / 1000 });
  await page.waitForFunction(() => window.__shikaar?.filmPlaying?.() === true, null, { timeout: 30000 });
  let n = 0;
  while (await page.evaluate(() => window.__shikaar?.filmPlaying?.() === true)) {
    await page.waitForTimeout(3200);
    await page.screenshot({ path: `${outDir}/${building}-${lang}-film${i + 1}-${String(n).padStart(2, "0")}.png` });
    n += 1;
    if (n > 40) break;
  }
  console.log("film", i + 1, "stills", n);
  await page.waitForTimeout(800);
}
const capture = await page.evaluate(async () => {
  const a = window.__shikaarAudio;
  return a ? { startedAt: a.startedAt, data: await a.stop() } : null;
});
if (capture?.data) {
  writeFileSync(`${outDir}/audio-${building}-${lang}.webm`, Buffer.from(capture.data, "base64"));
  writeFileSync(`${outDir}/audio-${building}-${lang}.offset`, String((capture.startedAt - videoStart) / 1000));
}
writeFileSync(`${outDir}/marks-${building}-${lang}.json`, JSON.stringify(marks));
const video = page.video();
await context.close();
if (video) renameSync(await video.path(), `${outDir}/video-${building}-${lang}.webm`);
console.log("errors", errors);
await browser.close();
server.kill();
