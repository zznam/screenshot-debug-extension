import { useStorage } from '@extension/shared';
import { debugModeStorage } from '@extension/storage';
import { Label, Switch } from '@extension/ui';

export const DebugToggle = () => {
  const isDebugEnabled = useStorage(debugModeStorage);

  const handleToggle = async (checked: boolean) => {
    await debugModeStorage.setDebugMode(checked);
  };

  return (
    <div className="mt-4 flex items-center justify-between rounded-lg border border-slate-200 bg-slate-100/20 px-3 py-2 dark:border-slate-700">
      <div className="flex flex-col">
        <Label htmlFor="debug-toggle" className="text-[12px] font-medium">
          Debug Records
        </Label>
        <span className="text-muted-foreground text-[10px]">Save JSON log with network requests</span>
      </div>
      <Switch id="debug-toggle" checked={isDebugEnabled ?? false} onCheckedChange={handleToggle} />
    </div>
  );
};
