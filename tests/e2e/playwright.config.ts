import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './specs',
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 15_000 },
  outputDir: 'test-results',
  reporter: process.env.CI ? [['github'], ['line']] : 'list',
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'node ./fixtures/server.mjs',
    url: 'http://127.0.0.1:4174/health',
    reuseExistingServer: !process.env.CI,
    timeout: 10_000,
  },
});
