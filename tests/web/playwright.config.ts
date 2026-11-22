import { defineConfig, devices } from "@playwright/test";

// Where the web app is served. CI sets CUE_WEB_URL; locally it falls back to a static server on port 8081.
const baseURL = process.env.CUE_WEB_URL || "http://localhost:8081";
const isCI = !!process.env.CI;

export default defineConfig({
  testDir: ".",
  testMatch: "*.spec.ts",
  // Stop a CI run from passing if someone leaves test.only in a file.
  forbidOnly: isCI,
  // One retry in CI, so a single slow moment does not fail the PR.
  retries: isCI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  outputDir: "test-results",
  use: {
    baseURL,
    // Desktop size on purpose: phone-sized windows show the "Get Cue Clock on Android" cover instead of the app.
    viewport: { width: 1280, height: 800 },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } }],
});
