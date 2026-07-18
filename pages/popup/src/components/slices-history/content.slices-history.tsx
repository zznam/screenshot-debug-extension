import { ArrowLeft } from 'lucide-react';

import { Button } from '@extension/ui';

export const SlicesHistoryContent = ({ onBack }: { onBack: () => void }) => {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8">
          <ArrowLeft size={16} />
        </Button>
        <h2 className="text-lg font-semibold">Slices History</h2>
      </div>
      <div className="flex flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="text-muted-foreground">Slices history is disabled in offline mode.</p>
        <p className="text-muted-foreground text-sm">Your captures are saved directly to your local machine.</p>
      </div>
    </div>
  );
};
