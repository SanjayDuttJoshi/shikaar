import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { chromium, devices } from "@playwright/test";
import type { Page } from "@playwright/test";

/**
 * Showcase screenshots for ~/Desktop/INTEREST/SHIKAAR: menus, both buildings, monster,
 * hiding, objectives, finale, results, phone. Usage: node scripts/playtest/gallery.mts <outDir>
 */
const [outDir = ".workshop/gallery"] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const PORT = 4260;
const server = spawn("node", ["scripts/serve.mts"], { env: { ...process.env, PORT: String(PORT) }, stdio: "ignore" });
await new Promise((r) => setTimeout(r, 800));
const browser = await chromium.launch({ channel: "chrome", args: ["--enable-gpu", "--ignore-gpu-blocklist"] });
const errors: string[] = [];

const shot = async (page: Page, name: string, wait = 900): Promise<void> => {
  await page.waitForTimeout(wait);
  await page.screenshot({ path: `${outDir}/${name}.png` });
  console.log("shot", name);
};

const open = async (page: Page, building: string, seed: number, quality = "high"): Promise<void> => {
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.addInitScript(([b, q]) => {
    localStorage.setItem("shikaar-settings-v1", JSON.stringify({ name: "Raju", difficulty: "normal", building: b, quality: q, sensitivity: 1, volume: 0.8 }));
  }, [building, quality]);
  await page.goto(`http://localhost:${PORT}/?debug=1&noclick=1&seed=${seed}`);
  await page.waitForTimeout(1200);
};

const start = async (page: Page): Promise<void> => {
  await page.getByTestId("play-solo").click();
  await page.waitForFunction(() => !!window.__shikaar, null, { timeout: 60000 });
};

/** Freezes the monsters far away (or removes them) so a staged shot isn't interrupted. */
const calm = (page: Page) =>
  page.evaluate(() => {
    const p = window.__shikaar;
    if (!p) return;
    for (const m of p.state.monsters) {
      m.mode = "stunned" as never;
      m.timer = 9999;
      m.x = -50;
      m.z = -50;
    }
    p.state.phaseTimer = 0;
  });

/** Stands in front of a door (inside the building), looking straight at it. */
const faceDoor = (page: Page, which: "locked" | "gate", dist: number) =>
  page.evaluate(
    ([w, d]) => {
      const p = window.__shikaar;
      if (!p) return;
      const lv = p.ctx.level;
      const id = w === "gate" ? lv.exitDoorId : lv.doors.findIndex((x) => x.lock !== null);
      const door = lv.doors[id];
      const c = door.vertical ? { x: (door.cx + 1) * 3, z: (door.cy + 0.5) * 3 } : { x: (door.cx + 0.5) * 3, z: (door.cy + 1) * 3 };
      const n = door.vertical ? { x: 1, z: 0 } : { x: 0, z: 1 };
      for (const sign of [-1, 1]) {
        const spot = { x: c.x + n.x * sign * Number(d), z: c.z + n.z * sign * Number(d) };
        const inside = lv.roomOf[Math.floor(spot.z / 3) * lv.width + Math.floor(spot.x / 3)] >= 0;
        if (!inside) continue;
        const me = p.state.players[0];
        me.x = spot.x;
        me.z = spot.z;
        p.input.yaw = Math.atan2(-(c.x - spot.x), -(c.z - spot.z));
        p.input.pitch = 0.02;
        return;
      }
    },
    [which, String(dist)],
  );

const desktop = await browser.newContext({ viewport: { width: 1280, height: 720 } });

