import { useEffect, useRef, useState } from 'react';

import { t } from '@extension/i18n';
import { cn, Input, Tooltip, TooltipContent, TooltipTrigger } from '@extension/ui';

interface EditableTitleProps {
  value: string;
  onChange: (val: string) => void;
  className?: string;
}

export const EditableTitle = ({ value, onChange, className }: EditableTitleProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value || 'Untitled report');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  const handleBlur = () => {
    setIsEditing(false);
    if (draft.trim() && draft !== value) onChange(draft.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleBlur();
    } else if (e.key === 'Escape') {
      setDraft(value);
      setIsEditing(false);
    }
  };

  return (
    <div
      className={cn(
        'min-w-0 max-w-[200px] rounded-lg border border-transparent px-[10px] transition sm:max-w-[240px]',
        isEditing ? 'border-blue-500 px-1' : 'hover:border-muted hover:border',
        className,
      )}>
      {isEditing ? (
        <Input
          ref={inputRef}
          value={draft}
          type="text"
          aria-label="Capture title"
          maxLength={500}
          onChange={e => setDraft(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className="text-foreground h-8 w-full min-w-0 border-none bg-transparent px-1 py-0 font-normal not-italic leading-normal shadow-none focus-visible:ring-0"
        />
      ) : (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex h-8 items-center">
              <button
                onClick={() => {
                  setDraft(value);
                  setIsEditing(true);
                }}
                className="text-foreground max-w-full cursor-text select-text truncate text-left text-sm font-normal not-italic leading-normal">
                {value}
              </button>
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" align="center">
            {t('rename')}
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
};
