import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { chromium, devices } from "@playwright/test";

/** Phone check: touch layout, HUD placement, FPS on the Low preset. */
const [outDir = ".workshop/shots/phone", seed = "9", building = "haveli"] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const PORT = 4181;
const server = spawn("node", ["scripts/serve.mts"], { env: { ...process.env, PORT: String(PORT) }, stdio: "ignore" });
await new Promise((r) => setTimeout(r, 800));
const browser = await chromium.launch({ channel: "chrome", args: ["--enable-gpu", "--ignore-gpu-blocklist"] });
const context = await browser.newContext({ ...devices["Pixel 7"], viewport: { width: 412, height: 915 } });
const page = await context.newPage();
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(String(e)));
await page.addInitScript((b) => {
  localStorage.setItem("shikaar-settings-v1", JSON.stringify({ name: "Phone", difficulty: "normal", building: b, quality: "low", sensitivity: 1, volume: 0.8 }));
}, building);
await page.goto(`http://localhost:${PORT}/?debug=1&seed=${seed}`);
await page.waitForTimeout(1500);
await page.screenshot({ path: `${outDir}/00-home.png`, fullPage: true });
await page.getByTestId("play-solo").click();
await page.waitForFunction(() => !!window.__shikaar, null, { timeout: 60000 });
await page.waitForTimeout(7500);
await page.screenshot({ path: `${outDir}/01-portrait.png` });
await page.setViewportSize({ width: 915, height: 412 });
await page.waitForTimeout(1200);
await page.screenshot({ path: `${outDir}/02-landscape.png` });
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
console.log("fps", fps.toFixed(1), "errors", errors);
await browser.close();
server.kill();
