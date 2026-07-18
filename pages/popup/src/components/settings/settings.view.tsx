/* eslint-disable jsx-a11y/label-has-associated-control */
import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';

import { useStorage } from '@extension/shared';
import { captureSettingsStorage, themeStorage, domainSkipListStorage } from '@extension/storage';
import type { ExportFormat, ScreenshotFormat } from '@extension/storage';
import { Button } from '@extension/ui';

export const SettingsContent = ({ onBack }: { onBack: () => void }) => {
  const settings = useStorage(captureSettingsStorage);
  const theme = useStorage(themeStorage);
  const skipList = useStorage(domainSkipListStorage);
  const [newDomain, setNewDomain] = useState('');

  if (!settings) return null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8">
          <ArrowLeft size={16} />
        </Button>
        <h2 className="text-lg font-semibold">Settings</h2>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">Export Format</label>
          <select
            className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
            value={settings.exportFormat}
            onChange={e => captureSettingsStorage.updateSettings({ exportFormat: e.target.value as ExportFormat })}>
            <option value="individual">Individual Files</option>
            <option value="zip">Zip Bundle</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">Screenshot Format</label>
          <select
            className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
            value={settings.screenshotFormat}
            onChange={e =>
              captureSettingsStorage.updateSettings({ screenshotFormat: e.target.value as ScreenshotFormat })
            }>
            <option value="png">PNG</option>
            <option value="jpeg">JPEG</option>
          </select>
        </div>

        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">Include Performance Metrics</label>
          <input
            type="checkbox"
            checked={settings.includePerformance}
            onChange={e => captureSettingsStorage.updateSettings({ includePerformance: e.target.checked })}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">Data Retention</label>
          <select
            className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
            value={settings.retentionMinutes}
            onChange={e => captureSettingsStorage.updateSettings({ retentionMinutes: parseInt(e.target.value, 10) })}>
            <option value="0">Never auto-delete</option>
            <option value="5">Delete after 5 minutes</option>
            <option value="15">Delete after 15 minutes</option>
            <option value="60">Delete after 1 hour</option>
          </select>
        </div>

        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">Theme</label>
          <select
            className="border-input bg-background ml-4 w-full rounded-md border px-3 py-2 text-sm"
            value={theme}
            onChange={e => themeStorage.set(e.target.value as any)}>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="system">System</option>
          </select>
        </div>

        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">Auto-Screenshot on Error</label>
          <input
            type="checkbox"
            checked={settings.autoScreenshotOnError}
            onChange={e => captureSettingsStorage.updateSettings({ autoScreenshotOnError: e.target.checked })}
          />
        </div>

        <div className="mt-2 flex flex-col gap-1">
          <label className="text-sm font-medium">Domain Skip List</label>
          <div className="flex gap-2">
            <input
              type="text"
              className="border-input bg-background flex-1 rounded-md border px-3 py-2 text-sm"
              placeholder="example.com"
              value={newDomain}
              onChange={e => setNewDomain(e.target.value)}
            />
            <Button
              variant="outline"
              onClick={() => {
                if (newDomain) {
                  domainSkipListStorage.addDomain(newDomain);
                  setNewDomain('');
                }
              }}>
              Add
            </Button>
          </div>
          {skipList && skipList.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {skipList.map(domain => (
                <div key={domain} className="bg-secondary flex items-center gap-1 rounded-md px-2 py-1 text-xs">
                  {domain}
                  <button
                    onClick={() => domainSkipListStorage.removeDomain(domain)}
                    className="text-destructive font-bold">
                    &times;
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
