import { expect, test } from "@playwright/test";
import type { BrowserContext, Page } from "@playwright/test";

/** Squad rounds between two tabs of one browser (?net=local swaps the internet for BroadcastChannel). */
const SETTINGS = (name: string) => JSON.stringify({ name, difficulty: "easy", building: "asylum", quality: "low", sensitivity: 1, volume: 0.4 });

const openTab = async (context: BrowserContext, name: string, query: string): Promise<{ page: Page; errors: string[] }> => {
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.addInitScript((s) => localStorage.setItem("shikaar-settings-v1", s), SETTINGS(name));
  await page.goto(`/?net=local&debug=1&noclick=1&seed=21${query}`);
  return { page, errors };
};

const inRound = async (page: Page): Promise<void> => {
  await page.waitForFunction(() => !!window.__shikaar && window.__shikaar.state.players.length === 2, null, { timeout: 60_000 });
};

test("two friends meet in a room, play the same round and see each other move", async ({ context }) => {
  const host = await openTab(context, "Raju", "");
  await host.page.getByTestId("play-squad").click();
  await host.page.getByTestId("create-room").click();
  const code = (await host.page.getByTestId("room-code").textContent())?.trim() ?? "";
  expect(code).toMatch(/^[A-Z0-9]{5}$/);

  const friend = await openTab(context, "Priya", `&room=${code}`);
  await expect(friend.page.getByTestId("join-code")).toHaveValue(code);
  await friend.page.getByTestId("join-room").click();
  await expect(friend.page.getByTestId("member-list")).toContainText("Raju");
  await expect(host.page.getByTestId("member-list")).toContainText("Priya");

  await host.page.getByTestId("start-round").click();
  await inRound(host.page);
  await inRound(friend.page);

  // Same building on both sides.
  const levels = await Promise.all(
    [host.page, friend.page].map((p) => p.evaluate(() => `${window.__shikaar?.ctx.level.doors.length}/${window.__shikaar?.ctx.level.items.length}`)),
  );
  expect(levels[0]).toBe(levels[1]);

  // The host only starts once the friend has loaded; skip the rest of the intro.
  await host.page.waitForFunction(() => window.__shikaar?.state.phase === "intro");
  await host.page.waitForTimeout(800);
  await host.page.evaluate(() => {
    const p = window.__shikaar;
    if (p) p.state.phaseTimer = 0;
  });
  await expect(friend.page.getByTestId("hud")).toBeVisible({ timeout: 15_000 });

  // The friend walks; the host sees them arrive.
  const goal = await friend.page.evaluate(() => {
    const p = window.__shikaar;
    if (!p) return null;
    const me = p.state.players.find((q) => q.id === p.selfId);
    if (!me) return null;
    p.input.moveZ = 1;
    return { id: me.id, x: me.x, z: me.z };
  });
  expect(goal).not.toBeNull();
  await friend.page.waitForTimeout(1500);
  const moved = await friend.page.evaluate(() => {
    const p = window.__shikaar;
    if (!p) return null;
    p.input.moveZ = 0;
    const me = p.state.players.find((q) => q.id === p.selfId);
    return me ? { x: me.x, z: me.z } : null;
  });
  await host.page.waitForTimeout(600);
  const seen = await host.page.evaluate((id) => {
    const q = window.__shikaar?.state.players.find((p) => p.id === id);
    return q ? { x: q.x, z: q.z } : null;
  }, goal?.id ?? "");
  expect(moved && goal && Math.hypot(moved.x - goal.x, moved.z - goal.z)).toBeGreaterThan(1);
  expect(seen && moved && Math.hypot(seen.x - moved.x, seen.z - moved.z)).toBeLessThan(0.5);

  // Monsters are where the host has them.
  const [hm, fm] = await Promise.all([host.page, friend.page].map((p) => p.evaluate(() => window.__shikaar?.state.monsters.map((m) => [m.x, m.z]) ?? [])));
  hm.forEach(([x, z], i) => expect(Math.hypot(x - fm[i][0], z - fm[i][1])).toBeLessThan(2));

  // Everyone out: both get the results; the host starts the next round for both.
  await host.page.bringToFront();
  await host.page.evaluate(() => {
    const p = window.__shikaar;
    if (!p) return;
    for (const q of p.state.players) q.status = "escaped" as never;
  });
  await expect(host.page.getByTestId("results")).toBeVisible({ timeout: 15_000 });
  await friend.page.bringToFront();
  await expect(friend.page.getByTestId("results")).toBeVisible({ timeout: 15_000 });
  await expect(friend.page.getByText("Host agla round shuru karega")).toBeVisible();
  await host.page.bringToFront();
  await host.page.getByTestId("play-again").click();
  await expect(friend.page.getByTestId("game-screen")).toBeVisible({ timeout: 15_000 });
  await inRound(friend.page);
  await host.page.waitForFunction(() => window.__shikaar?.state.phase === "intro");
  await host.page.waitForTimeout(800);
  await host.page.evaluate(() => {
    const p = window.__shikaar;
    if (p) p.state.phaseTimer = 0;
  });
  await expect(host.page.getByTestId("hud")).toBeVisible({ timeout: 15_000 });

  // The friend leaves the round: back in the room, and the host hears about it.
  await friend.page.bringToFront();
  await friend.page.keyboard.press("Escape");
  await friend.page.getByTestId("quit-round").click();
  await expect(friend.page.getByTestId("lobby")).toBeVisible();
  await host.page.bringToFront();
  await expect(host.page.getByText(/Priya ka connection toot gaya/)).toBeVisible({ timeout: 20_000 });

  expect(host.errors).toEqual([]);
  expect(friend.errors).toEqual([]);
});
