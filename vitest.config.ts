import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { defineConfig } from 'vitest/config';

// Resolve workspace packages to source so tests work before any build and
// coverage measures the code being edited, rather than stale generated files.
const packagesDirectory = resolve(import.meta.dirname, 'packages');
const workspaceAliases = readdirSync(packagesDirectory).flatMap(directory => {
  const entry = ['index.mts', 'index.ts'].map(name => resolve(packagesDirectory, directory, name)).find(existsSync);
  if (!entry) return [];
  const pkg = JSON.parse(readFileSync(resolve(packagesDirectory, directory, 'package.json'), 'utf8'));
  return [{ find: new RegExp(`^${pkg.name}$`), replacement: entry }];
});

export default defineConfig({
  resolve: { alias: workspaceAliases },
  test: {
    environment: 'node',
    maxWorkers: 4,
    exclude: ['**/node_modules/**', '**/dist/**', '**/tests/e2e/**', '**/.{idea,git,cache,output,temp}/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'html', 'lcov', 'json-summary'],
      include: [
        'chrome-extension/src/**/*.ts',
        'packages/{shared,storage,editor}/lib/**/*.{ts,tsx}',
        'packages/ai-helper/src/**/*.ts',
        'pages/*/src/**/*.{ts,tsx}',
      ],
      exclude: [
        '**/*.spec.ts',
        '**/*.test.ts',
        '**/*.d.ts',
        '**/index.ts',
        '**/interfaces/**',
        '**/types/**',
        '**/constants/**',
        '**/models/**',
        '**/utils/plugins/**',
      ],
      thresholds: {
        // Global floors include untested runtime files; critical boundaries have stronger gates.
        lines: 10,
        statements: 10,
        functions: 10,
        branches: 10,
        'packages/shared/lib/utils/redact-sensitive-info.util.ts': {
          lines: 90,
          statements: 90,
          functions: 90,
          branches: 90,
        },
        'packages/storage/lib/base/base.ts': { lines: 90, statements: 90, functions: 90, branches: 90 },
        'packages/ai-helper/src/server.ts': { lines: 90, statements: 90, functions: 90, branches: 90 },
        'pages/ai-debug/src/helper-client.ts': { lines: 90, statements: 90, functions: 90, branches: 90 },
        'chrome-extension/src/services/ai-debug.service.ts': { lines: 90, statements: 90, functions: 90, branches: 90 },
      },
    },
  },
});
