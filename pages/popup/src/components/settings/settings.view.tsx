import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';

import { useStorage } from '@extension/shared';
import { captureSettingsStorage, themePreferenceStorage, domainSkipListStorage } from '@extension/storage';
import type { CaptureSettings, ExportFormat, ScreenshotFormat, ThemePreference } from '@extension/storage';
import { Button } from '@extension/ui';

const controlClass = 'border-input bg-background w-full rounded-md border px-3 py-2 text-sm';

export const SettingsContent = ({ onBack }: { onBack: () => void }) => {
  const settings = useStorage(captureSettingsStorage);
  const theme = useStorage(themePreferenceStorage);
  const skipList = useStorage(domainSkipListStorage);
  const [newDomain, setNewDomain] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [addingDomain, setAddingDomain] = useState(false);

  const save = async (operation: () => Promise<void>, message = 'Settings saved.') => {
    setError('');
    setStatus('');
    try {
      await operation();
      setStatus(message);
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save settings.');
      return false;
    }
  };
  const update = (partial: Partial<CaptureSettings>) => void save(() => captureSettingsStorage.updateSettings(partial));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Button aria-label="Back to capture" variant="ghost" size="icon" onClick={onBack} className="h-8 w-8">
          <ArrowLeft size={16} />
        </Button>
        <h2 className="text-lg font-semibold">Settings</h2>
      </div>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      <p role="status" className="text-muted-foreground text-xs">
        {status}
      </p>
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="export-format" className="text-sm font-medium">
            Export Format
          </label>
          <select
            id="export-format"
            className={controlClass}
            value={settings.exportFormat}
            onChange={e => update({ exportFormat: e.target.value as ExportFormat })}>
            <option value="individual">Individual Files</option>
            <option value="zip">Zip Bundle</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="screenshot-format" className="text-sm font-medium">
            Screenshot Format
          </label>
          <select
            id="screenshot-format"
            className={controlClass}
            value={settings.screenshotFormat}
            onChange={e => update({ screenshotFormat: e.target.value as ScreenshotFormat })}>
            <option value="png">PNG</option>
            <option value="jpeg">JPEG</option>
          </select>
        </div>
        {settings.screenshotFormat === 'jpeg' && (
          <div className="flex flex-col gap-1">
            <label htmlFor="screenshot-quality" className="text-sm font-medium">
              JPEG Quality: {settings.screenshotQuality}%
            </label>
            <input
              id="screenshot-quality"
              type="range"
              min="50"
              max="100"
              step="5"
              value={settings.screenshotQuality}
              onChange={e => update({ screenshotQuality: Number(e.target.value) })}
            />
            <p className="text-muted-foreground text-xs">Lower quality produces smaller screenshot files.</p>
          </div>
        )}
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="include-performance" className="text-sm font-medium">
            Include Performance Metrics
          </label>
          <input
            id="include-performance"
            type="checkbox"
            checked={settings.includePerformance}
            onChange={e => update({ includePerformance: e.target.checked })}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="retention" className="text-sm font-medium">
            Data Retention
          </label>
          <select
            id="retention"
            className={controlClass}
            value={settings.retentionMinutes}
            onChange={e => update({ retentionMinutes: Number(e.target.value) })}>
            <option value="0">Never auto-delete</option>
            <option value="5">Delete after 5 minutes</option>
            <option value="15">Delete after 15 minutes</option>
            <option value="60">Delete after 1 hour</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="theme-preference" className="text-sm font-medium">
            Theme
          </label>
          <select
            id="theme-preference"
            className={controlClass}
            value={theme}
            onChange={e => void save(() => themePreferenceStorage.set(e.target.value as ThemePreference))}>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="system">System</option>
          </select>
        </div>
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="auto-screenshot" className="text-sm font-medium">
            Auto-Screenshot on Error
          </label>
          <input
            id="auto-screenshot"
            type="checkbox"
            checked={settings.autoScreenshotOnError}
            onChange={e => update({ autoScreenshotOnError: e.target.checked })}
          />
        </div>
        <form
          className="mt-2 flex flex-col gap-1"
          onSubmit={async event => {
            event.preventDefault();
            if (addingDomain) return;
            setAddingDomain(true);
            if (await save(() => domainSkipListStorage.addDomain(newDomain), 'Domain added.')) setNewDomain('');
            setAddingDomain(false);
          }}>
          <label htmlFor="skip-domain" className="text-sm font-medium">
            Domain Skip List
          </label>
          <p id="skip-domain-help" className="text-muted-foreground text-xs">
            Stops new diagnostics and Rewind on this domain and its subdomains. Manual screenshots remain available.
          </p>
          <div className="flex gap-2">
            <input
              id="skip-domain"
              type="text"
              className={`${controlClass} min-w-0 flex-1`}
              placeholder="example.com"
              aria-describedby="skip-domain-help"
              value={newDomain}
              onChange={e => setNewDomain(e.target.value)}
            />
            <Button type="submit" variant="outline" disabled={!newDomain.trim() || addingDomain}>
              Add
            </Button>
          </div>
        </form>
        {!!skipList.length && (
          <ul className="flex flex-wrap gap-2" aria-label="Skipped domains">
            {skipList.map(domain => (
              <li key={domain} className="bg-secondary flex max-w-full items-center gap-1 rounded-md px-2 py-1 text-xs">
                <span className="break-all">{domain}</span>
                <button
                  type="button"
                  aria-label={`Remove ${domain}`}
                  onClick={() => void save(() => domainSkipListStorage.removeDomain(domain), 'Domain removed.')}
                  className="text-destructive h-8 w-8 shrink-0 font-bold">
                  &times;
                </button>
              </li>
            ))}
          </ul>
        )}
        <Button
          variant="outline"
          onClick={() =>
            void save(() => captureSettingsStorage.resetSettings(), 'Capture settings restored to defaults.')
          }>
          Reset capture settings
        </Button>
        <p className="text-muted-foreground text-xs">
          Reset restores capture and export options. Your theme and skipped domains are kept.
        </p>
      </div>
    </div>
  );
};
