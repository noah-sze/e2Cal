"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { XIcon, CheckIcon } from "lucide-react"
import { AutoMarquee } from "@/components/ui/AutoMarquee"

function Dialog({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({ container, ...props }: DialogPrimitive.Portal.Props & { container?: HTMLElement | null }) {
  return <DialogPrimitive.Portal container={container} data-slot="dialog-portal" {...props} />
}

function DialogClose({ ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  forceRender = false,
  ...props
}: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      forceRender={forceRender}
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 z-[60] bg-overlay backdrop-blur-[2px] data-closed:hidden touch-none",
        className
      )}
      {...props}
    />
  )
}

const dialogSizeClasses = {
  default: "max-w-[calc(100%-2rem)] max-h-[min(88vh,calc(100%-2rem))] max-h-[min(88dvh,calc(100%-2rem))] p-5 sm:p-6 text-sm sm:max-w-[400px]",
  compact: "w-[320px] max-w-[calc(100vw-24px)] sm:w-[320px] sm:max-w-[320px] p-4 sm:p-4 text-xs select-none shadow-none",
  standard: "w-[320px] max-w-[calc(100vw-24px)] sm:w-[320px] sm:max-w-[320px] p-4 sm:p-4 text-xs select-none shadow-none",
}

export interface DialogContentProps extends DialogPrimitive.Popup.Props {
  /** 彈窗標準規格尺寸 (預設 'default'；表單與管理彈窗強烈建議採用 'standard' 確保恆定 320px 寬度與 16px 緊湊 Padding) */
  size?: 'default' | 'compact' | 'standard'
  showCloseButton?: boolean
  overlayClassName?: string
  wrapperClassName?: string
  container?: HTMLElement | null
  fullscreen?: boolean
  commandDeck?: boolean
  /** 外部掛載插槽（例如外部 AI 助手），懸浮於彈窗卡片外部且完全隔離於原生卡片之外 */
  externalTopSlot?: React.ReactNode
  /** 是否由外部助手接管視窗中央焦點（啟用時原生彈窗絲滑下移退讓變淡並鎖定，點擊可喚回） */
  externalFocusActive?: boolean
  /** 點擊退讓中的原生彈窗時觸發，將焦點交還給原生彈窗 */
  onExternalFocusDismiss?: () => void
}

