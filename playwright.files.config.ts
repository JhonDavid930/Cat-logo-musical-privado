import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/attachments",
  workers: 1,
  timeout: 90000,
  use: {
    baseURL: "http://127.0.0.1:3002",
    headless: true,
    launchOptions: {
      executablePath:
        process.env.CHROME_PATH ||
        "C:/Program Files/Google/Chrome/Application/chrome.exe",
    },
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node scripts/run-files-test-server.mjs",
    url: "http://127.0.0.1:3002/api/health",
    reuseExistingServer: false,
    timeout: 30000,
  },
  reporter: "list",
});
