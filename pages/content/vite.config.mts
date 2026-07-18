import { resolve } from 'node:path';
import type { Plugin } from 'vite';
import { makeEntryPointPlugin } from '@extension/hmr';
import { withPageConfig } from '@extension/vite-config';
import { IS_DEV } from '@extension/env';

const rootDir = resolve(import.meta.dirname);
const srcDir = resolve(rootDir, 'src');

const classicContentScriptPlugin = {
  name: 'classic-content-script',
  generateBundle(_options, bundle) {
    const chunk = bundle['index.iife.js'];
    if (!chunk || chunk.type !== 'chunk') return;

    chunk.code = chunk.code.replace(
      /\nexport default ([A-Za-z_$][\w$]*)\(\);\s*$/,
      (_statement, entryFunction: string) => `\n${entryFunction}();\n`,
    );
  },
} satisfies Plugin;

export default withPageConfig({
  resolve: {
    alias: {
      '@src': srcDir,
    },
  },
  publicDir: resolve(rootDir, 'public'),
  plugins: [IS_DEV && makeEntryPointPlugin(), classicContentScriptPlugin],
  build: {
    minify: false,
    rollupOptions: {
      input: {
        index: resolve(rootDir, 'src/index.ts'),
        extend: resolve(rootDir, 'src/interceptors/index.ts'),
      },
      output: {
        entryFileNames: '[name].iife.js',
        manualChunks: undefined,
        inlineDynamicImports: false,
      },
    },
    outDir: resolve(rootDir, '..', '..', 'dist', 'content'),
  },
});