function DialogContent({
  className,
  overlayClassName,
  wrapperClassName,
  children,
  showCloseButton,
  size = 'default',
  container,
  fullscreen = false,
  commandDeck = false,
  externalTopSlot,
  externalFocusActive = false,
  onExternalFocusDismiss,
  initialFocus,
  ...props
}: DialogContentProps) {
  const contentRef = React.useRef<HTMLDivElement>(null)

  const extractZIndex = (str?: unknown) =>
    typeof str === 'string' ? str.match(/(?:^|\s)(z-(?:\[\d+\]|\d+))(?:\s|$)/)?.[1] : undefined

  const extractedZIndex = extractZIndex(className) || extractZIndex(overlayClassName)
  const isPrecision = size === 'compact' || size === 'standard'
  const shouldShowCloseButton = showCloseButton ?? !isPrecision

  return (
    <DialogPortal container={container ?? (typeof document !== 'undefined' ? document.body : undefined)}>
      <DialogOverlay className={cn(commandDeck && "bg-overlay", overlayClassName)} />
      {fullscreen ? (
        <DialogPrimitive.Popup
          ref={contentRef}
          initialFocus={initialFocus ?? false}
          data-slot="dialog-content"
          className={cn(
            "fixed inset-0 z-[60] flex flex-col w-full h-full bg-background overflow-hidden overscroll-contain outline-none data-closed:hidden",
            className
          )}
          {...props}
        >
          {children}
        </DialogPrimitive.Popup>
      ) : commandDeck ? (
        <DialogPrimitive.Popup
          ref={contentRef}
          initialFocus={initialFocus ?? false}
          data-slot="dialog-content"
          className={cn(
            "fixed inset-0 z-[60] flex flex-col w-full h-full bg-background text-foreground outline-none px-4 pt-[calc(1rem+env(safe-area-inset-top,0px)+var(--ios-status-blur-offset,0px))] pb-4 overflow-y-auto overscroll-contain no-scrollbar sm:fixed sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-[min(380px,calc(100vw-2rem))] sm:h-[min(600px,calc(100vh-3rem))] sm:h-[min(600px,calc(100dvh-3rem))] sm:max-h-[calc(100vh-3rem)] sm:max-h-[calc(100dvh-3rem))] sm:rounded-lg sm:bg-card sm:text-card-foreground sm:border sm:border-border sm:p-6 sm:shadow-none sm:overflow-y-auto sm:overscroll-contain data-closed:hidden",
            className
          )}
          {...props}
        >
          {children}
        </DialogPrimitive.Popup>
      ) : (
        <div className={cn(
          "fixed inset-0 z-[60] flex items-center justify-center p-4 pointer-events-none touch-none",
          extractedZIndex,
          wrapperClassName
        )}>
          {externalTopSlot ? (
            <>
              {/* AI 窗口專屬次級遮罩：純合成層透明遮罩（無動態 blur 重繪），點擊即可喚回焦點 */}
              <div
                aria-hidden="true"
                onClick={externalFocusActive ? onExternalFocusDismiss : undefined}
                className={cn(
                  "fixed inset-0 z-[85] bg-white/50 dark:bg-black/50 transition-opacity duration-[320ms] ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[opacity]",
                  externalFocusActive
                    ? "opacity-100 pointer-events-auto cursor-pointer"
                    : "opacity-0 pointer-events-none"
                )}
              />
              <DialogPrimitive.Popup
                ref={contentRef}
                initialFocus={initialFocus ?? false}
                data-slot="dialog-popup-group"
                className="relative w-fit max-w-full max-h-full pointer-events-none outline-none data-closed:hidden"
                {...props}
              >
                <div className="pointer-events-none absolute inset-0 z-[90]">
                  {externalTopSlot}
                </div>
                <div
                  data-slot="dialog-content"
                  className={cn(
                    "pointer-events-auto relative z-10 flex flex-col w-full overflow-hidden overscroll-contain rounded-lg bg-card text-card-foreground border border-border shadow-none outline-none origin-top",
                    "transition-transform duration-[380ms] ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform",
                    dialogSizeClasses[size] || dialogSizeClasses.default,
                    "[&>*:not([data-slot=dialog-header]):not([data-slot=dialog-footer]):not(form)]:flex-1 [&>*:not([data-slot=dialog-header]):not([data-slot=dialog-footer]):not(form)]:min-h-0 [&>*:not([data-slot=dialog-header]):not([data-slot=dialog-footer]):not(form)]:overflow-y-auto [&>*:not([data-slot=dialog-header]):not([data-slot=dialog-footer]):not(form)]:overflow-x-hidden [&>*:not([data-slot=dialog-header]):not([data-slot=dialog-footer]):not(form)]:overscroll-contain",
                    "[&>form]:flex [&>form]:flex-col [&>form]:flex-1 [&>form]:min-h-0 [&>form]:overflow-hidden",
                    "[&>form>*:not([data-slot=dialog-footer])]:flex-1 [&>form>*:not([data-slot=dialog-footer])]:min-h-0 [&>form>*:not([data-slot=dialog-footer])]:overflow-y-auto [&>form>*:not([data-slot=dialog-footer])]:overflow-x-hidden [&>form>*:not([data-slot=dialog-footer])]:overscroll-contain",
                    className,
                    externalFocusActive
                      ? "translate-y-[calc(50%+20px)] scale-[0.96] [&>*]:pointer-events-none"
                      : "translate-y-0 scale-100"
                  )}
                >
                  {children}
                  {shouldShowCloseButton && (
                    <DialogPrimitive.Close
                      data-slot="dialog-close"
                      render={
                        <Button
                          variant="ghost"
                          className="absolute top-4 right-4 h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 cursor-pointer z-10"
                          size="icon-sm"
                        />
                      }
                    >
                      <XIcon className="h-4 w-4" />
                      <span className="sr-only">Close</span>
                    </DialogPrimitive.Close>
                  )}
                </div>
              </DialogPrimitive.Popup>
            </>
          ) : (
            <DialogPrimitive.Popup
              ref={contentRef}
              initialFocus={initialFocus ?? false}
              data-slot="dialog-content"
              className={cn(
                "pointer-events-auto relative flex flex-col w-full overflow-hidden overscroll-contain rounded-lg bg-card text-card-foreground border border-border shadow-none outline-none data-closed:hidden",
                dialogSizeClasses[size] || dialogSizeClasses.default,
                "[&>*:not([data-slot=dialog-header]):not([data-slot=dialog-footer]):not(form)]:flex-1 [&>*:not([data-slot=dialog-header]):not([data-slot=dialog-footer]):not(form)]:min-h-0 [&>*:not([data-slot=dialog-header]):not([data-slot=dialog-footer]):not(form)]:overflow-y-auto [&>*:not([data-slot=dialog-header]):not([data-slot=dialog-footer]):not(form)]:overflow-x-hidden [&>*:not([data-slot=dialog-header]):not([data-slot=dialog-footer]):not(form)]:overscroll-contain",
                "[&>form]:flex [&>form]:flex-col [&>form]:flex-1 [&>form]:min-h-0 [&>form]:overflow-hidden",
                "[&>form>*:not([data-slot=dialog-footer])]:flex-1 [&>form>*:not([data-slot=dialog-footer])]:min-h-0 [&>form>*:not([data-slot=dialog-footer])]:overflow-y-auto [&>form>*:not([data-slot=dialog-footer])]:overflow-x-hidden [&>form>*:not([data-slot=dialog-footer])]:overscroll-contain",
                className
              )}
              {...props}
            >
              {children}
              {shouldShowCloseButton && (
                <DialogPrimitive.Close
                  data-slot="dialog-close"
                  render={
                    <Button
                      variant="ghost"
                      className="absolute top-4 right-4 h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 cursor-pointer z-10"
                      size="icon-sm"
                    />
                  }
                >
                  <XIcon className="h-4 w-4" />
                  <span className="sr-only">Close</span>
                </DialogPrimitive.Close>
              )}
            </DialogPrimitive.Popup>
          )}
        </div>
      )}
    </DialogPortal>
  )
}

