import { spawn } from "node:child_process";
import { mkdirSync, renameSync } from "node:fs";
import { chromium } from "@playwright/test";

/**
 * Records the 3D model turntable (?debug=1&viewer=1) to a video and grabs a still of each model.
 * Usage: node scripts/playtest/model-show.mts <outDir>
 */
const [outDir = ".workshop/model-show"] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const PORT = 4280;
const server = spawn("node", ["scripts/serve.mts"], { env: { ...process.env, PORT: String(PORT) }, stdio: "ignore" });
await new Promise((r) => setTimeout(r, 800));
const browser = await chromium.launch({ channel: "chrome", args: ["--enable-gpu", "--ignore-gpu-blocklist"] });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: outDir, size: { width: 1280, height: 720 } } });
const page = await context.newPage();
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(String(e)));
await page.goto(`http://localhost:${PORT}/?debug=1&viewer=1`);
await page.waitForFunction(() => (window.__modelShow?.index ?? -1) >= 0, null, { timeout: 60000 });
let lastIndex = -1;
for (;;) {
  const state = await page.evaluate(() => window.__modelShow ?? { index: -1, done: false, title: "" });
  if (state.done) break;
  if (state.index !== lastIndex) {
    lastIndex = state.index;
    await page.waitForTimeout(1600);
    await page.screenshot({ path: `${outDir}/model-${String(state.index + 1).padStart(2, "0")}.png` });
    console.log("model", state.index + 1, state.title);
  }
  await page.waitForTimeout(300);
}
await page.waitForTimeout(500);
const video = page.video();
await context.close();
if (video) renameSync(await video.path(), `${outDir}/models.webm`);
console.log("errors", errors);
await browser.close();
server.kill();
