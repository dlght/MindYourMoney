import { existsSync, readFileSync } from "fs";
import path from "path";
import { defineConfig, devices } from "@playwright/test";

// No dotenv dependency (constitution III, free-tier/minimal-deps
// discipline) — a small inline loader for .env.e2e is enough. Runs once in
// the main process before workers spawn, so `process.env` here is
// inherited by every worker (research.md #3 / T011's fixture reads these).
const envPath = path.resolve(__dirname, ".env.e2e");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      const [, key, value] = match;
      if (!(key.trim() in process.env)) {
        process.env[key.trim()] = value.trim();
      }
    }
  }
}

const PORT = 4173;
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

// Drives the web/PWA build (see specs/006-pwa-e2e-layout-fix/research.md #3):
// against a locally-served `dist/` export by default, or against
// E2E_BASE_URL (e.g. the deployed Netlify site) when set.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    viewport: { width: 390, height: 844 },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // Only used when E2E_BASE_URL isn't set (i.e. testing a local build) —
  // builds and serves `dist/` so the suite always runs against the same
  // static export a real deploy would produce, not the Metro dev server.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `npm run build:web && npx serve -p ${PORT} -s dist`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      },
});
