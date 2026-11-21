import { useState, useEffect, useRef, useId, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';
import {
  Dialog,
  PrecisionDialogContent,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/components/ui/toast';
import { useEquipments } from '@/hooks/useEquipments';
import { triggerHaptic } from '@/lib/haptics';
import { cn } from '@/lib/utils';
import {
  MAJOR_MUSCLE_GROUPS,
  PREDEFINED_EQUIPMENT_DEFINITIONS,
} from '@/constants/muscles';
import {
  getMuscleRoleBadgeClasses,
  getMuscleRoleLabel,
  normalizeMuscleRole,
} from '@/utils/muscleIntensity';
import type { EquipmentType, DetailedMuscle, MuscleRole, Exercise } from '@/types';
import { EquipmentFormDialog } from './EquipmentFormDialog';
import { SectionCard } from '@/components/ui/section-card';

export interface ExerciseFormData {
  name: string;
  equipment: EquipmentType;
  targetMuscles: Partial<Record<DetailedMuscle, MuscleRole>>;
  notes?: string;
}

export interface ExerciseFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: Exercise | null;
  onSubmit: (data: ExerciseFormData) => Promise<void> | void;
  overlayClassName?: string;
  className?: string;
}

// 扁平化所有細分肌群列表
const ALL_DETAILED_MUSCLES: DetailedMuscle[] = MAJOR_MUSCLE_GROUPS.flatMap(
  (g) => g.detailedMuscles
);

// 經典 3 級運動機能學角色選項
const MUSCLE_ROLES: { role: MuscleRole; nameKey: string }[] = [
  { role: 'primary', nameKey: 'workout.muscleRolePrimary' },
  { role: 'secondary', nameKey: 'workout.muscleRoleSecondary' },
  { role: 'stabilizer', nameKey: 'workout.muscleRoleStabilizer' },
];

/**
 * 領域共用組件：新增與編輯動作表單彈窗
 * 1:1 參考 FoodFormDialog 設計規範：
 * - 嚴格基於 PrecisionDialogContent (Variant D 標頭，✕ 取消 / ✓ 提交)
 * - Vercel Usage List (divide-y divide-border) 分段架構
 * - 膠囊形式之單行輸入框與下拉選單 (h-7 rounded-full)
 * - 經典 3 級運動機能學角色下拉選單 (h-7 rounded-full Select)
 */
export function ExerciseFormDialog({
  open,
  onOpenChange,
  initialData,
  onSubmit,
  overlayClassName,
  className,
}: ExerciseFormDialogProps) {
  const { t } = useTranslation();
  const formId = useId();
  const { activeEquipments, addCustomEquipment, getEquipmentDisplayName } = useEquipments();

  const isEdit = Boolean(initialData);

  const [name, setName] = useState('');
  const [equipment, setEquipment] = useState<EquipmentType | ''>('');
  const [muscles, setMuscles] = useState<
    { muscle: DetailedMuscle | null; role: MuscleRole | null }[]
  >([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 新增自定義器械平級兄弟彈窗
  const [isAddEquipmentOpen, setIsAddEquipmentOpen] = useState(false);

  // 防丟失：僅在 open 從 false 轉為 true 的瞬間初始化表單狀態
  const prevOpenRef = useRef(open);
  useEffect(() => {
    if (!prevOpenRef.current && open) {
      if (initialData) {
        setName(initialData.name || '');
        setEquipment(initialData.equipment || '');
        const entries = Object.entries(initialData.targetMuscles || {});
        setMuscles(
          entries.map(([m, r]) => ({
            muscle: m as DetailedMuscle,
            role: normalizeMuscleRole(r),
          }))
        );
      } else {
        setName('');
        setEquipment('');
        setMuscles([]);
      }
    }
    prevOpenRef.current = open;
  }, [open, initialData]);

  // 取得肌群本地化翻譯名稱
  const getMuscleLabel = (muscle: DetailedMuscle): string => {
    const key = `workout.muscle${muscle
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join('')}`;
    return t(key);
  };

  // 當前已選肌群集合
  const usedMuscles = useMemo(
    () =>
      new Set(
        muscles
          .map((m) => m.muscle)
          .filter((m): m is DetailedMuscle => m !== null)
      ),
    [muscles]
  );
  const canAddMoreMuscle = muscles.length < ALL_DETAILED_MUSCLES.length;

  // 新增肌群條目（預設數據為空，由使用者自行選擇角色與肌群）
  const handleAddMuscle = () => {
    if (!canAddMoreMuscle) {
      toast.show(t('workout.allMusclesAdded', '已包含所有肌群'));
      return;
    }
    triggerHaptic('selection');
    setMuscles([...muscles, { muscle: null, role: null }]);
  };

  const handleUpdateMuscle = (index: number, newMuscle: DetailedMuscle) => {
    const updated = [...muscles];
    updated[index].muscle = newMuscle;
    setMuscles(updated);
  };

  const handleUpdateRole = (index: number, newRole: MuscleRole) => {
    const updated = [...muscles];
    updated[index].role = newRole;
    setMuscles(updated);
  };

  const handleRemoveMuscle = (index: number) => {
    setMuscles(muscles.filter((_, i) => i !== index));
  };

  const handleCreateCustomEquipment = async (customName: string) => {
    const res = await addCustomEquipment(customName);
    if (res.success && res.equipment) {
      setEquipment(res.equipment.id);
      toast.show(t('common.saved'));
    }
  };

  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && isAddEquipmentOpen) {
      return;
    }
    onOpenChange(nextOpen);
  };

  const hasValidMuscles =
    muscles.length > 0 && muscles.every((m) => m.muscle !== null && m.role !== null);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }
    const trimmed = name.trim();
    if (!trimmed || !equipment || !hasValidMuscles || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const targetMuscles: Partial<Record<DetailedMuscle, MuscleRole>> = {};
      for (const item of muscles) {
        if (item.muscle && item.role) {
          targetMuscles[item.muscle] = item.role;
        }
      }

      await onSubmit({
        name: trimmed,
        equipment,
        targetMuscles,
      });
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 器械選項備援清單 (Dexie 初始空時 fallback 至 16 種核心器械)
  const availableEquipments =
    activeEquipments.length > 0
      ? activeEquipments
      : PREDEFINED_EQUIPMENT_DEFINITIONS.map((p) => ({ id: p.id, name: t(p.nameKey) }));

  return (
    <>
      <Dialog open={open} onOpenChange={handleDialogOpenChange}>
        <PrecisionDialogContent
          title={isEdit ? t('common.edit') : t('common.add')}
          form={formId}
          submitDisabled={!name.trim() || !equipment || !hasValidMuscles || isSubmitting}
          submitAriaLabel={isEdit ? t('common.save') : t('common.add')}
          cancelAriaLabel={t('common.cancel')}
          overlayClassName={overlayClassName || "z-[70]"}
          className={cn("z-[70] flex flex-col max-h-[85vh] overflow-hidden", className)}
          initialFocus={false}
        >
          <form
            id={formId}
            onSubmit={handleSubmit}
            className="flex-1 min-h-0 flex flex-col pt-3.5 pb-0"
          >
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain space-y-3.5 pr-0.5">
              {/* 表格段落 1: 基本資訊 (共用 SectionCard 內嵌表頭) */}
              <SectionCard
                title={t('workout.basicInfo')}
                className="shrink-0"
                bodyClassName="text-sm font-sans"
              >
                {/* 動作名稱行 (100% 滿寬無膠囊輸入格) */}
                <div className="h-10 relative flex items-stretch bg-card shrink-0 focus-within:ring-1 focus-within:ring-inset focus-within:ring-foreground focus-within:z-[1] transition-shadow duration-100">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t('workout.exerciseNamePlaceholder', '名稱')}
                    aria-label={t('workout.exerciseName')}
                    className="w-full h-full px-4 bg-transparent text-center text-xs font-sans text-foreground font-normal focus:outline-none placeholder:text-muted-foreground/40"
                    maxLength={50}
                  />
                </div>

                {/* 所需器械行 */}
                <div className="h-10 px-4 flex items-center justify-between gap-2 bg-card shrink-0">
                  <span className="text-muted-foreground text-xs shrink-0">
                    {t('workout.equipment')}
                  </span>
                  <Select
                    value={equipment || null}
                    onValueChange={(val) => {
                      if (val === '__add_custom__') {
                        setIsAddEquipmentOpen(true);
                        return;
                      }
                      if (val) {
                        triggerHaptic('selection');
                        setEquipment(val as EquipmentType);
                      }
                    }}
                  >
                    <SelectTrigger
                      size="custom"
                      iconClassName="size-3 text-muted-foreground/60"
                      className="h-7 px-3 rounded-full border border-border/80 bg-background hover:bg-hover font-sans text-xs flex items-center gap-1.5 transition-colors cursor-pointer text-foreground active:scale-95"
                    >
                      <SelectValue
                        className={cn(
                          equipment
                            ? 'font-normal text-foreground'
                            : 'font-normal font-mono text-label-tertiary select-none'
                        )}
                      >
                        {equipment ? getEquipmentDisplayName(equipment, t) : '-'}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent align="end" className="min-w-44 max-h-56 font-mono text-xs">
                      {availableEquipments.map((eq) => (
                        <SelectItem key={eq.id} value={eq.id}>
                          {getEquipmentDisplayName(eq.id, t)}
                        </SelectItem>
                      ))}
                      <SelectItem
                        value="__add_custom__"
                        className="text-xs text-muted-foreground hover:text-foreground font-medium border-t border-border mt-1 pt-1.5 cursor-pointer"
                      >
                        ＋ {t('workout.customEquipment', '自定義器械')}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </SectionCard>

              {/* 表格段落 2: 目標肌群 (復刻 RecipeIngredientsCard 風格) */}
              <SectionCard
                title={`${t('workout.targetMuscles')} (${muscles.length})`}
                className="shrink-0"
                bodyClassName="text-sm"
                action={
                  <button
                    type="button"
                    onClick={handleAddMuscle}
                    disabled={!canAddMoreMuscle}
                    className="h-6 px-2.5 rounded-full border border-border/80 bg-card hover:bg-hover font-mono text-xs flex items-center gap-1 transition-colors cursor-pointer text-muted-foreground hover:text-foreground active:scale-95 select-none disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Plus className="size-3 text-muted-foreground" />
                    <span>{t('common.add')}</span>
                  </button>
                }
              >
                {muscles.length === 0 ? (
                  <div className="min-h-12 py-2 px-3 sm:px-4 flex items-center justify-center shrink-0">
                    <button
                      type="button"
                      onClick={handleAddMuscle}
                      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer select-none font-mono"
                    >
                      <Plus className="size-3.5" />
                      <span>{t('common.add')}</span>
                    </button>
                  </div>
                ) : (
                  muscles.map((item, idx) => {
                    const roleClasses = item.role ? getMuscleRoleBadgeClasses(item.role) : null;
                    const roleLabel = item.role ? getMuscleRoleLabel(item.role, t) : '-';

                    return (
                      <div
                        key={idx}
                        className="min-h-12 py-2 px-3 sm:px-4 flex items-center justify-between gap-2 bg-card shrink-0"
                      >
                        {/* 左側：機能學角色膠囊 + 肌群標準膠囊（靠左對齊並排） */}
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                          <Select
                            value={item.role || null}
                            onValueChange={(val) => {
                              if (val) {
                                triggerHaptic('selection');
                                handleUpdateRole(idx, val as MuscleRole);
                              }
                            }}
                          >
                            <SelectTrigger
                              size="custom"
                              iconClassName={cn(
                                'size-3 shrink-0',
                                roleClasses ? cn('opacity-70', roleClasses.text) : 'text-muted-foreground/60'
                              )}
                              className="h-7 px-3 rounded-full border border-border/80 bg-background hover:bg-hover font-sans text-xs flex items-center gap-1.5 transition-colors cursor-pointer active:scale-95 select-none shrink-0"
                            >
                              <SelectValue
                                className={cn(
                                  'flex-none font-normal truncate',
                                  roleClasses
                                    ? roleClasses.text
                                    : 'font-mono text-label-tertiary select-none'
                                )}
                              >
                                {roleLabel}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent align="start" className="min-w-32 font-mono text-xs">
                              {MUSCLE_ROLES.map(({ role, nameKey }) => {
                                const badgeClasses = getMuscleRoleBadgeClasses(role);
                                return (
                                  <SelectItem key={role} value={role}>
                                    <span className={cn('text-xs font-medium', badgeClasses.text)}>
                                      {t(nameKey)}
                                    </span>
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>

                          <Select
                            value={item.muscle || null}
                            onValueChange={(v) => {
                              if (v) {
                                triggerHaptic('selection');
                                handleUpdateMuscle(idx, v as DetailedMuscle);
                              }
                            }}
                          >
                            <SelectTrigger
                              size="custom"
                              iconClassName="size-3 text-muted-foreground/60 shrink-0"
                              className="h-7 px-3 rounded-full border border-border/80 bg-background hover:bg-hover font-sans text-xs flex items-center gap-1.5 transition-colors cursor-pointer text-foreground active:scale-95 min-w-0 max-w-[148px]"
                            >
                              <SelectValue
                                className={cn(
                                  'flex-none font-normal truncate',
                                  item.muscle
                                    ? 'text-foreground'
                                    : 'font-mono text-label-tertiary select-none'
                                )}
                              >
                                {item.muscle ? getMuscleLabel(item.muscle) : '-'}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent className="max-h-96 font-mono text-xs" align="start">
                              {MAJOR_MUSCLE_GROUPS.map((group) => (
                                <SelectGroup key={group.id}>
                                  <SelectLabel className="px-2 py-0.5 text-[9px] font-mono uppercase tracking-widest text-muted-foreground">
                                    {t(`workout.${group.id}`)}
                                  </SelectLabel>
                                  {group.detailedMuscles.map((m) => {
                                    const isUsedByOther = usedMuscles.has(m) && m !== item.muscle;
                                    return (
                                      <SelectItem
                                        key={m}
                                        value={m}
                                        disabled={isUsedByOther}
                                        className={cn(isUsedByOther && 'opacity-40')}
                                      >
                                        <span className="truncate">{getMuscleLabel(m)}</span>
                                        {isUsedByOther && (
                                          <span className="text-[10px] text-muted-foreground ml-auto">
                                            ({t('common.selected', '已選')})
                                          </span>
                                        )}
                                      </SelectItem>
                                    );
                                  })}
                                </SelectGroup>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* 右側：圓形膠囊刪除按鈕 */}
                        <button
                          type="button"
                          onClick={() => {
                            triggerHaptic('selection');
                            handleRemoveMuscle(idx);
                          }}
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

      {/* 平級兄弟 Dialog：自定義器械 (遵守 Rule 4 扁平兄弟架構) */}
      <EquipmentFormDialog
        open={isAddEquipmentOpen}
        onOpenChange={setIsAddEquipmentOpen}
        onSubmit={handleCreateCustomEquipment}
      />
    </>
  );
}
