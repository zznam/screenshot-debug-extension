import { createStorage } from '../../base/base.js';
import { StorageEnum } from '../../base/enums.js';
import type { BaseStorage } from '../../base/types.js';

const normalizeDomain = (input: string): string => {
  const value = input.trim();
  if (!value || /[\s*]/.test(value)) throw new Error('Enter a domain or an HTTP(S) URL, such as example.com.');
  let url: URL;
  try {
    url = new URL(value.includes('://') ? value : `https://${value}`);
  } catch {
    throw new Error('Enter a valid domain, such as example.com.');
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || !url.hostname) {
    throw new Error('Enter a domain or an HTTP(S) URL without credentials.');
  }
  return url.hostname.toLowerCase().replace(/\.$/, '');
};

const matchesSkippedDomain = (url: string, domains: string[]): boolean => {
  try {
    const hostname = new URL(url).hostname.toLowerCase().replace(/\.$/, '');
    return domains.some(domain => {
      try {
        const normalized = normalizeDomain(domain);
        return hostname === normalized || hostname.endsWith(`.${normalized}`);
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
};

type DomainSkipListStorage = BaseStorage<string[]> & {
  addDomain: (domain: string) => Promise<void>;
  removeDomain: (domain: string) => Promise<void>;
  isDomainSkipped: (url: string) => Promise<boolean>;
};

const storage = createStorage<string[]>('domain-skip-list-storage-key', [], {
  storageEnum: StorageEnum.Local,
  liveUpdate: true,
});

const domainSkipListStorage: DomainSkipListStorage = {
  ...storage,
  addDomain: async domain => {
    const normalized = normalizeDomain(domain);
    await storage.set(current => {
      const valid = current.flatMap(existing => {
        try {
          return [normalizeDomain(existing)];
        } catch {
          return [];
        }
      });
      return Array.from(new Set([...valid, normalized]));
    });
  },
  removeDomain: async domain => {
    await storage.set(current => current.filter(existing => existing !== domain));
  },
  isDomainSkipped: async url => matchesSkippedDomain(url, await storage.get()),
};

export { domainSkipListStorage, normalizeDomain, matchesSkippedDomain };
