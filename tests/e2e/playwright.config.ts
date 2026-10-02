import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './specs',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 15_000 },
  outputDir: 'test-results',
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'node --experimental-strip-types ./fixtures/server.mjs',
    url: 'http://127.0.0.1:4174/health',
    reuseExistingServer: !process.env.CI,
    timeout: 10_000,
  },
});