export interface DialogPrecisionHeaderProps {
  title: React.ReactNode
  onTitleClick?: () => void
  onClose?: () => void
  cancelDisabled?: boolean
  onSubmit?: () => void
  submitDisabled?: boolean
  submitAriaLabel?: string
  cancelAriaLabel?: string
  rightAction?: React.ReactNode
  className?: string
  form?: string
}

/**
 * e2Cal 標準精密彈窗標頭 (Precision Header Variant D)
 * - 左側：純圖標取消圓鈕 (✕)
 * - 中間：客觀純品名/標題 (截斷保護，支援可選膠囊點擊導航)
 * - 右側：純圖標提交圓鈕 (✓) 或自訂按鈕（支援 onClick 或 form submit）
 */
function DialogPrecisionHeader({
  title,
  onTitleClick,
  onClose,
  cancelDisabled = false,
  onSubmit,
  submitDisabled = false,
  submitAriaLabel = 'Save',
  cancelAriaLabel = 'Cancel',
  rightAction,
  className,
  form,
}: DialogPrecisionHeaderProps) {
  return (
    <DialogHeader className={cn("p-0 pb-0 shrink-0", className)}>
      <div className="flex items-center justify-between w-full h-7">
        {/* 左側純圖標：取消 (✕) */}
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            disabled={cancelDisabled}
            className="size-7 rounded-full flex items-center justify-center bg-muted text-muted-foreground hover:text-foreground hover:bg-border transition-all cursor-pointer shrink-0 active:scale-92 disabled:opacity-30 disabled:pointer-events-none"
            title={cancelAriaLabel}
            aria-label={cancelAriaLabel}
          >
            <XIcon className="size-3.5 stroke-[2.2]" />
          </button>
        ) : (
          <DialogClose
            render={
              <button
                type="button"
                className="size-7 rounded-full flex items-center justify-center bg-muted text-muted-foreground hover:text-foreground hover:bg-border transition-all cursor-pointer shrink-0 active:scale-92"
                title={cancelAriaLabel}
                aria-label={cancelAriaLabel}
              />
            }
          >
            <XIcon className="size-3.5 stroke-[2.2]" />
          </DialogClose>
        )}

        {/* 中間純標題 (支援長文本自動平滑跑馬燈滾動) */}
        <DialogTitle className="text-foreground text-sm font-semibold tracking-tight font-sans flex items-center justify-center flex-1 min-w-0 px-1 overflow-hidden">
          {onTitleClick ? (
            <button
              type="button"
              onClick={onTitleClick}
              className="max-w-full min-w-0 px-2 py-0.5 rounded-full border border-transparent hover:border-border/80 hover:bg-hover transition-all cursor-pointer select-none active:scale-95 flex items-center justify-center overflow-hidden"
              title={typeof title === 'string' ? title : undefined}
            >
              <AutoMarquee align="center">
                {title}
              </AutoMarquee>
            </button>
          ) : (
            <AutoMarquee align="center">
              {title}
            </AutoMarquee>
          )}
        </DialogTitle>

        {/* 右側純圖標：提交 (✓) 或自訂插槽 */}
        {rightAction ? (
          rightAction
        ) : (form || onSubmit) ? (
          <button
            type={form ? "submit" : "button"}
            form={form}
            onClick={form ? undefined : onSubmit}
            disabled={submitDisabled}
            className="size-7 rounded-full flex items-center justify-center bg-foreground text-background hover:opacity-90 active:scale-92 transition-all cursor-pointer shrink-0 disabled:opacity-30 disabled:pointer-events-none"
            title={submitAriaLabel}
            aria-label={submitAriaLabel}
          >
            <CheckIcon className="size-3.5 stroke-[2.5]" />
          </button>
        ) : (
          <div className="size-7 shrink-0" />
        )}
      </div>
    </DialogHeader>
  )
}

