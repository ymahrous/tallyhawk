import { defineConfig, devices } from "@playwright/test";
import { E2E_API_URL } from "./e2e/support/constants";

const PORT = Number(process.env.E2E_PORT ?? 3100);
const BASE_URL = `http://localhost:${PORT}`;

// E2E runs against a production build. The backend is never contacted: NEXT_PUBLIC_API_URL points
// at a reserved .test origin and every spec intercepts it with page.route() (see e2e/support).
// The build goes to .next-e2e so it can't clobber a real `.next` built against the real API.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  expect: { timeout: 10_000 },
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"] },
      // Layout-sensitive journeys only; crawler/metadata checks don't depend on the viewport.
      testMatch: /(marketing|auth|dashboard)\.spec\.ts/,
    },
  ],
  webServer: {
    command: `npm run build && npx next start --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    env: {
      NEXT_DIST_DIR: ".next-e2e",
      NEXT_PUBLIC_API_URL: E2E_API_URL,
      NEXT_PUBLIC_S3_BUCKET_URL: "bucket.tallyhawk.test",
      NEXT_TELEMETRY_DISABLED: "1",
    },
  },
});
