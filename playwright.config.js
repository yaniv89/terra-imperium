// playwright.config.js
// Plan §13's "Playability" check: a real browser drives the app end-to-end, not just the pure
// engine. Runs against the mobile build (vite.config.mobile.js) rather than the GitHub Pages one
// (vite.config.js) because the mobile config serves from the root path ('/'), so there's no
// base-path subtlety for the test's navigation/selectors to account for — it's just a convenient,
// already-existing build target for this purpose, not a claim about mobile behavior specifically.
import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

export default defineConfig({
  testDir: './e2e',
  timeout: 60000,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    // This sandbox's Chromium lives outside the default Playwright browser cache (see
    // PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH in the environment, set only for local/manual runs
    // here) — CI leaves this unset and relies on its own `playwright install` step instead, so no
    // sandbox-specific path is ever committed.
    launchOptions: {
      ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
        ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
        : {}),
      // The globe (react-globe.gl / three-globe, a real WebGL scene) is on-screen from the moment
      // a game starts. Headless Chromium without a real GPU can fall back to a software GL path
      // that pegs the render thread hard enough to make the page appear to hang to CDP — swapping
      // in SwiftShader explicitly (a real, correct software GL implementation, not a hack) is the
      // standard fix for exactly this class of symptom in CI/sandboxed headless environments.
      args: ['--use-gl=swiftshader', '--ignore-gpu-blocklist', '--enable-webgl']
    }
  },
  webServer: {
    command: `npm run build:mobile && npx vite preview --config vite.config.mobile.js --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120000
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } }
  ]
});
