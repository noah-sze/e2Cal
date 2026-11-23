import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Plus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog';
import {
  ExerciseRoutineBrowser,
  type ExerciseSelectMode,
} from '@/components/workout/ExerciseRoutineBrowser';
import { ExerciseFormDialog, type ExerciseFormData } from '@/components/workout/ExerciseFormDialog';
import { RoutineFormDialog, type RoutineFormData } from '@/components/workout/RoutineFormDialog';
import { useExercises } from '@/hooks/useExercises';
import { useRoutines } from '@/hooks/useRoutines';
import { touchRecentExercise, touchRecentRoutine } from '@/hooks/useRecentExercises';
import { toast } from '@/components/ui/toast';
import { AutoMarquee } from '@/components/ui/AutoMarquee';
import type { Exercise, WorkoutRoutine } from '@/types';
import { cn } from '@/lib/utils';
import { triggerHaptic } from '@/lib/haptics';

export type { ExerciseSelectMode };

export interface ExerciseSelectDialogProps {
  /** 控制彈窗開關 */
  open: boolean;
  /** 彈窗開關狀態變更回調 */
  onOpenChange: (open: boolean) => void;
  /**
   * 選擇模式：
   * - 'all': 同時支援動作與組合（提供頂部 Tab 切換）
   * - 'exercises': 僅選擇動作（隱藏頂部 Tab）
   * - 'routines': 僅選擇組合（隱藏頂部 Tab）
   * @default 'all'
   */
  mode?: ExerciseSelectMode;
  /** 自訂彈窗標題（預設由 i18n 輸出） */
  title?: string;
  /** 選取回調：回傳選中之物件與其領域型別，並依設定決定是否關閉彈窗 */
  onSelect: (item: Exercise | WorkoutRoutine, type: 'exercise' | 'routine') => void;
  /**
   * 選取項目後是否自動關閉彈窗
   * @default true
   */
  autoCloseOnSelect?: boolean;
  /**
   * 多層彈窗層級（Rule 4 規範）：
   * 當此彈窗自次級彈窗呼出時（如在 RoutineFormDialog 編輯彈窗中），
   * 透過傳入 zIndex 自適應提升遮罩與本體層級至 z-[80] 或更高
   * @default 70
   */
  zIndex?: number;
  /** 禁用的項目 ID 陣列（將反灰顯示且無法點擊選取） */
  disabledIds?: string[];
  /** 自訂項目是否禁用的判斷函數 */
  isItemDisabled?: (item: Exercise | WorkoutRoutine, type: 'exercise' | 'routine') => boolean;
  /** 是否允許在此彈窗中直接新增動作與訓練組合 @default true */
  allowAdd?: boolean;
}

