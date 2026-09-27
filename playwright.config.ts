import { defineConfig, devices } from '@playwright/test';

const fixtures = new URL('./tests/e2e/fixtures/', import.meta.url).pathname;

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 90_000,
  use: {
    ...devices['Pixel 7'],
    baseURL: 'http://localhost:4173',
    permissions: ['camera'],
    // Service worker omija page.route() — w testach atrapy API muszą widzieć każde zapytanie.
    serviceWorkers: 'block',
    launchOptions: {
      executablePath: process.env.PW_CHROMIUM_PATH || undefined,
      args: [
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        `--use-file-for-fake-video-capture=${fixtures}camera.y4m`,
      ],
    },
  },
  webServer: {
    command: 'npx vite preview --port 4173 --strictPort',
    port: 4173,
    reuseExistingServer: true,
  },
});
