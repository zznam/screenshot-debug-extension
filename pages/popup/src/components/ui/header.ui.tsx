import { t } from '@extension/i18n';
import { Button, Icon } from '@extension/ui';

import { navigateTo } from '@src/utils';

export const Header = () => {
  const logo = chrome.runtime.getURL('popup/logo.png');

  return (
    <header className="mb-4 flex items-center justify-between">
      <div className="flex items-center gap-x-2">
        <img src={logo} className="size-10" alt={t('extensionName')} />

        <h1 className="text-sm font-semibold">{t('extensionName')}</h1>
      </div>
      <div className="flex items-center">
        <Button
          title="View the source code on GitHub"
          type="button"
          size="icon"
          variant="ghost"
          className="hover:bg-slate-50 dark:hover:text-black"
          onClick={() => navigateTo('https://github.com/zznam/screenshot-debug-extension')}>
          <Icon name="GitHubLogoIcon" size={20} className="size-4" />
        </Button>
      </div>
    </header>
  );
};
