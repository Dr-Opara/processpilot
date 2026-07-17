import { defineConfig, devices } from "@playwright/test";

const PORT = process.env.PORT ?? "3000";

// Prefer the Codespaces forwarded URL when running in a Codespace so tests
// exercise the same origin a reviewer would see in the browser.
const codespaceUrl = process.env.CODESPACE_NAME
  ? `https://${process.env.CODESPACE_NAME}-${PORT}.${
      process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN ?? "app.github.dev"
    }`
  : undefined;

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? codespaceUrl ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: "npm run dev",
        url: `http://localhost:${PORT}`,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
