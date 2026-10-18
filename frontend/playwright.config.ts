import { defineConfig } from '@playwright/test';

const targets = (process.env.EO_TARGETS ?? 'local,portfolio,store,agent').split(',');
const needsLocal = targets.includes('local');

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'tests/results/playwright-report' }]],
  outputDir: 'tests/results/playwright-artifacts',
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'gate1-extension',
      testDir: './tests/e2e/extension',
      workers: process.env.CI ? 1 : 2,
    },
    {
      name: 'gate2-smoke',
      testDir: './tests/e2e/smoke',
      use: { baseURL: process.env.BASE_URL },
    },
  ],
  webServer: needsLocal
    ? {
        command: 'npm run build:docs && npx vite preview --config vite.demo.config.ts --port 4173 --strictPort --host 127.0.0.1',
        url: 'http://127.0.0.1:4173/',
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      }
    : undefined,
});
