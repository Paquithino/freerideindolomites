import { defineConfig, devices } from "@playwright/test";

/* Test del sito nel browser: desktop, Android e iPhone.
   - npm test            → test veloci (logica) + test nel browser
   - npm run test:e2e    → solo browser   (aggiungi -- --project=mobile per un solo dispositivo)
   - npm run test:ui     → interfaccia grafica per vedere i test passo passo
   Tutto gira offline: le fonti esterne (Open-Meteo, bollettini, webcam) vengono simulate. */
const PORT = 4317;
const chrome = process.env.CHROME_PATH ? {launchOptions: {executablePath: process.env.CHROME_PATH}} : {};

export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/e2e/setup.mjs",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", {open: "never"}]] : [["list"], ["html", {open: "on-failure"}]],
  timeout: 30_000,
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "it-IT", timezoneId: "Europe/Rome",
    screenshot: "only-on-failure", trace: "retain-on-failure"
  },
  projects: [
    {name: "desktop", use: {...devices["Desktop Chrome"], viewport: {width: 1366, height: 900}, ...chrome}},
    {name: "mobile", use: {...devices["Pixel 7"], ...chrome}},
    {name: "piccolo", use: {...devices["Pixel 7"], viewport: {width: 340, height: 700}, ...chrome}},   // telefoni stretti (es. iPhone SE)
    {name: "iphone", use: {...devices["iPhone 14"]}}                                                    // Safari vero (WebKit)
  ],
  webServer: {command: `node tests/server.mjs`, env: {PORT: String(PORT)}, url: `http://localhost:${PORT}/index.html`, reuseExistingServer: !process.env.CI}
});
