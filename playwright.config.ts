import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 45000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    reducedMotion: "reduce",
    launchOptions: { executablePath: process.env.DEVFLOW_TEST_EXECUTABLE_PATH },
  },
  webServer: {
    command: "node tests/e2e/server.mjs",
    url: "http://localhost:3000/login",
    reuseExistingServer: false,
    timeout: 120000,
  },
  projects: [
    {
      name: "dashboard",
      testMatch: "dashboard.spec.ts",
      use: {
        ...devices["Desktop Chrome"],
        channel: process.env.DEVFLOW_TEST_CHANNEL || "chromium",
      },
    },
    {
      name: "mobile",
      testMatch: "mobile.spec.ts",
      use: {
        ...devices["iPhone 13"],
        defaultBrowserType: "chromium",
        channel: process.env.DEVFLOW_TEST_CHANNEL || "chromium",
      },
    },
    { name: "extension", testMatch: "extension.spec.ts" },
  ],
});
