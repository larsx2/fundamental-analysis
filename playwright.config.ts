import { defineConfig } from "@playwright/test";

// Pictures of the company screens for the three slice companies, from a database
// built out of the committed extracts. A change that moves a pixel fails here
// until the pictures are looked at and saved again with `task screens:update`.
export default defineConfig({
  testDir: "screens",
  snapshotPathTemplate: "{testDir}/pictures/{arg}{ext}",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4120",
    viewport: { width: 1440, height: 1500 },
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
    colorScheme: "dark",
  },
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.002 } },
  webServer: {
    command:
      "bun scripts/screens-database.ts && DATABASE_FILE=data/screens.db bun --bun vp dev --port 4120 --strictPort",
    url: "http://127.0.0.1:4120/companies",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
