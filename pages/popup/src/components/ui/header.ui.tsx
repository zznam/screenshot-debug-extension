import { IS_DEV, NAME } from '@extension/env';
import { Button, Icon } from '@extension/ui';

import { navigateTo } from '@src/utils';

export const Header = () => {
  const logo = chrome.runtime.getURL('popup/logo.png');

  return (
    <header className="mb-4 flex items-center justify-between">
      <div className="flex items-center gap-x-2">
        <img src={logo} className="size-10" alt="Screenshot & Debug" />

        <h1 className="text-sm font-semibold">Screenshot & Debug</h1>
      </div>
      <div className="flex items-center">
        <Button
          title="View the source code on GitHub"
          type="button"
          size="icon"
          variant="ghost"
          className="hover:bg-slate-50 dark:hover:text-black"
          onClick={() => navigateTo('https://github.com')}>
          <Icon name="GitHubLogoIcon" size={20} className="size-4" />
        </Button>
      </div>
    </header>
  );
};
