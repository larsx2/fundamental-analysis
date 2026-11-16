import { defineConfig } from "@playwright/test";
import { screensPort } from "./screens/port";

// Nothing here may reach the SEC, Wikidata or FRED. The preload answers every outside
// request itself, the dead proxy stops one that somehow got past it, and the run
// stops before any test unless the log shows the server started with the preload.
const noProxy = "NO_PROXY=127.0.0.1,localhost,[::1]";
const deadProxy = "HTTP_PROXY=http://127.0.0.1:9 HTTPS_PROXY=http://127.0.0.1:9";

const server = [
  "unset SEC_CONTACT_NAME SEC_CONTACT_EMAIL",
  "bun scripts/screens-database.ts --made-up",
  "rm -f data/no-network.log",
  `DATABASE_FILE=data/screens.db BUN_OPTIONS=--preload=./screens/no-network.ts ${deadProxy} ${noProxy} bun --bun vp dev --port ${screensPort} --strictPort`,
].join(" && ");

// Browser tests of the screens, against a database built out of the committed
// extracts. Pictures of the company screens for the three slice companies are among
// them: a change that moves a pixel fails there until the pictures are looked at
// and saved again with `task screens:update`.
export default defineConfig({
  testDir: "screens",
  globalSetup: "./screens/network-log.ts",
  snapshotPathTemplate: "{testDir}/pictures/{arg}{ext}",
  // Three tests at a time, which takes a run from about 27 seconds to 13.
  // Collecting a company writes to the shared database and makes every open
  // screen show a notice, so it runs on its own, after the others.
  fullyParallel: true,
  workers: process.env.CI ? 2 : 3,
  projects: [
    { name: "screens", testIgnore: /collect\.spec\.ts/ },
    { name: "collect", testMatch: /collect\.spec\.ts/, dependencies: ["screens"] },
  ],
  reporter: "list",
  use: {
    baseURL: `http://127.0.0.1:${screensPort}`,
    viewport: { width: 1440, height: 1500 },
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
    colorScheme: "dark",
  },
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.002 } },
  webServer: {
    command: server,
    url: `http://127.0.0.1:${screensPort}/companies`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
