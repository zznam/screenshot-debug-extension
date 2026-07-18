/* eslint-disable no-empty-pattern, react-hooks/rules-of-hooks */
import { resolve } from 'node:path';

import { chromium, test as base } from '@playwright/test';
import type { BrowserContext, Page, Worker } from '@playwright/test';

type ExtensionFixtures = {
  context: BrowserContext;
  extensionErrors: string[];
  extensionId: string;
  serviceWorker: Worker;
};

const extensionPath = resolve(import.meta.dirname, '../../..', 'dist');
const ignoredShadowDomWarnings = ['`DialogContent` requires a `DialogTitle`'];

export const test = base.extend<ExtensionFixtures>({
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      headless: true,
      args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
    });

    await use(context);
    await context.close();
  },

  serviceWorker: async ({ context }, use) => {
    let worker = context.serviceWorkers().find(candidate => candidate.url().endsWith('/background.js'));
    worker ??= await context.waitForEvent('serviceworker', {
      predicate: candidate => candidate.url().endsWith('/background.js'),
    });

    await use(worker);
  },

  extensionId: async ({ serviceWorker }, use) => {
    await use(new URL(serviceWorker.url()).host);
  },

  extensionErrors: async ({ context, serviceWorker }, use) => {
    const errors: string[] = [];
    const recordError = (message: string) => {
      // Radix's development-only title check uses document.getElementById, which cannot
      // see the DialogTitle inside the extension's shadow root.
      if (!ignoredShadowDomWarnings.some(warning => message.includes(warning))) errors.push(message);
    };
    const collectPageErrors = (page: Page) => {
      page.on('pageerror', error => recordError(error.message));
      page.on('console', message => {
        if (message.type() === 'error') recordError(message.text());
      });
    };

    context.pages().forEach(collectPageErrors);
    context.on('page', collectPageErrors);
    serviceWorker.on('console', message => {
      if (message.type() === 'error') recordError(message.text());
    });

    await use(errors);
  },
});

export { expect } from '@playwright/test';
