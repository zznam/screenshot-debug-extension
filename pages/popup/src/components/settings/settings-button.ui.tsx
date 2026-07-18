import { Settings } from 'lucide-react';

import { Button } from '@extension/ui';

export const SettingsButton = ({ onClick }: { onClick: () => void }) => {
  return (
    <Button variant="outline" className="mt-2 w-full justify-between" onClick={onClick}>
      <span className="flex items-center gap-2">
        <Settings size={16} />
        Settings
      </span>
    </Button>
  );
};
