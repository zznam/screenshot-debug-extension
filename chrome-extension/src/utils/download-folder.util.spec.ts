import { describe, expect, it } from 'vitest';

import { expandDownloadFolder } from './download-folder.util';

const timestamp = new Date(2026, 10, 5, 23, 30).getTime();

describe('expandDownloadFolder', () => {
  it('leaves folders without placeholders untouched', () => {
    expect(expandDownloadFolder('', { timestamp, host: 'a.test' })).toBe('');
    expect(expandDownloadFolder('Bug reports', { timestamp, host: 'a.test' })).toBe('Bug reports');
  });

  it('fills the local capture date and the site host, case-insensitively', () => {
    expect(expandDownloadFolder('Bugs/{host}/{date}', { timestamp, host: 'App.Example.com:8443' })).toBe(
      'Bugs/app.example.com/2026-11-05',
    );
    expect(expandDownloadFolder('{DATE}-{Host}', { timestamp, host: 'x.test' })).toBe('2026-11-05-x.test');
  });

  it('never lets a host introduce path or reserved characters', () => {
    expect(expandDownloadFolder('{host}', { timestamp, host: '../evil/..\\x' })).toBe('evil-..-x');
    expect(expandDownloadFolder('{host}', { timestamp, host: '' })).toBe('unknown-site');
    expect(expandDownloadFolder('{host}', { timestamp, host: '[::1]:3000' })).toBe('1');
  });
});
