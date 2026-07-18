import { resolve } from 'node:path';

import { withPageConfig } from '@extension/vite-config';

const rootDir = resolve(import.meta.dirname);

export default withPageConfig({
  resolve: { alias: { '@src': resolve(rootDir, 'src') } },
  build: { outDir: resolve(rootDir, '..', '..', 'dist', 'ai-debug') },
});
