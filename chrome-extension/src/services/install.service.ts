import type { Runtime } from 'webextension-polyfill';

import { addContextMenus } from './menus.service';

export const handleOnInstalled = async ({ reason }: Runtime.OnInstalledDetailsType) => {
  try {
    if (reason === 'install') {
      /**
       * @todo
       * Open a welcome page
       * await tabs.create({ url: 'welcome.html' });
       */
    }

    await addContextMenus();
  } catch (e) {
    console.error('[background] onInstalled error:', e);
  }
};
