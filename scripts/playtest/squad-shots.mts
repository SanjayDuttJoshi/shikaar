import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { chromium, devices } from "@playwright/test";
import type { BrowserContext, Page } from "@playwright/test";

/**
 * Showcase screenshots of squad mode: menus, the room on desktop and phone, friends in the building
 * (back, face, crouching, torch in the dark, downed and calling for help) and the squad results.
 * Two tabs of one browser play together (?net=local).
 * Usage: node scripts/playtest/squad-shots.mts <outDir> [building=haveli] [seed=8]
 */
const [outDir = ".workshop/squad-shots", building = "haveli", seed = "8"] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const PORT = 4300 + Math.floor(Math.random() * 30);
const server = spawn("node", ["scripts/serve.mts"], { env: { ...process.env, PORT: String(PORT), SERVE_DIR: process.env.SERVE_DIR ?? "out" }, stdio: "ignore" });
await new Promise((r) => setTimeout(r, 800));
const browser = await chromium.launch({ channel: "chrome", args: ["--enable-gpu", "--ignore-gpu-blocklist"] });
const errors: string[] = [];
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });

const tab = async (ctx: BrowserContext, name: string, query: string): Promise<Page> => {
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${name}: ${String(e)}`));
  await page.addInitScript(
    ([n, b]) => localStorage.setItem("shikaar-settings-v1", JSON.stringify({ name: n, difficulty: "normal", building: b, quality: "high", sensitivity: 1, volume: 0, brightness: 1.35 })),
    [name, building] as const,
  );
  await page.goto(`http://localhost:${PORT}/?net=local&debug=1&noclick=1&seed=${seed}${query}`);
  return page;
};
const shot = async (page: Page, name: string, wait = 700): Promise<void> => {
  await page.waitForTimeout(wait);
  await page.screenshot({ path: `${outDir}/${name}.png` });
  console.log("shot", name);
};

const host = await tab(context, "Raju", "");
await shot(host, "s01-home-dosto-ke-saath", 1500);
await host.getByTestId("play-squad").click();
await shot(host, "s02-squad-panel");
await host.getByTestId("create-room").click();
const code = ((await host.getByTestId("room-code").textContent()) ?? "").trim();
const friend = await tab(context, "Priya", `&room=${code}`);
await shot(friend, "s03-invite-link-se-code-bhara-hua");
await friend.getByTestId("join-room").click();
await host.getByTestId("member-list").getByText("Priya").waitFor();
const phoneCtx = await browser.newContext({ ...devices["Pixel 7"] });
const phone = await tab(phoneCtx, "Sonu", `&room=${code}`);
await shot(phone, "s04-phone-join");
await host.bringToFront();
await shot(host, "s05-lobby-host");
await friend.bringToFront();
await shot(friend, "s06-lobby-dost");
await phone.close();

await host.bringToFront();
await host.getByTestId("start-round").click();
for (const p of [host, friend]) await p.waitForFunction(() => !!window.__shikaar, null, { timeout: 90000 });
await host.waitForTimeout(1500);
await host.evaluate(() => {
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
await shot(host, "s07-squad-saath-mein", 2500);

/** Friend stands `dist` m in front of the host, turned `turn` from the host's facing. */
const pose = async (dist: number, turn: number, crouch = false): Promise<void> => {
  const h = await host.evaluate(() => {
    const p = window.__shikaar;
    const me = p?.state.players.find((q) => q.id === p.selfId);
    return me ? { x: me.x, z: me.z, yaw: me.yaw } : null;
  });
  if (!h) return;
  await friend.bringToFront();
  await friend.evaluate(
    ([hp, d, t, c]) => {
      const p = window.__shikaar;
      const me = p?.state.players.find((q) => q.id === p.selfId);
      if (!p || !me) return;
      me.x = hp.x - Math.sin(hp.yaw) * d;
      me.z = hp.z - Math.cos(hp.yaw) * d;
      p.input.yaw = hp.yaw + t;
      p.input.pitch = 0;
      p.input.crouch = c;
    },
    [h, dist, turn, crouch] as const,
  );
  await friend.waitForTimeout(700);
  await host.bringToFront();
  await host.waitForTimeout(900);
};
await pose(3, Math.PI);
await shot(host, "s08-dost-saamne-torch-ke-saath");
await pose(3, 0);
await shot(host, "s09-dost-aage-ja-raha");
await pose(4, Math.PI / 2, true);
await shot(host, "s10-dost-jhuk-ke-chal-raha");
await pose(6, Math.PI * 0.9);
await host.evaluate(() => {
  const p = window.__shikaar;
  const me = p?.state.players.find((q) => q.id === p.selfId);
  if (p && me?.torchOn) p.input.torchPressed = true;
});
await shot(host, "s11-andhere-mein-dost-ki-torch", 1200);

// The friend goes down: a red tag through the walls asks for help.
await host.evaluate(() => {
  const p = window.__shikaar;
  const mate = p?.state.players.find((q) => q.id !== p.selfId);
  if (!p || !mate) return;
  mate.health = 0;
  mate.status = "downed" as never;
  mate.bleed = 40;
  p.input.yaw += 0.5;
});
await shot(host, "s12-dost-gira-uthao", 1500);
await friend.bringToFront();
await shot(friend, "s13-dost-ki-nazar-gire-hue", 1500);

// Everyone out: squad results for host and friend.
await host.bringToFront();
await host.evaluate(() => {
  const p = window.__shikaar;
  if (!p) return;
  for (const q of p.state.players) q.status = "escaped" as never;
});
await host.getByTestId("results").waitFor({ timeout: 20000 });
await shot(host, "s14-results-host");
await friend.bringToFront();
await friend.getByTestId("results").waitFor({ timeout: 20000 });
await shot(friend, "s15-results-dost");
console.log("errors", errors);
await browser.close();
server.kill();
