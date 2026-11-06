import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const SETTINGS = (building: string) =>
  JSON.stringify({ name: "Tester", difficulty: "normal", building, quality: "low", sensitivity: 1, volume: 0.5 });

const startSolo = async (page: Page, building = "asylum", seed = 5): Promise<string[]> => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.addInitScript((s) => localStorage.setItem("shikaar-settings-v1", s), SETTINGS(building));
  await page.goto(`/?debug=1&noclick=1&seed=${seed}`);
  await page.getByTestId("play-solo").click();
  await page.waitForFunction(() => !!window.__shikaar, null, { timeout: 60_000 });
  return errors;
};

/** Skips the intro so tests don't wait for the title card. */
const skipIntro = async (page: Page): Promise<void> => {
  await page.evaluate(() => {
    const p = window.__shikaar;
    if (p) p.state.phaseTimer = 0;
  });
  await expect(page.getByTestId("hud")).toBeVisible();
};

test("home screen remembers settings", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "SHIKAAR" })).toBeVisible();
  await page.getByPlaceholder("Naam likho").fill("Raju");
  await page.getByRole("button", { name: "Khatarnak" }).click();
  await page.reload();
  await expect(page.getByPlaceholder("Naam likho")).toHaveValue("Raju");
  await expect(page.getByRole("button", { name: "Khatarnak" })).toHaveClass(/bg-blood/);
});

test("a solo round loads with the HUD and no errors", async ({ page }) => {
  const errors = await startSolo(page);
  await skipIntro(page);
  await expect(page.getByText("Chaabi dhoondho")).toBeVisible();
  expect(errors).toEqual([]);
});

test("picking up a key with E shows it on the HUD", async ({ page }) => {
  await startSolo(page, "haveli", 8);
  await skipIntro(page);
  await page.evaluate(() => {
    const p = window.__shikaar;
    if (!p) return;
    p.state.monsters.length = 0;
    const key = p.ctx.level.items.find((i) => i.kind === "key");
    const me = p.state.players[0];
    if (!key) return;
    me.x = key.x + 0.7;
    me.z = key.z;
    p.input.yaw = Math.PI / 2;
    p.input.pitch = -0.6;
  });
  await expect(page.getByText(/chaabi uthao/)).toBeVisible();
  await page.keyboard.press("e");
  await expect(page.getByText(/chaabi mil gayi/)).toBeVisible();
});

test("restoring power opens the gate and walking out wins", async ({ page }) => {
  await startSolo(page, "asylum", 21);
  await skipIntro(page);
  await page.evaluate(() => {
    const p = window.__shikaar;
    if (!p) return;
    p.state.monsters.length = 0;
    p.state.fusesInserted = p.state.fusesNeeded - 1;
    const box = p.ctx.level.props[p.ctx.level.fuseBoxPropId];
    const fuse = p.ctx.level.items.findIndex((i) => i.kind === "fuse");
    const me = p.state.players[0];
    me.carrying = fuse;
    p.state.items[fuse].taken = true;
    me.x = box.x + Math.sin(box.yaw) * 0.9;
    me.z = box.z + Math.cos(box.yaw) * 0.9;
    p.input.yaw = box.yaw;
    p.input.pitch = -0.3;
  });
  await expect(page.getByText("Fuse lagao")).toBeVisible();
  await page.keyboard.press("e");
  await expect(page.getByText(/GATE \d+/)).toBeVisible();
  await page.evaluate(() => {
    const p = window.__shikaar;
    if (p) p.state.phaseTimer = 0.1;
  });
  await expect(page.getByText(/BHAAGO/).first()).toBeVisible();
  await page.evaluate(() => {
    const p = window.__shikaar;
    if (!p) return;
    const gate = p.ctx.level.doors[p.ctx.level.exitDoorId];
    const lv = p.ctx.level;
    const aInside = lv.roomOf[gate.cy * lv.width + gate.cx] >= 0;
    const outX = gate.vertical ? (gate.cx + (aInside ? 1.6 : 0.4)) * 3 : (gate.cx + 0.5) * 3;
    const outZ = gate.vertical ? (gate.cy + 0.5) * 3 : (gate.cy + (aInside ? 1.6 : 0.4)) * 3;
    const me = p.state.players[0];
    me.x = outX;
    me.z = outZ;
  });
  await expect(page.getByTestId("results")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("BACH GAYE")).toBeVisible();
});

test("the Shikari catches a player who stands still", async ({ page }) => {
  await startSolo(page, "asylum", 5);
  await skipIntro(page);
  await page.evaluate(() => {
    const p = window.__shikaar;
    if (!p) return;
    // Only the Shikari, standing still and facing the player from 2 m with a clear view.
    p.state.monsters.length = 1;
    const m = p.state.monsters[0];
    const me = p.state.players[0];
    p.placeNear?.(m, 2.2);
    m.yaw = Math.atan2(me.x - m.x, me.z - m.z);
    m.timer = 5;
    m.path = [];
    me.torchOn = true;
  });
  await expect(page.getByTestId("results")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("SHIKARI JEET GAYA")).toBeVisible();
  await page.getByTestId("play-again").click();
  await page.waitForFunction(() => !!window.__shikaar, null, { timeout: 60_000 });
});

test.describe("phone", () => {
  test.use({ viewport: { width: 412, height: 915 }, hasTouch: true, isMobile: true });
  test("shows touch controls", async ({ page }) => {
    await startSolo(page, "haveli", 3);
    await skipIntro(page);
    await expect(page.getByRole("button", { name: "Bhaago" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Use" })).toBeVisible();
  });
});

test("keys can be rebound and stay rebound", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("open-controls").click();
  await page.getByTestId("bind-torch-0").click();
  await page.keyboard.press("t");
  await expect(page.getByTestId("bind-torch-0")).toHaveText("T");
  await page.getByRole("button", { name: "Arrow keys ↑ ↓ ← →" }).click();
  await expect(page.getByTestId("bind-forward-0")).toHaveText("↑");
  await page.getByTestId("controls-done").click();
  await page.reload();
  await page.getByTestId("open-controls").click();
  await expect(page.getByTestId("bind-forward-0")).toHaveText("↑");
});

test("an envelope offers a story film that plays and can be skipped", async ({ page }) => {
  await startSolo(page, "haveli", 8);
  await skipIntro(page);
  await page.evaluate(() => {
    const p = window.__shikaar;
    if (!p) return;
    p.state.monsters.length = 0;
    const env = p.ctx.level.items.find((i) => i.kind === "envelope");
    if (env) p.placeNear?.(env, 0.9, -0.7);
  });
  await expect(page.getByText("Lifafa kholo")).toBeVisible();
  await page.keyboard.press("e");
  await expect(page.getByTestId("envelope-overlay")).toBeVisible();
  await expect(page.getByText("Yaad 1 — Nayi bahu")).toBeVisible();
  await page.keyboard.press("e");
  await expect(page.getByTestId("film-overlay")).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(4000);
  await page.keyboard.press("e");
  await expect(page.getByTestId("film-overlay")).toBeHidden({ timeout: 10_000 });
  await expect(page.getByTestId("hud")).toBeVisible();
});
