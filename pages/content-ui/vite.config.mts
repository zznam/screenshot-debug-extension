import { cp, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { build as bundleWorker } from 'esbuild';
import { makeEntryPointPlugin } from '@extension/hmr';
import { withPageConfig } from '@extension/vite-config';
import { IS_DEV } from '@extension/env';

const rootDir = resolve(import.meta.dirname);
const srcDir = resolve(rootDir, 'src');
const require = createRequire(import.meta.url);

export default withPageConfig({
  resolve: {
    alias: {
      '@src': srcDir,
    },
  },
  plugins: [
    IS_DEV && makeEntryPointPlugin(),
    {
      name: 'bundle-offline-video-encoder',
      async writeBundle() {
        const destination = resolve(rootDir, '../../dist/content-ui/ffmpeg');
        const core = dirname(require.resolve('@ffmpeg/core'));
        await mkdir(destination, { recursive: true });
        await Promise.all([
          cp(resolve(rootDir, 'FFMPEG-NOTICES.md'), resolve(destination, 'FFMPEG-NOTICES.md')),
          cp(resolve(core, '../esm/ffmpeg-core.js'), resolve(destination, 'ffmpeg-core.js')),
          cp(resolve(core, '../esm/ffmpeg-core.wasm'), resolve(destination, 'ffmpeg-core.wasm')),
          bundleWorker({
            entryPoints: [require.resolve('@ffmpeg/ffmpeg/worker')],
            outfile: resolve(destination, 'ffmpeg-worker.js'),
            bundle: true,
            format: 'esm',
            platform: 'browser',
            minify: true,
          }),
        ]);
      },
    },
  ],
  publicDir: resolve(rootDir, 'public'),
  build: {
    lib: {
      name: 'contentUI',
      fileName: 'index',
      formats: ['iife'],
      entry: resolve(srcDir, 'index.tsx'),
    },
    outDir: resolve(rootDir, '..', '..', 'dist', 'content-ui'),
  },
});