export function ExerciseSelectDialog({
  open,
  onOpenChange,
  mode = 'all',
  title,
  onSelect,
  autoCloseOnSelect = true,
  zIndex = 70,
  disabledIds,
  isItemDisabled,
  allowAdd = true,
}: ExerciseSelectDialogProps) {
  const { t } = useTranslation();
  const { addExercise } = useExercises();
  const { addRoutine } = useRoutines();

  const [activeTab, setActiveTab] = useState<'exercises' | 'routines'>(
    mode === 'routines' ? 'routines' : 'exercises'
  );
  const [isAddExerciseOpen, setIsAddExerciseOpen] = useState(false);
  const [isAddRoutineOpen, setIsAddRoutineOpen] = useState(false);

  const effectiveTab: 'exercises' | 'routines' =
    mode === 'exercises' ? 'exercises' : mode === 'routines' ? 'routines' : activeTab;

  const handleOpenAdd = () => {
    triggerHaptic('light');
    if (effectiveTab === 'routines') {
      setIsAddRoutineOpen(true);
    } else {
      setIsAddExerciseOpen(true);
    }
  };

  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && (isAddExerciseOpen || isAddRoutineOpen)) {
      return;
    }
    onOpenChange(nextOpen);
  };

  const defaultTitle =
    mode === 'exercises'
      ? t('workout.exercises', '動作')
      : mode === 'routines'
      ? t('workout.routines', '訓練組合')
      : t('common.select', '選擇');

  const resolvedTitle = title || defaultTitle;
  const zIndexClass = `z-[${zIndex}]`;
  const secondaryZIndexClass = `z-[${zIndex + 10}]`;

  const handleItemSelect = (
    item: Exercise | WorkoutRoutine,
    type: 'exercise' | 'routine'
  ) => {
    if (type === 'exercise') {
      touchRecentExercise(item.id);
    } else {
      touchRecentRoutine(item.id);
    }
    triggerHaptic('selection');
    onSelect(item, type);
    if (autoCloseOnSelect) {
      onOpenChange(false);
    }
  };

  const handleAddExerciseSubmit = async (formData: ExerciseFormData) => {
    const newExercise = await addExercise({
      ...formData,
      isCustom: true,
    });
    triggerHaptic('success');
    toast.show(t('common.saved'));
    setIsAddExerciseOpen(false);
    handleItemSelect(newExercise, 'exercise');
  };

  const handleAddRoutineSubmit = async (formData: RoutineFormData) => {
    const newRoutine = await addRoutine({
      ...formData,
      isCustom: true,
    });
    triggerHaptic('success');
    toast.show(t('common.saved'));
    setIsAddRoutineOpen(false);
    handleItemSelect(newRoutine, 'routine');
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleDialogOpenChange}>
        <DialogContent
          showCloseButton={false}
          overlayClassName={zIndexClass}
          className={cn(
            zIndexClass,
            'w-[400px] max-w-[calc(100vw-24px)] sm:w-[400px] sm:max-w-[400px] h-[85vh] sm:h-[80vh] flex flex-col p-4 sm:p-5 bg-card border border-border text-card-foreground overflow-hidden select-none shadow-none text-xs'
          )}
          initialFocus={false}
        >
          {/* 彈窗標頭 (復刻食物選擇彈窗) */}
          <DialogHeader className="p-0 pb-2 shrink-0">
            <div className="flex items-center justify-between w-full h-7">
              {/* 左側純圖標：取消 (✕) */}
              <DialogClose
                render={
                  <button
                    type="button"
                    className="size-7 rounded-full flex items-center justify-center bg-muted text-muted-foreground hover:text-foreground hover:bg-border transition-all cursor-pointer shrink-0 active:scale-92"
                    title={t('common.cancel')}
                    aria-label={t('common.cancel')}
                  />
                }
              >
                <X className="size-3.5 stroke-[2.2]" />
              </DialogClose>

              {/* 中間標題 (置中對稱，支援超長文本平滑跑馬燈滾動) */}
              <DialogTitle className="text-foreground text-sm font-semibold tracking-tight font-sans flex items-center justify-center flex-1 min-w-0 px-2 text-center overflow-hidden">
                <AutoMarquee align="center">{resolvedTitle}</AutoMarquee>
              </DialogTitle>

              {/* 右側操作：允許新增時顯示 + 圓鈕，否則維持等寬佔位確保標題置中 */}
              {allowAdd ? (
                <button
                  type="button"
                  onClick={handleOpenAdd}
                  className="size-7 rounded-full flex items-center justify-center bg-muted text-muted-foreground hover:text-foreground hover:bg-border transition-all cursor-pointer shrink-0 active:scale-92"
                  title={effectiveTab === 'routines' ? t('workout.addRoutine', '新增訓練組合') : t('workout.addExercise', '新增動作')}
                  aria-label={effectiveTab === 'routines' ? t('workout.addRoutine', '新增訓練組合') : t('workout.addExercise', '新增動作')}
                >
                  <Plus className="size-3.5 stroke-[2.2]" />
                </button>
              ) : (
                <div className="size-7 shrink-0 pointer-events-none" aria-hidden="true" />
              )}
            </div>
          </DialogHeader>

          {/* 核心瀏覽與選擇區 (點擊即選擇，直達底部) */}
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden pt-1">
            <ExerciseRoutineBrowser
              key={mode}
              mode={mode}
              activeTab={effectiveTab}
              onTabChange={setActiveTab}
              interactiveMode="select"
              disabledIds={disabledIds}
              isItemDisabled={isItemDisabled}
              onItemClick={handleItemSelect}
              freezeSort={open}
              className="flex-1 min-h-0"
              listContainerClassName="flex-1 min-h-0"
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* 次級彈窗：平鋪兄弟節點聲明 (No Nested Dialogs)，條件掛載徹底防止遞迴無限渲染 */}
      {allowAdd && isAddExerciseOpen && (
        <ExerciseFormDialog
          open={isAddExerciseOpen}
          onOpenChange={setIsAddExerciseOpen}
          onSubmit={handleAddExerciseSubmit}
          overlayClassName={secondaryZIndexClass}
          className={secondaryZIndexClass}
        />
      )}
      {allowAdd && isAddRoutineOpen && (
        <RoutineFormDialog
          open={isAddRoutineOpen}
          onOpenChange={setIsAddRoutineOpen}
          onSubmit={handleAddRoutineSubmit}
          overlayClassName={secondaryZIndexClass}
          className={secondaryZIndexClass}
        />
      )}
    </>
  );
}
