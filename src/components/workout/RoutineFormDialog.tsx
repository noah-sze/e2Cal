import { useState, useEffect, useId, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';
import {
  Dialog,
  PrecisionDialogContent,
} from '@/components/ui/dialog';
import { ExerciseSelectDialog } from '@/components/workout/ExerciseSelectDialog';
import { EquipmentBadge } from '@/components/workout/EquipmentBadge';
import { SectionCard } from '@/components/ui/section-card';
import { MetricValue } from '@/components/ui/metric-value';
import { toast } from '@/components/ui/toast';
import { triggerHaptic } from '@/lib/haptics';
import { useExercises } from '@/hooks/useExercises';
import { useEquipments } from '@/hooks/useEquipments';
import { getRoutineFactSummary } from '@/utils/workoutMath';
import { getLocalizedExerciseName } from '@/utils/defaultLocalization';
import type { RoutineExerciseItem, WorkoutRoutine, Exercise } from '@/types';

export interface RoutineFormData {
  name: string;
  notes?: string;
  exercises: RoutineExerciseItem[];
}

export interface RoutineFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: WorkoutRoutine | null;
  onSubmit: (data: RoutineFormData) => Promise<void> | void;
  overlayClassName?: string;
  className?: string;
}

export function RoutineFormDialog({
  open,
  onOpenChange,
  initialData,
  onSubmit,
  overlayClassName,
  className,
}: RoutineFormDialogProps) {
  const { t } = useTranslation();
  const formId = useId();
  const { allExercises } = useExercises();
  const { getEquipmentDisplayName } = useEquipments();
  const isEdit = !!initialData;

  // 構建快速查詢 Map
  const exerciseMap = useMemo(() => {
    const map = new Map<string, Exercise>();
    allExercises.forEach((ex) => map.set(ex.id, ex));
    return map;
  }, [allExercises]);

  const [name, setName] = useState('');
  const [items, setItems] = useState<RoutineExerciseItem[]>([]);

  // 動作挑選器狀態
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [replacingIndex, setReplacingIndex] = useState<number | null>(null);

  // 初始化或編輯回填
  useEffect(() => {
    if (!open) return;

    if (initialData) {
      // oxlint-disable-next-line react/set-state-in-effect
      setName(initialData.name || '');
      setItems(initialData.exercises || []);
    } else {
      // oxlint-disable-next-line react/set-state-in-effect
      setName('');
      setItems([]);
    }
  }, [open, initialData]);

  // 即時計算組合客觀事實概覽
  const summary = useMemo(() => {
    return getRoutineFactSummary({ exercises: items }, exerciseMap);
  }, [items, exerciseMap]);

  // 計算挑選器中已存在不可重複選擇的 ID
  const disabledExerciseIds = useMemo(() => {
    if (replacingIndex !== null && replacingIndex >= 0 && replacingIndex < items.length) {
      return items.filter((_, idx) => idx !== replacingIndex).map((it) => it.exerciseId);
    }
    return items.map((it) => it.exerciseId);
  }, [items, replacingIndex]);

  // 新增動作觸發
  const handleOpenAddExercise = () => {
    triggerHaptic('selection');
    setReplacingIndex(null);
    setIsPickerOpen(true);
  };

  // 替換現有動作觸發
  const handleOpenReplaceExercise = (index: number) => {
    triggerHaptic('selection');
    setReplacingIndex(index);
    setIsPickerOpen(true);
  };

  // 挑選器選中動作回調
  const handleSelectExercise = (exercise: Exercise) => {
    if (replacingIndex !== null && replacingIndex >= 0 && replacingIndex < items.length) {
      // 替換
      const updated = [...items];
      updated[replacingIndex] = {
        exerciseId: exercise.id,
      };
      setItems(updated);
      setReplacingIndex(null);
    } else {
      // 新增動作（不設置組數）
      setItems([...items, { exerciseId: exercise.id }]);
    }
  };

  // 移除項目
  const handleRemoveItem = (index: number) => {
    triggerHaptic('selection');
    setItems(items.filter((_, idx) => idx !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      toast.show(t('common.required'));
      return;
    }

    if (items.length === 0) {
      toast.show(t('workout.atLeastOneExercise'));
      return;
    }

    try {
      await onSubmit({
        name: trimmed,
        exercises: items,
      });
      onOpenChange(false);
    } catch {
      toast.show(t('common.error'));
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <PrecisionDialogContent
          title={isEdit ? t('workout.editRoutine') : t('common.add')}
          form={formId}
          onClose={() => onOpenChange(false)}
          overlayClassName={overlayClassName}
          className={className}
        >
          <form
            id={formId}
            onSubmit={handleSubmit}
            className="pt-3.5 space-y-3 font-mono text-xs select-none"
          >
            <div className="space-y-3">
              {/* 表單段落 1: 基本資訊 (方案 A：標準 h-10 表格行整合名稱與統計) */}
              <SectionCard
                title={t('workout.basicInfo')}
                className="shrink-0"
                bodyClassName="text-sm font-sans"
              >
                <div className="h-10 relative flex items-stretch bg-card shrink-0 focus-within:ring-1 focus-within:ring-inset focus-within:ring-foreground focus-within:z-[1] transition-shadow duration-100">
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t('workout.routineNamePlaceholder', '名稱')}
                    aria-label={t('workout.routineName')}
                    className="w-full h-full px-4 bg-transparent text-center text-xs font-sans text-foreground font-normal focus:outline-none placeholder:text-muted-foreground/40"
                    maxLength={50}
                  />
                </div>
                <div className="h-10 px-4 flex items-center justify-between bg-card">
                  <span className="text-muted-foreground text-xs shrink-0">
                    {t('workout.exercises', '動作數')}
                  </span>
                  <MetricValue
                    value={summary.exerciseCount}
                    unit={t('common.items', '項')}
                    valueClassName="font-normal text-foreground text-xs"
                    unitClassName="text-xs"
                  />
                </div>
                <div className="h-10 px-4 flex items-center justify-between bg-card">
                  <span className="text-muted-foreground text-xs shrink-0">
                    {t('workout.coveredMusclesShort', '覆蓋肌群')}
                  </span>
                  <MetricValue
                    value={summary.coveredMuscles.length}
                    unit={t('workout.muscleUnit', '個')}
                    valueClassName="font-normal text-foreground text-xs"
                    unitClassName="text-xs"
                  />
                </div>
              </SectionCard>

              {/* 表單段落 2: 動作清單 (共用 SectionCard 內嵌表頭) */}
              <SectionCard
                title={`${t('workout.routineExerciseList', '動作清單')} (${items.length})`}
                className="shrink-0"
                bodyClassName="text-sm"
                action={
                  <button
                    type="button"
                    onClick={handleOpenAddExercise}
                    className="h-6 px-2.5 rounded-full border border-border/80 bg-card hover:bg-hover font-mono text-xs flex items-center gap-1 transition-colors cursor-pointer text-muted-foreground hover:text-foreground active:scale-95 select-none"
                  >
                    <Plus className="size-3 text-muted-foreground" />
                    <span>{t('workout.addExercise')}</span>
                  </button>
                }
              >
                {items.length === 0 ? (
                  <div className="min-h-12 py-2 px-3 sm:px-4 flex items-center justify-center shrink-0">
                    <button
                      type="button"
                      onClick={handleOpenAddExercise}
                      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer select-none font-mono"
                    >
                      <Plus className="size-3.5" />
                      <span>{t('workout.addExercise')}</span>
                    </button>
                  </div>
                ) : (
                  items.map((item, index) => {
                    const ex = exerciseMap.get(item.exerciseId);
                    return (
                      <div
                        key={`${item.exerciseId}-${index}`}
                        className="min-h-12 py-2 px-3 sm:px-4 flex items-center justify-between gap-2 bg-card shrink-0"
                      >
                        {/* 左側：動作名與器械 (點擊可替換動作) */}
                        <button
                          type="button"
                          onClick={() => handleOpenReplaceExercise(index)}
                          className="text-left min-w-0 flex-1 truncate cursor-pointer outline-none group"
                          title={ex ? getLocalizedExerciseName(ex) : t('workout.unknownExercise')}
                        >
                          <div className="text-xs font-normal text-foreground truncate group-hover:opacity-75 transition-opacity">
                            {ex ? getLocalizedExerciseName(ex) : t('workout.unknownExercise')}
                          </div>
                          {ex && (
                            <div className="mt-0.5 flex items-center gap-1 text-3xs text-muted-foreground font-mono">
                              <EquipmentBadge
                                name={getEquipmentDisplayName(ex.equipment, t)}
                                size="sm"
                                className="text-[9px] px-1 py-0 h-4 leading-none"
                              />
                            </div>
                          )}
                        </button>

                        {/* 右側：圓形膠囊刪除按鈕 */}
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(index)}
                          className="size-7 rounded-full border border-border/80 bg-background flex items-center justify-center transition-colors shrink-0 text-muted-foreground hover:text-destructive hover:bg-hover cursor-pointer active:scale-95"
                          title={t('common.delete')}
                          aria-label={t('common.delete')}
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    );
                  })
                )}
              </SectionCard>
            </div>
          </form>
        </PrecisionDialogContent>
      </Dialog>

      {/* 次級動作選擇器 (平鋪兄弟節點，zIndex={80}) */}
      <ExerciseSelectDialog
        open={isPickerOpen}
        onOpenChange={setIsPickerOpen}
        mode="exercises"
        zIndex={80}
        disabledIds={disabledExerciseIds}
        onSelect={(item) => handleSelectExercise(item as Exercise)}
      />
    </>
  );
}
