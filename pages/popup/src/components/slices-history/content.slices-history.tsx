import { ArrowLeft } from 'lucide-react';

import { Button } from '@extension/ui';

export const SlicesHistoryContent = ({ onBack }: { onBack: () => void }) => {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8">
          <ArrowLeft size={16} />
        </Button>
        <h2 className="text-lg font-semibold">Capture library</h2>
      </div>
      <div className="flex flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="text-muted-foreground">Find saved screenshots and their debugging context on this device.</p>
        <Button onClick={() => void chrome.tabs.create({ url: chrome.runtime.getURL('library/index.html') })}>
          Open capture library
        </Button>
      </div>
    </div>
  );
};
