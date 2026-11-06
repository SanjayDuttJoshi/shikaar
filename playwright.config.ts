import { defineConfig } from "@playwright/test";

const PORT = 4184;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: `http://localhost:${PORT}`,
    channel: process.env.PW_BUNDLED ? undefined : "chrome",
    viewport: { width: 1280, height: 760 },
  },
  webServer: {
    command: `PORT=${PORT} node scripts/serve.mts`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
  },
});