// ---- Asylum ----
{
  const page = await desktop.newPage();
  await open(page, "asylum", 21);
  await shot(page, "01-home", 600);
  await start(page);
  await shot(page, "02-intro-pagalkhana", 1800);
  await calm(page);
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    const p = window.__shikaar;
    if (!p) return;
    const corridor = p.ctx.level.rooms.filter((r) => r.kind === "corridor" && (r.rect.w >= 3 || r.rect.h >= 3))[2] ?? p.ctx.level.rooms[0];
    const alongX = corridor.rect.w > corridor.rect.h;
    const me = p.state.players[0];
    me.x = (corridor.rect.x + 0.5) * 3;
    me.z = (corridor.rect.y + 0.5) * 3;
    p.input.yaw = alongX ? -Math.PI / 2 : Math.PI;
    p.input.pitch = 0;
  });
  await shot(page, "03-pagalkhana-corridor", 1500);
  await page.evaluate(() => {
    const p = window.__shikaar;
    const ward = p?.ctx.level.rooms.find((r) => r.kind === "ward") ?? p?.ctx.level.rooms.find((r) => r.kind === "cell");
    if (!p || !ward) return;
    p.placeNear?.({ x: (ward.rect.x + ward.rect.w / 2) * 3, z: (ward.rect.y + ward.rect.h / 2) * 3 }, 3.5, -0.15);
  });
  await shot(page, "04-pagalkhana-ward", 1500);
  await faceDoor(page, "locked", 2.2);
  await shot(page, "05-band-darwaza-laal-chaabi", 1500);
  await page.evaluate(() => {
    const p = window.__shikaar;
    const key = p?.ctx.level.items.find((i) => i.kind === "key");
    if (!p || !key) return;
    p.placeNear?.(key, 1.6, -0.55);
    p.state.players[0].torchOn = false;
  });
  await shot(page, "06-andhere-mein-chaabi", 1500);
  await page.evaluate(() => {
    const p = window.__shikaar;
    if (!p) return;
    const box = p.ctx.level.props[p.ctx.level.fuseBoxPropId];
    p.state.players[0].torchOn = true;
    p.placeNear?.(box, 1.7, -0.1);
  });
  await shot(page, "07-fuse-box", 1500);
  // Monster in the torch beam.
  await page.evaluate(() => {
    const p = window.__shikaar;
    if (!p) return;
    const m = p.state.monsters[0];
    const ward = p.ctx.level.rooms.filter((r) => r.kind !== "corridor")[3];
    const c = { x: (ward.rect.x + ward.rect.w / 2) * 3, z: (ward.rect.y + ward.rect.h / 2) * 3 };
    p.placeNear?.(c, 3.2, 0.12);
    const me = p.state.players[0];
    m.x = c.x;
    m.z = c.z;
    m.yaw = Math.atan2(me.x - c.x, me.z - c.z);
    m.mode = "chase" as never;
    m.timer = 0;
    m.speed = 0;
  });
  await page.evaluate(() => {
    const p = window.__shikaar;
    if (!p) return;
    const m = p.state.monsters[0];
    m.mode = "attack" as never;
    m.timer = 999;
  });
  await shot(page, "08-shikari-saamne", 1200);
  // Hiding in a locker while it walks past.
  await page.evaluate(() => {
    const p = window.__shikaar;
    if (!p) return;
    const lit = new Set(p.ctx.level.lights.filter((l) => !l.dead).map((l) => l.roomId));
    const spot =
      p.ctx.level.hideSpots.find((h) => h.kind === "locker" && lit.has(p.ctx.level.props[h.propId].roomId)) ??
      p.ctx.level.hideSpots.find((h) => h.kind === "locker") ??
      p.ctx.level.hideSpots[0];
    const prop = p.ctx.level.props[spot.propId];
    const me = p.state.players[0];
    me.status = "hiding" as never;
    me.hideSpot = spot.id;
    me.x = prop.x;
    me.z = prop.z;
    me.torchOn = false;
    const m = p.state.monsters[0];
    m.mode = "search" as never;
    m.timer = 999;
    m.path = [];
    m.x = prop.x + Math.sin(prop.yaw) * 1.3;
    m.z = prop.z + Math.cos(prop.yaw) * 1.3;
    m.yaw = prop.yaw + Math.PI;
  });
  await shot(page, "09-locker-mein-chhupe", 1800);
  await page.evaluate(() => {
    const p = window.__shikaar;
    if (!p) return;
    const spot = p.ctx.level.hideSpots.find((h) => h.kind === "under-bed");
    if (!spot) return;
    const prop = p.ctx.level.props[spot.propId];
    const me = p.state.players[0];
    me.hideSpot = spot.id;
    me.x = prop.x;
    me.z = prop.z;
    const m = p.state.monsters[0];
    m.x = prop.x + Math.cos(prop.yaw) * 1.5;
    m.z = prop.z - Math.sin(prop.yaw) * 1.5;
  });
  await shot(page, "10-bed-ke-neeche", 1800);
  // Finale: power back, red lights, gate countdown.
  await page.evaluate(() => {
    const p = window.__shikaar;
    if (!p) return;
    const me = p.state.players[0];
    me.status = "alive" as never;
    me.hideSpot = -1;
    me.torchOn = true;
    p.state.monsters[0].x = -50;
    p.state.monsters[0].mode = "stunned" as never;
    p.state.fusesInserted = p.state.fusesNeeded;
    p.state.powerOn = true;
    p.state.phase = "gate-opening" as never;
    p.state.phaseTimer = 11;
  });
  await faceDoor(page, "gate", 4);
  await shot(page, "11-bijli-wapas-gate-khul-raha", 1500);
  await page.evaluate(() => {
    const p = window.__shikaar;
    if (p) p.state.phaseTimer = 0.05;
  });
  await shot(page, "12-gate-khul-gaya", 2500);
  await page.close();
}

