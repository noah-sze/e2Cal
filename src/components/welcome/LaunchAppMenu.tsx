import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowUpRight, UserRound, CloudDownload, FolderArchive } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export interface LaunchAppMenuProps {
  label: string;
  isSetupCompleted: boolean;
  onOpenApp: () => void;
  onSelectFirstTime: () => void;
  onSelectCloudImport: () => void;
  onSelectLocalImport: () => void;
  align?: 'start' | 'center' | 'end';
  side?: 'top' | 'bottom';
  sideOffset?: number;
  triggerClassName?: string;
  iconClassName?: string;
}

/**
 * 落地頁「開啟應用」統一觸發元件（單一真理源，供 Header / Hero / Tech 3 處 CTA 共用）
 * - 已完成初始化的老用戶：點擊直接進入 /app
 * - 未完成初始化的新裝置：彈出極簡 3 選項 Popover（首次使用 / 雲端導入 / 本地導入）
 */
export function LaunchAppMenu({
  label,
  isSetupCompleted,
  onOpenApp,
  onSelectFirstTime,
  onSelectCloudImport,
  onSelectLocalImport,
  align = 'start',
  side = 'bottom',
  sideOffset = 8,
  triggerClassName,
  iconClassName = 'w-4 h-4 shrink-0',
}: LaunchAppMenuProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const defaultTriggerClass =
    'px-5 py-3 bg-foreground text-background font-mono text-xs font-semibold rounded hover:opacity-90 transition-colors inline-flex items-center justify-center space-x-2 cursor-pointer';

  if (isSetupCompleted) {
    return (
      <button
        type="button"
        onClick={onOpenApp}
        className={cn(defaultTriggerClass, triggerClassName)}
      >
        <span>{label}</span>
        <ArrowUpRight className={iconClassName} />
      </button>
    );
  }

  const handleChoose = (action: () => void) => {
    setOpen(false);
    action();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            className={cn(defaultTriggerClass, triggerClassName)}
          />
        }
      >
        <span>{label}</span>
        <ArrowUpRight className={iconClassName} />
      </PopoverTrigger>
      <PopoverContent
        align={align}
        side={side}
        sideOffset={sideOffset}
        positionerClassName="z-[55]"
        className="w-40 p-1.5 gap-0.5 rounded-lg bg-popover border border-border shadow-none select-none"
      >
        <button
          type="button"
          onClick={() => handleChoose(onSelectFirstTime)}
          className="w-full h-9 px-2.5 rounded-md flex items-center gap-2 text-xs text-foreground hover:bg-hover transition-colors cursor-pointer"
        >
          <UserRound className="size-3.5 text-muted-foreground shrink-0" strokeWidth={1.75} />
          <span className="font-sans font-medium truncate">
            {t('landing.launchMenu.firstTime', '首次使用')}
          </span>
        </button>

        <button
          type="button"
          onClick={() => handleChoose(onSelectCloudImport)}
          className="w-full h-9 px-2.5 rounded-md flex items-center gap-2 text-xs text-foreground hover:bg-hover transition-colors cursor-pointer"
        >
          <CloudDownload className="size-3.5 text-muted-foreground shrink-0" strokeWidth={1.75} />
          <span className="font-sans font-medium truncate">
            {t('landing.launchMenu.cloudImport', '雲端導入')}
          </span>
        </button>

        <button
          type="button"
          onClick={() => handleChoose(onSelectLocalImport)}
          className="w-full h-9 px-2.5 rounded-md flex items-center gap-2 text-xs text-foreground hover:bg-hover transition-colors cursor-pointer"
        >
          <FolderArchive className="size-3.5 text-muted-foreground shrink-0" strokeWidth={1.75} />
          <span className="font-sans font-medium truncate">
            {t('landing.launchMenu.localImport', '本地導入')}
          </span>
        </button>
      </PopoverContent>
    </Popover>
  );
}
