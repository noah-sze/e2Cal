import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SettingsRowProps {
  label: ReactNode;
  summary?: ReactNode;
  summaryClassName?: string;
  onClick?: () => void;
  href?: string;
  target?: string;
  rel?: string;
  className?: string;
}

/**
 * 設定頁標準導航列表行（SSOT）
 * - 內建 flex-wrap 容錯：寬屏並排對齊，窄屏或長語系文字時摘要自動折行至標題下方，絕不截斷或黏貼
 */
export function SettingsRow({
  label,
  summary,
  summaryClassName,
  onClick,
  href,
  target,
  rel,
  className,
}: SettingsRowProps) {
  const content = (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 flex-1 min-w-0">
        <span className="text-sm font-normal text-foreground">{label}</span>
        {summary !== undefined && summary !== null && (
          <span
            className={cn(
              'text-xs font-mono text-muted-foreground group-hover:text-foreground transition-colors',
              summaryClassName
            )}
          >
            {summary}
          </span>
        )}
      </div>
      <ChevronRight className="size-4 shrink-0 opacity-50 group-hover:opacity-100 transition-opacity" />
    </>
  );

  if (href) {
    return (
      <a
        href={href}
        target={target}
        rel={rel}
        onClick={onClick}
        className={cn('usage-row group cursor-pointer', className)}
      >
        {content}
      </a>
    );
  }

  return (
    <div onClick={onClick} className={cn('usage-row group cursor-pointer', className)}>
      {content}
    </div>
  );
}
