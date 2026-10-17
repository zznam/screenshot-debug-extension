import { cp, mkdir, readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';

import { withPageConfig } from '@extension/vite-config';

const rootDir = resolve(import.meta.dirname);
const require = createRequire(import.meta.url);
const tesseract = dirname(require.resolve('tesseract.js/package.json'));
const core = dirname(createRequire(require.resolve('tesseract.js')).resolve('tesseract.js-core/package.json'));
const language = dirname(require.resolve('@tesseract.js-data/eng/package.json'));
export default withPageConfig({
  plugins: [
    {
      name: 'bundle-offline-ocr',
      async writeBundle() {
        const destination = resolve(rootDir, '../../dist/library/ocr');
        await mkdir(destination, { recursive: true });
        await cp(resolve(tesseract, 'dist/worker.min.js'), resolve(destination, 'worker.min.js'));
        for (const file of await readdir(core)) {
          if (/^tesseract-core(?:-(?:simd|relaxedsimd))?-lstm\.wasm(?:\.js)?$/.test(file))
            await cp(resolve(core, file), resolve(destination, file));
        }
        await cp(resolve(language, '4.0.0_best_int/eng.traineddata.gz'), resolve(destination, 'eng.traineddata.gz'));
        await cp(resolve(tesseract, 'LICENSE.md'), resolve(destination, 'TESSERACT-LICENSE.md'));
        await cp(resolve(core, 'LICENSE'), resolve(destination, 'TESSERACT-CORE-LICENSE'));
        await cp(
          resolve(tesseract, 'dist/worker.min.js.LICENSE.txt'),
          resolve(destination, 'worker.min.js.LICENSE.txt'),
        );
      },
    },
  ],
  resolve: { alias: { '@src': resolve(rootDir, 'src') } },
  build: { outDir: resolve(rootDir, '..', '..', 'dist', 'library') },
});
