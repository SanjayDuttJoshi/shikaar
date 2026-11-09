import { spawn } from "node:child_process";
import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { chromium, devices } from "@playwright/test";
import type { BrowserContext, Page } from "@playwright/test";

/**
 * A squad round played by autopilots, each in its own browser window, recorded for the showcase.
 * By default they meet over the real internet (Trystero, free public relays), like friends would.
 * Usage: node scripts/playtest/squad.mts <outDir> <seed> <asylum|haveli> <difficulty> [players=2] [minutes=10] [net=online|local] [phoneSeat]
 * phoneSeat: index of a friend who plays on a phone held sideways (touch controls on screen), e.g. 2.
 */
const [outDir = ".workshop/squad", seed = "21", building = "asylum", difficulty = "easy", players = "2", minutes = "10", net = "online", phoneSeat = "-1"] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const NAMES = ["Raju", "Priya", "Sonu", "Meena"];
const SIZE = { width: 960, height: 540 };
const PHONE = { width: 915, height: 412 };
const PORT = 4260 + Math.floor(Math.random() * 30);
const server = spawn("node", ["scripts/serve.mts"], { env: { ...process.env, PORT: String(PORT), SERVE_DIR: process.env.SERVE_DIR ?? "out" }, stdio: "ignore" });
await new Promise((r) => setTimeout(r, 800));
const browser = await chromium.launch({ channel: "chrome", args: ["--enable-gpu", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"] });
const errors: string[] = [];
/** Connection-library warnings (who got disconnected and why). */
const netLog: string[] = [];
const local = net === "local";

interface Seat {
  name: string;
  context: BrowserContext;
  page: Page;
  videoStart: number;
}

const seat = async (name: string, query: string, shared?: BrowserContext): Promise<Seat> => {
  const phone = NAMES.indexOf(name) === Number(phoneSeat);
  const context =
    shared ??
    (await browser.newContext(
      phone ? { ...devices["Pixel 7"], viewport: PHONE, recordVideo: { dir: outDir, size: PHONE } } : { viewport: SIZE, recordVideo: { dir: outDir, size: SIZE } },
    ));
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(`${name}: ${String(e)}`));
  page.on("console", (m) => {
    const text = m.text();
    if (/trystero|disconnect|peer/i.test(text)) netLog.push(`${new Date().toISOString().slice(11, 19)} ${name} [${m.type()}] ${text}`);
    if (m.type() === "error" && !text.includes("404") && !/relay|websocket|wss:/i.test(text)) errors.push(`${name}: ${text}`);
  });
  await page.addInitScript(
    ([n, b, d, q]) => localStorage.setItem("shikaar-settings-v1", JSON.stringify({ name: n, difficulty: d, building: b, quality: q, sensitivity: 1, volume: 0.8 })),
    [name, building, difficulty, phone ? "low" : "medium"],
  );
  const videoStart = Date.now();
  await page.goto(`http://localhost:${PORT}/?debug=1&noclick=1&autopilot=1&seed=${seed}${local ? "&net=local" : ""}${query}`);
  return { name, context, page, videoStart };
};

const host = await seat(NAMES[0], "&recordaudio=1");
await host.page.getByTestId("play-squad").click();
await host.page.getByTestId("create-room").click();
const code = ((await host.page.getByTestId("room-code").textContent()) ?? "").trim();
console.log("room", code, local ? "(local)" : "(internet)");
const seats: Seat[] = [host];
for (let i = 1; i < Number(players); i += 1) {
  const friend = await seat(NAMES[i], `&room=${code}`, local ? host.context : undefined);
  await friend.page.getByTestId("join-room").click();
  seats.push(friend);
}
const joinedAt = Date.now();
await host.page.waitForFunction((n) => (document.querySelectorAll("[data-testid=member-list] li").length ?? 0) >= n, Number(players), { timeout: 90000 });
console.log(`all ${players} in the room after ${Math.round((Date.now() - joinedAt) / 1000)}s`);
await host.page.waitForTimeout(1500);
await host.page.getByTestId("start-round").click();
await Promise.all(seats.map((s) => s.page.waitForFunction(() => !!window.__shikaar, null, { timeout: 90000 })));
const t0 = Date.now();
for (const s of seats) writeFileSync(`${outDir}/${s.name}.offset`, String((t0 - s.videoStart) / 1000));

const log: string[] = [];
let lastLine = "";
for (;;) {
  await host.page.waitForTimeout(1000);
  const snap = await host.page.evaluate(() => {
    const p = window.__shikaar;
    if (!p) return null;
    return {
      t: Math.round(p.state.time),
      phase: p.state.phase,
      players: p.state.players.map((q) => `${q.name}:${q.status}:${q.health}`).join(" "),
      keys: p.state.keys.length,
      fuses: `${p.state.fusesInserted}/${p.state.fusesNeeded}`,
      monsters: p.state.monsters.map((m) => m.mode).join(","),
    };
  });
  const lag = await Promise.all(
    seats.slice(1).map((s) =>
      s.page.evaluate(() => {
        const p = window.__shikaar;
        return p ? `${p.state.phase}/${Math.round(p.state.time)}` : "-";
      }),
    ),
  );
  const done = await host.page.getByTestId("results").isVisible().catch(() => false);
  if (!snap || done) {
    log.push(`results after ${Math.round((Date.now() - t0) / 1000)}s`);
    break;
  }
  const line = `t=${snap.t} ${snap.phase} [${snap.players}] keys=${snap.keys} fuses=${snap.fuses} monsters=${snap.monsters} friends=${lag.join(",")}`;
  if (line !== lastLine) {
    log.push(line);
    if (snap.t % 15 === 0) console.log(line);
  }
  lastLine = line;
  if (Date.now() - t0 > Number(minutes) * 60000) {
    log.push("timeout");
    break;
  }
}
await host.page.waitForTimeout(3000);
const results = await Promise.all(seats.map((s) => s.page.getByTestId("results").innerText().catch(() => "")));
const capture = await host.page.evaluate(async () => {
  const a = window.__shikaarAudio;
  return a ? { startedAt: a.startedAt, data: await a.stop() } : null;
});
if (capture?.data) {
  writeFileSync(`${outDir}/audio.webm`, Buffer.from(capture.data, "base64"));
  writeFileSync(`${outDir}/audio.offset`, String((capture.startedAt - host.videoStart) / 1000));
}
writeFileSync(`${outDir}/log.txt`, [...log, "", ...results.map((r, i) => `${seats[i].name}: ${r.split("\n").slice(0, 2).join(" | ")}`), "", "errors:", ...errors, "", "network:", ...netLog].join("\n"));
if (netLog.length > 0) console.log("NETWORK:", netLog.slice(0, 12).join("\n"));
console.log(log.slice(-4).join("\n"));
console.log("RESULTS:", results.map((r) => r.split("\n").slice(0, 2).join(" ")).join(" || "), "errors:", errors.length);
for (const s of seats) {
  const video = s.page.video();
  await s.page.close();
  if (video) renameSync(await video.path(), `${outDir}/${s.name}.webm`);
}
await browser.close();
server.kill();
