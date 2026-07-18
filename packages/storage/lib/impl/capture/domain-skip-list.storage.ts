import { createStorage } from '../../base/base.js';
import { StorageEnum } from '../../base/enums.js';
import type { BaseStorage } from '../../base/types.js';

const DEFAULT_DOMAINS: string[] = ['briehq.com'];

type DomainSkipListStorage = BaseStorage<string[]> & {
  addDomain: (domain: string) => Promise<void>;
  removeDomain: (domain: string) => Promise<void>;
  isDomainSkipped: (url: string) => Promise<boolean>;
};

const storage = createStorage<string[]>('domain-skip-list-storage-key', DEFAULT_DOMAINS, {
  storageEnum: StorageEnum.Local,
});

export const domainSkipListStorage: DomainSkipListStorage = {
  ...storage,
  addDomain: async (domain: string) => {
    const current = await storage.get();
    if (!current.includes(domain)) {
      await storage.set([...current, domain]);
    }
  },
  removeDomain: async (domain: string) => {
    const current = await storage.get();
    await storage.set(current.filter((d: string) => d !== domain));
  },
  isDomainSkipped: async (url: string) => {
    try {
      const urlObj = new URL(url);
      const host = urlObj.hostname;
      const domains = await storage.get();
      return domains.some(domain => host.includes(domain));
    } catch {
      return false;
    }
  },
};
