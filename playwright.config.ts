import { defineConfig, devices } from "@playwright/test";

const configuredPort = Number(process.env.PLAYWRIGHT_PORT);
const port = Number.isFinite(configuredPort)
  ? configuredPort
  : process.env.CI
    ? 5174
    : 5173;
const serverUrl = `http://127.0.0.1:${port}`;
const serverCommand = process.env.CI
  ? `yarn run preview --host 127.0.0.1 --port ${port}`
  : `yarn run dev --host 127.0.0.1 --port ${port}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "line" : "list",
  expect: {
    toHaveScreenshot: {
      animations: "disabled",
      caret: "hide",
      scale: "css",
      threshold: 0.2,
      maxDiffPixelRatio: 0.001,
    },
  },
  use: {
    baseURL: serverUrl,
    colorScheme: "light",
    locale: "ko-KR",
    reducedMotion: "reduce",
    timezoneId: "Asia/Seoul",
    trace: "on-first-retry",
  },
  webServer: {
    command: serverCommand,
    url: serverUrl,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 900 },
      },
    },
    {
      name: "mobile-chromium",
      testMatch: /.*\.visual\.spec\.ts/,
      use: { ...devices["Pixel 5"] },
    },
  ],
});