// ---- Haveli ----
{
  const page = await desktop.newPage();
  await open(page, "haveli", 8);
  await start(page);
  await shot(page, "13-intro-haveli", 1800);
  await calm(page);
  await page.evaluate(() => {
    const p = window.__shikaar;
    const court = p?.ctx.level.rooms.find((r) => r.kind === "courtyard");
    if (!p || !court) return;
    const me = p.state.players[0];
    me.x = (court.rect.x + 0.3) * 3;
    me.z = (court.rect.y + 0.3) * 3;
    p.input.yaw = Math.atan2(-((court.rect.x + court.rect.w) * 3 - me.x), -((court.rect.y + court.rect.h) * 3 - me.z));
    p.input.pitch = 0.18;
  });
  await shot(page, "14-haveli-aangan-chaand", 1800);
  await page.evaluate(() => {
    const p = window.__shikaar;
    const room = p?.ctx.level.rooms.find((r) => r.kind === "bedroom") ?? p?.ctx.level.rooms.find((r) => r.kind === "baithak");
    if (!p || !room) return;
    p.placeNear?.({ x: (room.rect.x + room.rect.w / 2) * 3, z: (room.rect.y + room.rect.h / 2) * 3 }, 2.6, -0.2);
  });
  await shot(page, "15-haveli-kamra", 1500);
  await page.evaluate(() => {
    const p = window.__shikaar;
    const s = p?.scene;
    if (!p || !s) return;
    const w = s.getObjectByProperty("type", "Mesh");
    let target: { x: number; z: number } | null = null;
    s.traverse((o) => {
      if (!target && o.name.startsWith("writing:")) target = { x: o.position.x, z: o.position.z };
    });
    if (w && target) p.placeNear?.(target, 2.4, 0.05);
  });
  await shot(page, "16-deewar-pe-likha", 1500);
  await page.evaluate(() => {
    const p = window.__shikaar;
    if (!p) return;
    const m = p.state.monsters[0];
    const court = p.ctx.level.rooms.find((r) => r.kind === "courtyard");
    if (!court) return;
    const c = { x: (court.rect.x + court.rect.w / 2) * 3, z: (court.rect.y + court.rect.h / 2) * 3 };
    p.placeNear?.(c, 4, 0.1);
    const me = p.state.players[0];
    m.x = c.x;
    m.z = c.z;
    m.mode = "attack" as never;
    m.timer = 999;
    m.yaw = Math.atan2(me.x - c.x, me.z - c.z);
  });
  await shot(page, "17-haveli-mein-shikari", 1500);
  await page.close();
}

// ---- Results screens ----
{
  const page = await desktop.newPage();
  await open(page, "asylum", 5);
  await start(page);
  await calm(page);
  await page.evaluate(() => {
    const p = window.__shikaar;
    if (!p) return;
    const me = p.state.players[0];
    me.status = "dead" as never;
    p.state.keys.push(0 as never);
    p.state.fusesInserted = 1;
  });
  await page.getByTestId("results").waitFor({ timeout: 20000 });
  await shot(page, "18-result-shikari-jeet-gaya", 600);
  await page.close();
}

// ---- Phone ----
{
  const phone = await browser.newContext({ ...devices["Pixel 7"], viewport: { width: 412, height: 915 } });
  const page = await phone.newPage();
  await open(page, "haveli", 3, "low");
  await shot(page, "19-phone-home", 400);
  await start(page);
  await calm(page);
  await shot(page, "20-phone-khelte-hue", 2000);
  await page.setViewportSize({ width: 915, height: 412 });
  await shot(page, "21-phone-landscape", 1500);
  await page.getByRole("button", { name: "☰" }).dispatchEvent("pointerdown");
  await shot(page, "22-phone-pause-menu", 800);
  await phone.close();
}

console.log("errors", errors);
await browser.close();
server.kill();
