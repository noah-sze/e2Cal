import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { triggerHaptic } from '@/lib/haptics';
import { toast } from '@/components/ui/toast';

export interface CopySnippetProps {
  /** 欲複製的真實字串；若省略則自動提取 children 文字內容 */
  value?: string;
  /** 顯示的文字或元素 */
  children: React.ReactNode;
  /** 視覺風格：'code'（行內代碼方塊） | 'subtle'（極簡純文字帶懸停） | 'badge'（邊框膠囊） */
  variant?: 'code' | 'subtle' | 'badge';
  /** 是否顯示小型複製/打勾圖標（預設 true） */
  showIcon?: boolean;
  className?: string;
  /** 點擊複製時顯示的 Toast 文案（嚴格遵循 2～4 字規範，預設「已複製」） */
  toastMessage?: string;
}

export const CopySnippet: React.FC<CopySnippetProps> = ({
  value,
  children,
  variant = 'code',
  showIcon = true,
  className,
  toastMessage = '已複製',
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    const textToCopy = value ?? (typeof children === 'string' ? children : String(children));
    if (!textToCopy) return;

    navigator.clipboard.writeText(textToCopy);
    triggerHaptic('light');
    toast.show(toastMessage);

    setCopied(true);
    setTimeout(() => {
      setCopied(false);
    }, 1500);
  };

  const variantClasses = {
    code: 'inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-border bg-muted/50 hover:bg-muted font-mono text-2xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer select-none group',
    subtle: 'inline-flex items-center gap-1 font-mono text-2xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer select-none group',
    badge: 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-border bg-card hover:bg-hover font-mono text-3xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer select-none group',
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      title="點擊複製"
      className={cn(variantClasses[variant], className)}
    >
      <span className="truncate">{children}</span>
      {showIcon && (
        <span className="shrink-0 flex items-center justify-center opacity-70 group-hover:opacity-100 transition-opacity">
          {copied ? (
            <Check className="w-3 h-3 text-foreground animate-in fade-in zoom-in-75 duration-100" />
          ) : (
            <Copy className="w-2.5 h-2.5 text-muted-foreground group-hover:text-foreground transition-colors" />
          )}
        </span>
      )}
    </button>
  );
};
