import { IS_DEV } from '@extension/env';
import { useStorage } from '@extension/shared';
import { annotationsHistoryStorage, annotationsRedoStorage, annotationsStorage } from '@extension/storage';
import { Button, cn, Icon, Tooltip, TooltipContent, TooltipTrigger } from '@extension/ui';

import { EditableTitle } from '@src/components/dialog-view';

interface EditorHeaderProps {
  /** active screenshot id */
  id: string;

  /** window controls */
  onClose: () => void;
  onMinimize: () => void;
  onToggleFullScreen: () => void;
  isFullScreen?: boolean;

  /** title */
  title: string;
  onTitleChange: (val: string) => void;

  /** undo / redo / start over */
  onUndo: () => void;
  onRedo: () => void;
  onStartOver: () => void;

  /** canvas size read-out */
  canvasWidth: number;
  canvasHeight: number;

  /** download and copy actions */
  onDownload: () => void;
  onCopy: () => void;

  className?: string;
}

export const Header: React.FC<EditorHeaderProps> = ({
  id,

  onClose,
  onMinimize,
  onToggleFullScreen,
  isFullScreen = false,

  title,
  onTitleChange,

  onUndo,
  onRedo,
  onStartOver,

  canvasWidth,
  canvasHeight,

  onDownload,
  onCopy,

  className,
}) => {
  const historyAnnotations = useStorage(annotationsHistoryStorage);
  const redoAnnotations = useStorage(annotationsRedoStorage);
  const annotations = useStorage(annotationsStorage);

  const canUndo = historyAnnotations[id]?.objects?.length;
  const canRedo = redoAnnotations[id]?.objects?.length;
  const canStartOver = annotations[id]?.objects?.length || canRedo || canUndo;

  return (
    <header
      data-testid="editor-header"
      className={cn(
        'border-border bg-card text-card-foreground grid grid-cols-2 items-center rounded-t-[18px] border-b p-4 sm:grid-cols-3',
        className,
      )}>
      <div className="flex items-center gap-[14px]">
        <div className="flex items-center">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon" variant="destructive" onClick={onClose} className="size-[35px]" aria-label="Close">
                <Icon name="X" size={16} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" align="center">
              Close
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon" variant="ghost" onClick={onMinimize} className="size-[35px]" aria-label="Minimize">
                <Icon name="MinusIcon" size={16} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" align="center">
              Minimize
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                onClick={onToggleFullScreen}
                className="hidden size-[35px] sm:flex"
                aria-label={isFullScreen ? 'Exit full screen' : 'Enter full screen'}>
                <Icon name={isFullScreen ? 'MinimizeIcon' : 'MaximizeIcon'} size={14} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" align="center">
              {isFullScreen ? 'Exit full screen' : 'Enter full screen'}
            </TooltipContent>
          </Tooltip>
        </div>

        <EditableTitle value={title} onChange={onTitleChange} />
      </div>

      <div className="hidden items-center justify-center gap-2 sm:flex">
        <div className="flex items-center">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                disabled={!canUndo}
                size="icon"
                variant="ghost"
                onClick={onUndo}
                className="size-[35px]"
                aria-label="Undo">
                <Icon name="Undo2Icon" size={16} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" align="center">
              Undo
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                disabled={!canRedo}
                size="icon"
                variant="ghost"
                onClick={onRedo}
                className="size-[35px]"
                aria-label="Redo">
                <Icon name="Redo2Icon" size={16} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" align="center">
              Redo
            </TooltipContent>
          </Tooltip>
        </div>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button disabled={!canStartOver} variant="destructive" onClick={onStartOver} className="h-[35px] px-[10px]">
              <span className="font-normal leading-normal">Start over</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" align="center">
            Deletes all the shapes
          </TooltipContent>
        </Tooltip>

        {IS_DEV && (
          <div className="text-muted-foreground text-sm">
            {canvasWidth} × {canvasHeight}
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-x-2">
        <Button onClick={onCopy} variant="secondary" className="flex h-[35px] min-w-[80px] justify-center gap-x-2">
          <Icon name="CopyIcon" size={16} />
          <span>Copy</span>
        </Button>
        <Button
          onClick={onDownload}
          className="bg-gradient-overlay flex h-[35px] min-w-[120px] justify-center gap-x-2 text-white hover:text-white">
          <Icon name="DownloadIcon" size={16} />
          <span>Download</span>
        </Button>
      </div>
    </header>
  );
};
