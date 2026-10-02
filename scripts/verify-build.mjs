import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { resolve, relative, isAbsolute } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const dist = resolve(root, 'dist');
const manifest = JSON.parse(await readFile(resolve(dist, 'manifest.json'), 'utf8'));
const pkg = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
assert.equal(manifest.manifest_version, 3, 'Chrome build must use Manifest V3');
assert.equal(manifest.version, pkg.version, 'Manifest version must match package.json');
assert.equal(manifest.background?.service_worker, 'background.js');
assert.equal(manifest.background?.type, 'module');
assert.ok(
  !manifest.content_security_policy?.extension_pages?.includes('unsafe-eval'),
  'Production CSP must not allow eval',
);

const files = [
  manifest.background.service_worker,
  manifest.action.default_popup,
  ...Object.values(manifest.icons ?? {}),
  ...(manifest.content_scripts ?? []).flatMap(script => [...(script.js ?? []), ...(script.css ?? [])]),
  ...(manifest.web_accessible_resources ?? []).flatMap(entry => entry.resources.filter(file => !file.includes('*'))),
  `_locales/${manifest.default_locale}/messages.json`,
  'ai-debug/index.html',
  'mic-permission/index.html',
];
for (const file of files) {
  const path = resolve(dist, file);
  assert.ok(!relative(dist, path).startsWith('..') && !isAbsolute(file), `Invalid manifest path: ${file}`);
  const asset = await stat(path);
  assert.ok(asset.isFile() && (asset.size > 0 || file.endsWith('.css')), `Missing or empty build asset: ${file}`);
}
const entries = await readdir(dist, { recursive: true });
assert.ok(
  !entries.some(file => /(?:^|\/)\.env(?:\.|$)|\.map$|\.spec\.[cm]?[jt]sx?$/.test(file)),
  'Build includes private or development files',
);
console.log(`Verified Chrome ${manifest.version}: ${new Set(files).size} required assets.`);
