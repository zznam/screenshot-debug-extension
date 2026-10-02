import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

const script = resolve(import.meta.dirname, '../../bash-scripts/set_global_env.sh');
const directories: string[] = [];
const fixture = () => {
  const cwd = mkdtempSync(resolve(tmpdir(), 'capture-env-'));
  directories.push(cwd);
  writeFileSync(resolve(cwd, '.example.env'), 'NAME=Screenshot & Debug\n');
  return cwd;
};
const run = (cwd: string, ...args: string[]) => execFileSync('bash', [script, ...args], { cwd, stdio: 'pipe' });
afterEach(() => directories.splice(0).forEach(directory => rmSync(directory, { recursive: true, force: true })));

describe('build environment', () => {
  it.each(['development', 'production'])('builds %s from tracked defaults on a clean checkout', environment => {
    const cwd = fixture();
    run(cwd, `CLI_ENV=${environment}`);
    const output = readFileSync(resolve(cwd, '.env'), 'utf8');
    expect(output).toContain(`CLI_ENV=${environment}`);
    expect(output).toContain('NAME=Screenshot & Debug');
    expect(output).toContain('CLI_DEV=false');
  });

  it('preserves local values without allowing them to override build flags', () => {
    const cwd = fixture();
    const local = 'CLI_DEV=true\nexport CLI_FIREFOX=true\nNAME=Custom\n';
    writeFileSync(resolve(cwd, '.env.production'), local);
    run(cwd, 'CLI_ENV=production', 'CLI_DEV=false', 'CLI_FIREFOX=false', 'CLI_FEATURE=test');
    const output = readFileSync(resolve(cwd, '.env'), 'utf8');
    expect(output).toContain('NAME=Custom');
    expect(output).toContain('CLI_FEATURE=test');
    expect(output.match(/^CLI_DEV=/gm)).toHaveLength(1);
    expect(output).not.toContain('CLI_FIREFOX=true');
    expect(readFileSync(resolve(cwd, '.env.production'), 'utf8')).toBe(local);
  });

  it.each(['CLI_ENV=../../private', 'CLI_DEV=perhaps', 'NAME=wrong', 'CLI_BAD', 'CLI_X=one\ntwo'])(
    'rejects invalid setting %s without overwriting the existing file',
    setting => {
      const cwd = fixture();
      writeFileSync(resolve(cwd, '.env'), 'keep me');
      expect(() => run(cwd, setting)).toThrow();
      expect(readFileSync(resolve(cwd, '.env'), 'utf8')).toBe('keep me');
    },
  );
});
