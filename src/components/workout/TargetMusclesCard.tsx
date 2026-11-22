import { memo, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DetailedMuscle, MuscleRole } from '@/types';
import type { BodyHighlighterGender } from './BodyHighlighter';
import { BodyHighlighter } from './BodyHighlighter';
import { Popover, PopoverContent } from '@/components/ui/popover';
import { triggerHaptic } from '@/lib/haptics';
import {
  getMuscleRoleBadgeClasses,
  getMuscleRoleLabel,
  normalizeMuscleRole,
  sortMuscleEntries,
} from '@/utils/muscleIntensity';
import { cn } from '@/lib/utils';

export interface TargetMusclesCardProps {
  /** 模型性別：'male' | 'female' */
  gender: BodyHighlighterGender;
  /** 目標肌群與角色/強度映射 */
  muscles: Partial<Record<DetailedMuscle, MuscleRole | number>>;
}

/**
 * 目標細分肌群機能學分析卡片 (與首頁肌群恢復地圖一致，採用 Popover 形式瀏覽肌群)
 */
export const TargetMusclesCard = memo(function TargetMusclesCard({
  gender,
  muscles,
}: TargetMusclesCardProps) {
  const { t } = useTranslation();
  const [selectedMuscle, setSelectedMuscle] = useState<DetailedMuscle | null>(null);
  const [anchorEl, setAnchorEl] = useState<Element | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  const getMuscleLabel = (m: DetailedMuscle) => {
    const key = `workout.muscle${m
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join('')}`;
    return t(key, m);
  };

  const muscleEntries = useMemo(() => {
    return Object.entries(muscles) as [DetailedMuscle, MuscleRole | number][];
  }, [muscles]);

  const primaryEntries = useMemo(
    () =>
      sortMuscleEntries(
        muscleEntries.filter(([, rawRole]) => normalizeMuscleRole(rawRole) === 'primary')
      ),
    [muscleEntries]
  );

  const supportEntries = useMemo(
    () =>
      sortMuscleEntries(
        muscleEntries.filter(([, rawRole]) => normalizeMuscleRole(rawRole) !== 'primary')
      ),
    [muscleEntries]
  );

  const handleMapMuscleClick = (
    muscle: DetailedMuscle,
    _slug: unknown,
    _view: unknown,
    event?: React.MouseEvent<SVGPathElement>
  ) => {
    triggerHaptic('selection');
    if (selectedMuscle === muscle) {
      setSelectedMuscle(null);
      setAnchorEl(null);
    } else {
      setSelectedMuscle(muscle);
      setAnchorEl(event?.currentTarget ?? null);
    }
  };

  const handleBadgeClick = (muscle: DetailedMuscle) => {
    triggerHaptic('selection');
    if (selectedMuscle === muscle) {
      setSelectedMuscle(null);
      setAnchorEl(null);
      return;
    }
    const pathEl = mapContainerRef.current?.querySelector(`[data-muscle="${muscle}"]`) ?? null;
    setSelectedMuscle(muscle);
    setAnchorEl(pathEl);
  };

  const handleClearSelection = () => {
    setSelectedMuscle(null);
    setAnchorEl(null);
  };

  const selectedRawRole = selectedMuscle ? muscles[selectedMuscle] : undefined;
  const selectedRole: MuscleRole | null =
    selectedRawRole !== undefined ? normalizeMuscleRole(selectedRawRole) : null;

  const getRoleDotClass = (role: MuscleRole) => {
    switch (role) {
      case 'primary':
        return 'bg-[var(--muscle-badge-high-text)]';
      case 'secondary':
        return 'bg-[var(--muscle-badge-med-text)]';
      case 'stabilizer':
      default:
        return 'bg-muted-foreground';
    }
  };

  return (
    <>
      <div className="border border-border rounded-lg bg-card overflow-hidden">
        {/* 一體化人體解剖地圖 (與首頁一致：關閉頂部 HUD，改以點擊 Popover 瀏覽) */}
        <div ref={mapContainerRef} className="flex justify-center p-3.5 sm:p-5">
          <BodyHighlighter
            gender={gender}
            muscles={muscles}
            selectedMuscle={selectedMuscle}
            onMuscleClick={handleMapMuscleClick}
            onClearSelection={handleClearSelection}
            view="both"
            size="md"
            interactive
            showLabels
            showOutline
          />
        </div>

        {/* 精密機能學量表 (方案 B3：表頭雙欄 + 彈性膠囊池，無冗餘角色文本) */}
        {muscleEntries.length === 0 ? (
          <div className="border-t border-border px-4 py-4 text-xs font-mono text-muted-foreground text-center">
            {t('workout.noTargetMuscles', '無肌群')}
          </div>
        ) : (
          <div className="border-t border-border">
            {/* 雙欄表頭 */}
            <div className="grid grid-cols-2 divide-x divide-border bg-muted/40 border-b border-border text-2xs font-sans text-muted-foreground">
              <div className="px-3 py-2 flex items-center justify-between gap-2">
                <span className="truncate">{t('workout.primaryMover', '主要發力')}</span>
                <span className="font-mono tabular-nums">{primaryEntries.length}</span>
              </div>
              <div className="px-3 py-2 flex items-center justify-between gap-2">
                <span className="truncate">{t('workout.synergistsAndStabilizers', '協同與穩定')}</span>
                <span className="font-mono tabular-nums">{supportEntries.length}</span>
              </div>
            </div>

            {/* 雙欄彈性膠囊池 */}
            <div className="grid grid-cols-2 divide-x divide-border">
              {/* 左欄：主要發力 */}
              <div className="p-2.5 sm:p-3 flex flex-wrap gap-1.5 content-start">
                {primaryEntries.length === 0 ? (
                  <span className="text-xs font-mono text-muted-foreground/60 px-1">-</span>
                ) : (
                  primaryEntries.map(([m]) => {
                    const isSelected = selectedMuscle === m;
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => handleBadgeClick(m)}
                        className={cn(
                          'min-h-7 px-2.5 py-1 rounded-full border text-xs font-sans inline-flex items-center gap-1.5 transition-colors cursor-pointer select-none active:scale-95',
                          isSelected
                            ? 'bg-foreground text-background border-foreground font-medium'
                            : 'bg-card border-border text-foreground hover:bg-hover'
                        )}
                      >
                        <span
                          aria-hidden="true"
                          className={cn(
                            'size-1.5 rounded-full shrink-0',
                            getRoleDotClass('primary')
                          )}
                        />
                        <span className="whitespace-nowrap">{getMuscleLabel(m)}</span>
                      </button>
                    );
                  })
                )}
              </div>

              {/* 右欄：協同與穩定（無額外文本說明，純色點區分） */}
              <div className="p-2.5 sm:p-3 flex flex-wrap gap-1.5 content-start">
                {supportEntries.length === 0 ? (
                  <span className="text-xs font-mono text-muted-foreground/60 px-1">-</span>
                ) : (
                  supportEntries.map(([m, rawRole]) => {
                    const role = normalizeMuscleRole(rawRole);
                    const isSelected = selectedMuscle === m;
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => handleBadgeClick(m)}
                        className={cn(
                          'min-h-7 px-2.5 py-1 rounded-full border text-xs font-sans inline-flex items-center gap-1.5 transition-colors cursor-pointer select-none active:scale-95',
                          isSelected
                            ? 'bg-foreground text-background border-foreground font-medium'
                            : 'bg-card border-border text-foreground hover:bg-hover'
                        )}
                      >
                        <span
                          aria-hidden="true"
                          className={cn(
                            'size-1.5 rounded-full shrink-0',
                            getRoleDotClass(role)
                          )}
                        />
                        <span className="whitespace-nowrap">{getMuscleLabel(m)}</span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 肌群詳情 Popover 浮層提示 (平級兄弟節點宣告) */}
      <Popover
        open={Boolean(selectedMuscle && anchorEl)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedMuscle(null);
            setAnchorEl(null);
          }
        }}
      >
        {anchorEl && selectedMuscle && (
          <PopoverContent
            anchor={anchorEl}
            side="top"
            sideOffset={8}
            align="center"
            className="p-0 border-none bg-transparent shadow-none flex flex-col items-center animate-none w-auto z-[90]"
          >
            <div className="w-[176px] rounded-lg border border-border bg-popover text-popover-foreground shadow-none font-mono select-none overflow-hidden">
              <div className="px-2.5 py-1.5 border-b border-border bg-muted flex items-center justify-between">
                <span className="font-semibold text-foreground text-[13px] sm:text-sm leading-tight truncate">
                  {getMuscleLabel(selectedMuscle)}
                </span>
              </div>
              <div className="p-2.5 bg-card flex flex-col items-start gap-0.5 overflow-hidden">
                <span className="text-[10px] text-muted-foreground font-normal leading-none truncate">
                  {t('workout.muscleRole', '發力角色')}
                </span>
                <span
                  className={cn(
                    'text-xs leading-tight truncate mt-0.5',
                    selectedRole
                      ? cn('font-semibold', getMuscleRoleBadgeClasses(selectedRole).text)
                      : 'font-normal text-muted-foreground'
                  )}
                >
                  {selectedRole
                    ? getMuscleRoleLabel(selectedRole, t)
                    : t('workout.none', '無')}
                </span>
              </div>
            </div>
          </PopoverContent>
        )}
      </Popover>
    </>
  );
});
