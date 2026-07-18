// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Button, cn, Icon } from '@extension/ui';

interface FooterProps {
  className?: string;
  tool?: string;
  zoom?: number;
  file?: string;
  onZoomChange?: (newZoom: number) => void;
}

export const Footer: React.FC<FooterProps> = ({ className, tool, zoom, file, onZoomChange }) => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const incZoom = () => onZoomChange?.((zoom ?? 100) + 10);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const decZoom = () => onZoomChange?.((zoom ?? 100) - 10);

  return (
    <footer
      data-testid="editor-footer"
      className={cn('border-border bg-card text-card-foreground rounded-b-[18px] border-t text-xs', className)}>
      <div className="flex items-center gap-x-4 px-6 py-1.5">
        {tool && (
          <div className="flex items-center gap-x-1">
            <span className="text-muted-foreground">Tool:</span>
            <span className="text-foreground">{tool}</span>
          </div>
        )}

        <div className="flex items-center gap-x-1">
          <span className="text-muted-foreground">Zoom:</span>
          <div className="flex items-center gap-x-1">
            {/* <Button
              size="icon"
              variant="ghost"
              onClick={decZoom}
              className="dark:bg-primary size-4 rounded-sm dark:text-white"
              aria-label="Decrease Zoom">
              <Icon name="ChevronDownIcon" size={10} />
            </Button> */}

            <span className="text-foreground">{zoom}%</span>

            {/* <Button
              size="icon"
              variant="ghost"
              onClick={incZoom}
              className="dark:bg-primary size-4 rounded-sm dark:text-white"
              aria-label="Increase Zoom">
              <Icon name="ChevronUpIcon" size={10} />
            </Button> */}
          </div>
        </div>

        {file && (
          <div className="flex items-center gap-x-1">
            <span className="text-muted-foreground">File:</span>
            <span className="text-foreground max-w-[10rem] truncate">{file}</span>
          </div>
        )}
      </div>
    </footer>
  );
};