export interface PrecisionDialogContentProps extends Omit<DialogContentProps, 'size' | 'title'> {
  title?: React.ReactNode
  onTitleClick?: () => void
  onClose?: () => void
  cancelDisabled?: boolean
  onSubmit?: () => void
  submitDisabled?: boolean
  submitAriaLabel?: string
  cancelAriaLabel?: string
  rightAction?: React.ReactNode
  form?: string
}

/**
 * e2Cal 標準精密彈窗容器 (Precision Dialog Content)
 * 唯一真理源：鎖死 320px 寬度、16px 緊湊邊距（p-4 sm:p-4 防洩漏）、font-mono、0 陰影
 * 若提供 title，自動內建標準 Precision Header (Variant D)
 */
function PrecisionDialogContent({
  title,
  onTitleClick,
  onClose,
  cancelDisabled,
  onSubmit,
  submitDisabled,
  submitAriaLabel,
  cancelAriaLabel,
  rightAction,
  form,
  children,
  className,
  ...props
}: PrecisionDialogContentProps) {
  return (
    <DialogContent
      size="standard"
      className={className}
      {...props}
    >
      {title !== undefined && (
        <DialogPrecisionHeader
          title={title}
          onTitleClick={onTitleClick}
          onClose={onClose}
          cancelDisabled={cancelDisabled}
          onSubmit={onSubmit}
          submitDisabled={submitDisabled}
          submitAriaLabel={submitAriaLabel}
          cancelAriaLabel={cancelAriaLabel}
          rightAction={rightAction}
          form={form}
        />
      )}
      {children}
    </DialogContent>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-1.5 text-left shrink-0 pb-3", className)}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-row items-center justify-between gap-2 pt-3 shrink-0 mt-auto [&>*:only-child]:ml-auto [&_button]:h-10 [&_button]:text-sm",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close render={<Button variant="outline" />}>
          Close
        </DialogPrimitive.Close>
      )}
    </div>
  )
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn(
        "text-base font-semibold leading-tight tracking-tight text-foreground",
        className
      )}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        "text-sm text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        className
      )}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
  DialogPrecisionHeader,
  PrecisionDialogContent,
}
