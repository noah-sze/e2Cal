import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { toast } from '@/components/ui/toast';
import { CopySnippet } from '../components/CopySnippet';
import { cn } from '@/lib/utils';

// 飲食模組 Dialogs
import { FoodFormDialog } from '@/components/food/FoodFormDialog';
import { RecipeDialog } from '@/components/food/RecipeDialog';
import { FoodRecipeSelectDialog } from '@/components/food/FoodRecipeSelectDialog';
import { EditFoodLogDialog } from '@/components/diet/EditFoodLogDialog';
import { CopyMealDialog } from '@/components/diet/CopyMealDialog';
import { CopyMealDatePickerDialog } from '@/components/diet/CopyMealDatePickerDialog';
import { QuickPlaceholderDialog } from '@/components/diet/QuickPlaceholderDialog';
import { RawWeightGuideDialog } from '@/components/diet/RawWeightGuideDialog';
import { DietPlanModal } from '@/components/diet/DietPlanModal';
import { ActivityLevelDialog } from '@/components/diet/ActivityLevelDialog';

// 訓練模組 Dialogs
import { ExerciseFormDialog } from '@/components/workout/ExerciseFormDialog';
import { EquipmentFormDialog } from '@/components/workout/EquipmentFormDialog';
import { RoutineFormDialog } from '@/components/workout/RoutineFormDialog';
import { ExerciseSelectDialog } from '@/components/workout/ExerciseSelectDialog';
import { CopyWorkoutDialog } from '@/components/workout/CopyWorkoutDialog';
import { CopyWorkoutDatePickerDialog } from '@/components/workout/CopyWorkoutDatePickerDialog';

// 設定、備份與系統通用 Dialogs
import { SetupProfileDialog } from '@/components/welcome/SetupProfileDialog';
import { LocalImportDialog } from '@/components/welcome/LocalImportDialog';
import { ImportStrategyModal } from '@/components/settings/dialogs/ImportStrategyModal';
import { ClearDataModal } from '@/components/settings/ClearDataModal';
import { DropboxSyncDialog } from '@/components/settings/dialogs/DropboxSyncDialog';
import { InitialSyncModal } from '@/components/sync/InitialSyncModal';
import { CopyDailyDataDialog } from '@/components/common/CopyDailyDataDialog';
import type { InitialSyncStep } from '@/services/sync/initialSyncManager';
import { PwaInstallGuideDialog } from '@/components/pwa/PwaInstallGuideDialog';
import { ResponsiveNumericKeypad } from '@/components/ui/ResponsiveNumericKeypad';
import { MonthPickerDialog } from '@/components/ui/month-picker';

import type {
  FoodItem,
  FoodRecipe,
  Exercise,
  Equipment,
  WorkoutRoutine,
  HydratedFoodLog,
  UserProfile,
  UserBaseInfo,
} from '@/types';

// ==================== 符合設計標準之 Mock 數據源 ====================
// 嚴格遵守規範第 16、29、156 條：食物名稱無「生」字前綴、無「生重」後綴、無烹飪手法形容詞
const MOCK_FOOD: FoodItem = {
  id: 'mock-food-1',
  name: '雞胸肉',
  category: 'natural',
  servingSize: 100,
  servingUnit: 'g',
  calories: 165,
  protein: 31,
  carbs: 0,
  fat: 3.6,
  isCustom: true,
  isArchived: false,
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

const MOCK_RECIPE: FoodRecipe = {
  id: 'mock-recipe-1',
  name: '雞胸肉義大利麵',
  ingredients: [
    { foodId: 'mock-food-1', quantity: 150, unit: 'g' },
  ],
  isCustom: true,
  isArchived: false,
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

const MOCK_HYDRATED_FOOD_LOG: HydratedFoodLog = {
  id: 'mock-log-1',
  date: '2026-11-19',
  mealType: 'lunch',
  entryType: 'item',
  foodId: 'mock-food-1',
  foodName: '雞胸肉',
  quantity: 180,
  unit: 'g',
  calories: 297,
  carbs: 0,
  protein: 55.8,
  fat: 6.5,
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

const MOCK_EXERCISE: Exercise = {
  id: 'mock-exercise-1',
  name: '槓鈴深蹲',
  equipment: 'barbell',
  targetMuscles: {
    quads: 'primary',
    glutes: 'secondary',
    lower_back: 'stabilizer',
  },
  isCustom: false,
  isArchived: false,
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

// 嚴格遵守規範第 28、148 條：動作組合僅保留動作引用，絕不包含 defaultSets 等組數快照
const MOCK_ROUTINE: WorkoutRoutine = {
  id: 'mock-routine-1',
  name: '腿部訓練',
  exercises: [
    { exerciseId: 'mock-exercise-1' },
  ],
  isCustom: true,
  isArchived: false,
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

const MOCK_USER_PROFILE: UserProfile = {
  id: 'user-1',
  name: '測試運動員',
  gender: 'male',
  birthDate: '1995-06-15',
  heightCm: 178,
  currentWeightKg: 75,
  activityLevel: 1.2,
  macroSplit: { carbs: 50, protein: 30, fat: 20 },
  weightUnit: 'kg',
  isSetupCompleted: true,
  updatedAt: Date.now(),
};

const MOCK_BASE_INFO: UserBaseInfo = {
  id: 'user-1',
  name: '測試運動員',
  gender: 'male',
  birthDate: '1995-06-15',
  heightCm: 178,
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

const MOCK_EQUIPMENT: Equipment = {
  id: 'eq-1',
  name: '奧林匹克長槓',
  isCustom: true,
  isArchived: false,
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

export interface DialogAction {
  label: string;
  onOpen: () => void;
  variant?: 'outline' | 'default' | 'destructive';
}

export interface DialogRowItemProps {
  name: string;
  component: string;
  desc: string;
  badge?: string;
  onOpen?: () => void;
  actions?: DialogAction[];
}

const DialogRowItem: React.FC<DialogRowItemProps> = ({
  name,
  component,
  desc,
  badge = 'Modal',
  onOpen,
  actions,
}) => {
  const finalActions: DialogAction[] = actions ?? (onOpen ? [{ label: '測試', onOpen }] : []);

  return (
    <div className="px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:bg-hover transition-colors">
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-foreground">{name}</span>
          <CopySnippet variant="subtle" className="text-2xs" value={component}>
            {component}
          </CopySnippet>
          <Badge variant="outline" className="text-3xs font-mono py-0 h-4 px-1 border-border shadow-none">
            {badge}
          </Badge>
        </div>
        <div className="text-2xs text-muted-foreground truncate">{desc}</div>
      </div>
      <div className="shrink-0 flex items-center justify-end gap-1.5 flex-wrap">
        {finalActions.map((action, idx) => (
          <Button
            key={idx}
            variant={action.variant ?? 'outline'}
            size="sm"
            className={cn(
              'h-6 text-2xs font-mono px-2.5 border-border shadow-none',
              action.variant === 'destructive'
                ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                : 'hover:bg-foreground hover:text-background'
            )}
            onClick={action.onOpen}
          >
            {action.label}
          </Button>
        ))}
      </div>
    </div>
  );
};

export const DialogsTab: React.FC = () => {
  const confirm = useConfirm();

  // 飲食模組 State (9 項獨立組件)
  const [foodFormOpen, setFoodFormOpen] = useState(false);
  const [foodFormEditMode, setFoodFormEditMode] = useState(false);

  const [recipeDialogOpen, setRecipeDialogOpen] = useState(false);
  const [recipeDialogMode, setRecipeDialogMode] = useState<
    'recipe-create' | 'recipe-edit' | 'log-create' | 'log-edit'
  >('recipe-create');

  const [foodRecipeSelectOpen, setFoodRecipeSelectOpen] = useState(false);
  const [editFoodLogOpen, setEditFoodLogOpen] = useState(false);
  const [copyMealOpen, setCopyMealOpen] = useState(false);
  const [copyMealDatePickerOpen, setCopyMealDatePickerOpen] = useState(false);
  const [quickPlaceholderOpen, setQuickPlaceholderOpen] = useState(false);
  const [rawWeightGuideOpen, setRawWeightGuideOpen] = useState(false);
  const [dietPlanOpen, setDietPlanOpen] = useState(false);
  const [activityLevelOpen, setActivityLevelOpen] = useState(false);
  const [activityLevelVal, setActivityLevelVal] = useState(1.55);

  // 訓練模組 State (6 項獨立組件)
  const [exerciseFormOpen, setExerciseFormOpen] = useState(false);
  const [exerciseFormEditMode, setExerciseFormEditMode] = useState(false);

  const [equipmentFormOpen, setEquipmentFormOpen] = useState(false);
  const [equipmentFormEditMode, setEquipmentFormEditMode] = useState(false);

  const [routineFormOpen, setRoutineFormOpen] = useState(false);
  const [routineFormEditMode, setRoutineFormEditMode] = useState(false);

  const [exerciseSelectOpen, setExerciseSelectOpen] = useState(false);
  const [copyWorkoutOpen, setCopyWorkoutOpen] = useState(false);
  const [copyWorkoutDatePickerOpen, setCopyWorkoutDatePickerOpen] = useState(false);

  // 系統與設定模組 State (10 項獨立組件)
  const [setupProfileOpen, setSetupProfileOpen] = useState(false);
  const [localImportOpen, setLocalImportOpen] = useState(false);
  const [importStrategyOpen, setImportStrategyOpen] = useState(false);
  const [clearDataOpen, setClearDataOpen] = useState(false);
  const [dropboxSyncOpen, setDropboxSyncOpen] = useState(false);
  const [dropboxConnectOpen, setDropboxConnectOpen] = useState(false);
  const [initialSyncPreviewOpen, setInitialSyncPreviewOpen] = useState(false);
  const [initialSyncPreviewStep, setInitialSyncPreviewStep] = useState<InitialSyncStep>('STRATEGY');
  const [copyDailyDataOpen, setCopyDailyDataOpen] = useState(false);
  const [pwaGuideOpen, setPwaGuideOpen] = useState(false);
  const [keypadOpen, setKeypadOpen] = useState(false);
  const [keypadVal, setKeypadVal] = useState(150);
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [monthPickerVal, setMonthPickerVal] = useState('1997-11');

  // 極簡 Toast 回應：嚴格遵守規則 68 條法則 4「對象 + 結果，2～4 個字結束」
  const handleTestConfirm = async (variant: 'default' | 'destructive' | 'archive') => {
    const isConfirmed = await confirm({
      title: variant === 'destructive' ? '永久刪除' : variant === 'archive' ? '歸檔' : '確認變更',
      description: '此為開發者後台調試展示，確認後不會摧毀真實資料庫。',
      variant,
      confirmText: variant === 'destructive' ? '刪除' : '確認',
      cancelText: '取消',
    });
    if (isConfirmed) {
      toast.show('已確認');
    }
  };

  return (
    <div className="space-y-6">
      {/* 標題與客觀計數 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-foreground font-sans">
            彈窗型錄
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5 font-sans">
            全應用程式 27 個業務 Dialog 統一驗收矩陣，支援同組件多形態（新增/編輯、已連線/未連線）整合檢視。
          </p>
        </div>
        <div className="text-2xs font-mono text-muted-foreground tabular-nums">
          27 項元件
        </div>
      </div>

      {/* 1. 飲食與營養模組 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-mono text-muted-foreground">
            飲食與營養 (10)
          </h3>
        </div>
        <div className="divide-y divide-border rounded-lg border border-border bg-card overflow-hidden shadow-none">
          <DialogRowItem
            name="食材表單"
            component="FoodFormDialog"
            desc="5 大分類、生重基準折算與度量單位 (支援空白與既有數據)"
            badge="Form"
            actions={[
              {
                label: '新增',
                onOpen: () => {
                  setFoodFormEditMode(false);
                  setFoodFormOpen(true);
                },
              },
              {
                label: '編輯',
                onOpen: () => {
                  setFoodFormEditMode(true);
                  setFoodFormOpen(true);
                },
              },
            ]}
          />
          <DialogRowItem
            name="菜餚／食譜"
            component="RecipeDialog"
            desc="統一元件：食譜原型定義（新增／編輯）與飲食日誌複合菜餚（秤重暫存／組合編輯）"
            badge="Recipe"
            actions={[
              {
                label: '新增食譜',
                onOpen: () => {
                  setRecipeDialogMode('recipe-create');
                  setRecipeDialogOpen(true);
                },
              },
              {
                label: '編輯食譜',
                onOpen: () => {
                  setRecipeDialogMode('recipe-edit');
                  setRecipeDialogOpen(true);
                },
              },
              {
                label: '新增秤重',
                onOpen: () => {
                  setRecipeDialogMode('log-create');
                  setRecipeDialogOpen(true);
                },
              },
              {
                label: '編輯組合',
                onOpen: () => {
                  setRecipeDialogMode('log-edit');
                  setRecipeDialogOpen(true);
                },
              },
            ]}
          />
          <DialogRowItem
            name="食材/菜餚選擇器"
            component="FoodRecipeSelectDialog"
            desc="雙 Tab 食材與菜餚快速檢索與多語系比對"
            badge="Selector"
            onOpen={() => setFoodRecipeSelectOpen(true)}
          />
          <DialogRowItem
            name="單品日誌"
            component="EditFoodLogDialog"
            desc="調整已記錄食材的攝入克數與數值"
            badge="Log"
            onOpen={() => setEditFoodLogOpen(true)}
          />
          <DialogRowItem
            name="複製餐點"
            component="CopyMealDialog"
            desc="複製過往餐點條目，四餐別切換與雙行食材清單"
            badge="Copy"
            onOpen={() => setCopyMealOpen(true)}
          />
          <DialogRowItem
            name="餐點日曆"
            component="CopyMealDatePickerDialog"
            desc="二級日曆，僅高亮存在歷史餐點記錄之日期"
            badge="Picker"
            onOpen={() => setCopyMealDatePickerOpen(true)}
          />
          <DialogRowItem
            name="外食估算"
            component="QuickPlaceholderDialog"
            desc="外食情境粗估與按計劃熱量配額佔位"
            badge="Placeholder"
            onOpen={() => setQuickPlaceholderOpen(true)}
          />
          <DialogRowItem
            name="生重認知"
            component="RawWeightGuideDialog"
            desc="烹調手法輪播與防呆關鍵字解鎖"
            badge="Guide"
            onOpen={() => setRawWeightGuideOpen(true)}
          />
          <DialogRowItem
            name="飲食計劃"
            component="DietPlanModal"
            desc="每日熱量目標與 C · P · F 供能比模板"
            badge="Plan"
            onOpen={() => setDietPlanOpen(true)}
          />
          <DialogRowItem
            name="活動係數"
            component="ActivityLevelDialog"
            desc="Mifflin-St Jeor 基礎代謝 × 活動係數計算明細與強度選擇"
            badge="PAL"
            onOpen={() => setActivityLevelOpen(true)}
          />
        </div>
      </div>

      {/* 2. 肌力與訓練模組 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-mono text-muted-foreground">
            肌力與訓練 (6)
          </h3>
        </div>
        <div className="divide-y divide-border rounded-lg border border-border bg-card overflow-hidden shadow-none">
          <DialogRowItem
            name="動作表單"
            component="ExerciseFormDialog"
            desc="器材類型、17 個解剖肌群 3 級角色指派 (支援空白與既有數據)"
            badge="Form"
            actions={[
              {
                label: '新增',
                onOpen: () => {
                  setExerciseFormEditMode(false);
                  setExerciseFormOpen(true);
                },
              },
              {
                label: '編輯',
                onOpen: () => {
                  setExerciseFormEditMode(true);
                  setExerciseFormOpen(true);
                },
              },
            ]}
          />
          <DialogRowItem
            name="器材規格"
            component="EquipmentFormDialog"
            desc="自定義器材名稱與分類 (支援空白與既有數據)"
            badge="Equipment"
            actions={[
              {
                label: '新增',
                onOpen: () => {
                  setEquipmentFormEditMode(false);
                  setEquipmentFormOpen(true);
                },
              },
              {
                label: '編輯',
                onOpen: () => {
                  setEquipmentFormEditMode(true);
                  setEquipmentFormOpen(true);
                },
              },
            ]}
          />
          <DialogRowItem
            name="課表編排"
            component="RoutineFormDialog"
            desc="編排固定動作組合課表 (支援空白與既有數據)"
            badge="Routine"
            actions={[
              {
                label: '新增',
                onOpen: () => {
                  setRoutineFormEditMode(false);
                  setRoutineFormOpen(true);
                },
              },
              {
                label: '編輯',
                onOpen: () => {
                  setRoutineFormEditMode(true);
                  setRoutineFormOpen(true);
                },
              },
            ]}
          />
          <DialogRowItem
            name="動作/課表選擇器"
            component="ExerciseSelectDialog"
            desc="雙 Tab 動作與課表快速選取器"
            badge="Selector"
            onOpen={() => setExerciseSelectOpen(true)}
          />
          <DialogRowItem
            name="複製訓練"
            component="CopyWorkoutDialog"
            desc="複製過往訓練動作與組數，支援雙行容量預覽與微調"
            badge="Copy"
            onOpen={() => setCopyWorkoutOpen(true)}
          />
          <DialogRowItem
            name="訓練日曆"
            component="CopyWorkoutDatePickerDialog"
            desc="二級日曆，僅高亮曾有訓練組數之日期"
            badge="Picker"
            onOpen={() => setCopyWorkoutDatePickerOpen(true)}
          />
        </div>
      </div>

      {/* 3. 設定、同步與通用 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-mono text-muted-foreground">
            設定、同步與通用 (11)
          </h3>
        </div>
        <div className="divide-y divide-border rounded-lg border border-border bg-card overflow-hidden shadow-none">
          <DialogRowItem
            name="基本資料"
            component="SetupProfileDialog"
            desc="姓名、性別、出生年月、身高體重初始配置"
            badge="Profile"
            onOpen={() => setSetupProfileOpen(true)}
          />
          <DialogRowItem
            name="本地還原"
            component="LocalImportDialog"
            desc="ZIP 檔案離線解析與摘要確認"
            badge="Import"
            onOpen={() => setLocalImportOpen(true)}
          />
          <DialogRowItem
            name="衝突策略"
            component="ImportStrategyModal"
            desc="備份身分不一致時的覆寫或增量合併決策"
            badge="Strategy"
            onOpen={() => setImportStrategyOpen(true)}
          />
          <DialogRowItem
            name="出廠重置"
            component="ClearDataModal"
            desc="輸入確認詞並長按 0.5 秒確認的高危出廠清庫"
            badge="Destructive"
            onOpen={() => setClearDataOpen(true)}
          />
          <DialogRowItem
            name="Dropbox 同步"
            component="DropboxSyncDialog"
            desc="統一連線授權說明、同步狀態檢視與長按中斷連線"
            badge="Sync"
            actions={[
              {
                label: '已連線',
                onOpen: () => setDropboxSyncOpen(true),
              },
              {
                label: '未連線',
                onOpen: () => setDropboxConnectOpen(true),
              },
            ]}
          />
          <DialogRowItem
            name="同步過程"
            component="InitialSyncModal"
            desc="首次連線同步流程：連線中、衝突策略、下載、寫入與完成"
            badge="Flow"
            actions={[
              {
                label: '連線中',
                onOpen: () => {
                  setInitialSyncPreviewStep('AUTH');
                  setInitialSyncPreviewOpen(true);
                },
              },
              {
                label: '策略',
                onOpen: () => {
                  setInitialSyncPreviewStep('STRATEGY');
                  setInitialSyncPreviewOpen(true);
                },
              },
              {
                label: '下載',
                onOpen: () => {
                  setInitialSyncPreviewStep('DOWNLOADING');
                  setInitialSyncPreviewOpen(true);
                },
              },
              {
                label: '寫入',
                onOpen: () => {
                  setInitialSyncPreviewStep('APPLYING');
                  setInitialSyncPreviewOpen(true);
                },
              },
              {
                label: '完成',
                onOpen: () => {
                  setInitialSyncPreviewStep('COMPLETED');
                  setInitialSyncPreviewOpen(true);
                },
              },
            ]}
          />
          <DialogRowItem
            name="數據匯出"
            component="CopyDailyDataDialog"
            desc="匯出 Markdown、JSON 或離線 Canvas 長圖"
            badge="Export"
            onOpen={() => setCopyDailyDataOpen(true)}
          />
          <DialogRowItem
            name="安裝教學"
            component="PwaInstallGuideDialog"
            desc="5 大平台離線安裝圖文教學"
            badge="PWA"
            onOpen={() => setPwaGuideOpen(true)}
          />
          <DialogRowItem
            name="虛擬鍵盤"
            component="ResponsiveNumericKeypad"
            desc="高對比虛擬數字鍵盤，帶小數與單位切換"
            badge="Keypad"
            onOpen={() => setKeypadOpen(true)}
          />
          <DialogRowItem
            name="出生年月"
            component="MonthPickerDialog"
            desc="十年矩陣與 4×3 月份全顯網格，即時換算歲數"
            badge="Picker"
            onOpen={() => setMonthPickerOpen(true)}
          />
          <DialogRowItem
            name="確認彈窗"
            component="ConfirmDialog (useConfirm)"
            desc="全站通用防呆二次確認，支援普通確認、毀滅性操作與歸檔形態"
            badge="Confirm"
            actions={[
              {
                label: '普通',
                onOpen: () => handleTestConfirm('default'),
              },
              {
                label: '毀滅',
                variant: 'destructive',
                onOpen: () => handleTestConfirm('destructive'),
              },
              {
                label: '歸檔',
                onOpen: () => handleTestConfirm('archive'),
              },
            ]}
          />
        </div>
      </div>

      {/* ==================== 實際掛載 24 個 Dialog 實體 ==================== */}

      {/* 飲食 1: 食材表單 */}
      <FoodFormDialog
        open={foodFormOpen}
        onOpenChange={setFoodFormOpen}
        initialData={foodFormEditMode ? MOCK_FOOD : null}
        onSubmit={async () => {
          toast.show('已儲存');
          setFoodFormOpen(false);
        }}
      />

      {/* 飲食 2: 菜餚／食譜統一彈窗（涵蓋原型定義與日誌秤重編輯 4 種形態） */}
      <RecipeDialog
        variant={recipeDialogMode.startsWith('recipe') ? 'recipe' : 'log'}
        open={recipeDialogOpen}
        onOpenChange={setRecipeDialogOpen}
        initialData={recipeDialogMode === 'recipe-edit' ? MOCK_RECIPE : null}
        onSubmit={
          recipeDialogMode.startsWith('recipe')
            ? async () => {
                toast.show('已儲存');
                setRecipeDialogOpen(false);
              }
            : undefined
        }
        mode={recipeDialogMode === 'log-edit' ? 'edit' : 'create'}
        recipe={recipeDialogMode === 'log-create' ? MOCK_RECIPE : null}
        mealType="lunch"
        date={new Date().toISOString().slice(0, 10)}
        bundleId={recipeDialogMode === 'log-edit' ? 'bundle-1' : undefined}
        bundleTitle={recipeDialogMode === 'log-edit' ? '雞胸肉義大利麵' : undefined}
        logs={recipeDialogMode === 'log-edit' ? [MOCK_HYDRATED_FOOD_LOG] : undefined}
        onSuccess={() => {
          toast.show('已記錄');
          setRecipeDialogOpen(false);
        }}
        onSave={async () => {
          toast.show('已更新');
          setRecipeDialogOpen(false);
        }}
        onDeleteBundle={async () => {
          toast.show('已刪除');
          setRecipeDialogOpen(false);
        }}
      />

      {/* 飲食 4: 食材/食譜選擇器 */}
      <FoodRecipeSelectDialog
        open={foodRecipeSelectOpen}
        onOpenChange={setFoodRecipeSelectOpen}
        onSelect={() => {
          toast.show('已選取');
          setFoodRecipeSelectOpen(false);
        }}
      />

      {/* 飲食 5: 編輯食材記錄 */}
      <EditFoodLogDialog
        open={editFoodLogOpen}
        onOpenChange={setEditFoodLogOpen}
        log={MOCK_HYDRATED_FOOD_LOG}
        onSave={async () => {
          toast.show('已更新');
          setEditFoodLogOpen(false);
        }}
        onDelete={async () => {
          toast.show('已刪除');
          setEditFoodLogOpen(false);
        }}
      />

      {/* 飲食 6: 複製餐點 */}
      <CopyMealDialog
        open={copyMealOpen}
        onOpenChange={setCopyMealOpen}
        targetMealType="lunch"
        targetDate={new Date().toISOString().slice(0, 10)}
      />

      {/* 飲食 7: 複製餐點日期選擇器 */}
      <CopyMealDatePickerDialog
        open={copyMealDatePickerOpen}
        onOpenChange={setCopyMealDatePickerOpen}
        targetMealType="lunch"
        targetDate={new Date().toISOString().slice(0, 10)}
        selectedDate={null}
        recordedDates={[new Date().toISOString().slice(0, 10)]}
        onSelectDate={() => {
          toast.show('已選取');
          setCopyMealDatePickerOpen(false);
        }}
      />

      {/* 飲食 8: 外食估算/配額佔位 */}
      <QuickPlaceholderDialog
        open={quickPlaceholderOpen}
        onOpenChange={setQuickPlaceholderOpen}
        targetMealType="dinner"
        targetDate={new Date().toISOString().slice(0, 10)}
        onConfirm={async () => {
          toast.show('已記錄');
          setQuickPlaceholderOpen(false);
        }}
      />

      {/* 飲食 9: 生重引導 */}
      <RawWeightGuideDialog
        open={rawWeightGuideOpen}
        onOpenChange={setRawWeightGuideOpen}
        onConfirm={() => {
          toast.show('已解鎖');
          setRawWeightGuideOpen(false);
        }}
      />

      {/* 飲食 10: 飲食計劃設定 */}
      <DietPlanModal
        isOpen={dietPlanOpen}
        onClose={() => setDietPlanOpen(false)}
        profile={MOCK_USER_PROFILE}
        onSave={async (_updates) => {
          toast.show('已儲存');
          setDietPlanOpen(false);
        }}
      />

      {/* 飲食 11: 活動係數與熱量消耗明細 */}
      <ActivityLevelDialog
        isOpen={activityLevelOpen}
        onClose={() => setActivityLevelOpen(false)}
        currentActivity={activityLevelVal}
        profile={MOCK_USER_PROFILE}
        onSave={(val) => {
          setActivityLevelVal(val);
          toast.show('已更新');
        }}
      />

      {/* 訓練 1: 動作表單 */}
      <ExerciseFormDialog
        open={exerciseFormOpen}
        onOpenChange={setExerciseFormOpen}
        initialData={exerciseFormEditMode ? MOCK_EXERCISE : null}
        onSubmit={async () => {
          toast.show('已儲存');
          setExerciseFormOpen(false);
        }}
      />

      {/* 訓練 2: 器材表單 */}
      <EquipmentFormDialog
        open={equipmentFormOpen}
        onOpenChange={setEquipmentFormOpen}
        equipment={equipmentFormEditMode ? MOCK_EQUIPMENT : null}
        onSubmit={async () => {
          toast.show('已儲存');
          setEquipmentFormOpen(false);
        }}
      />

      {/* 訓練 3: 課表表單 */}
      <RoutineFormDialog
        open={routineFormOpen}
        onOpenChange={setRoutineFormOpen}
        initialData={routineFormEditMode ? MOCK_ROUTINE : null}
        onSubmit={async () => {
          toast.show('已儲存');
          setRoutineFormOpen(false);
        }}
      />

      {/* 訓練 4: 動作/課表選擇器 */}
      <ExerciseSelectDialog
        open={exerciseSelectOpen}
        onOpenChange={setExerciseSelectOpen}
        onSelect={() => {
          toast.show('已選取');
          setExerciseSelectOpen(false);
        }}
      />

      {/* 訓練 5: 複製訓練 */}
      <CopyWorkoutDialog
        open={copyWorkoutOpen}
        onOpenChange={setCopyWorkoutOpen}
        targetDate={new Date().toISOString().slice(0, 10)}
      />

      {/* 訓練 6: 複製訓練日期選擇器 */}
      <CopyWorkoutDatePickerDialog
        open={copyWorkoutDatePickerOpen}
        onOpenChange={setCopyWorkoutDatePickerOpen}
        targetDate={new Date().toISOString().slice(0, 10)}
        selectedDate={null}
        recordedDates={[new Date().toISOString().slice(0, 10)]}
        onSelectDate={() => {
          toast.show('已選取');
          setCopyWorkoutDatePickerOpen(false);
        }}
      />

      {/* 系統 1: 基本資料設定 */}
      <SetupProfileDialog
        open={setupProfileOpen}
        onOpenChange={setSetupProfileOpen}
        onComplete={() => {
          toast.show('已更新');
          setSetupProfileOpen(false);
        }}
      />

      {/* 系統 2: 本地備份還原 */}
      <LocalImportDialog
        open={localImportOpen}
        onOpenChange={setLocalImportOpen}
        onComplete={() => {
          toast.show('已還原');
          setLocalImportOpen(false);
        }}
      />

      {/* 系統 3: 匯入策略衝突決策 */}
      <ImportStrategyModal
        isOpen={importStrategyOpen}
        onClose={() => setImportStrategyOpen(false)}
        localBaseInfo={MOCK_BASE_INFO}
        backupBaseInfo={{ ...MOCK_BASE_INFO, name: '雲端同步使用者' }}
        onConfirm={async () => {
          toast.show('已設定');
          setImportStrategyOpen(false);
        }}
      />

      {/* 系統 4: 清空數據出廠重置 */}
      <ClearDataModal
        isOpen={clearDataOpen}
        onClose={() => setClearDataOpen(false)}
      />

      {/* 系統 5: Dropbox 同步控制台 */}
      <DropboxSyncDialog
        open={dropboxSyncOpen}
        onOpenChange={setDropboxSyncOpen}
        isAuthenticated={true}
        isSyncing={false}
        lastSyncTime={new Date().toISOString()}
        isOnline={true}
        onConnectDropbox={() => toast.show('已連線')}
        onDisconnectDropbox={() => toast.show('已斷開')}
        onSyncNow={async () => {
          toast.show('已同步');
        }}
      />

      {/* 系統 6: Dropbox 連線授權確認（未連線狀態） */}
      <DropboxSyncDialog
        open={dropboxConnectOpen}
        onOpenChange={setDropboxConnectOpen}
        isAuthenticated={false}
        onConnectDropbox={() => toast.show('已授權')}
      />

      {/* 系統 6b: Dropbox 首次同步過程預覽 */}
      <InitialSyncModal
        preview={{
          open: initialSyncPreviewOpen,
          step: initialSyncPreviewStep,
          onClose: () => setInitialSyncPreviewOpen(false),
        }}
      />

      {/* 系統 7: 每日數據匯出分享卡 */}
      <CopyDailyDataDialog
        open={copyDailyDataOpen}
        onOpenChange={setCopyDailyDataOpen}
        date={new Date().toISOString().slice(0, 10)}
        scope="all"
      />

      {/* 系統 8: PWA 5 平台安裝教學 */}
      <PwaInstallGuideDialog
        open={pwaGuideOpen}
        onOpenChange={setPwaGuideOpen}
        onHidePrompt={() => setPwaGuideOpen(false)}
      />

      {/* 系統 9: 虛擬精密數字鍵盤 */}
      <ResponsiveNumericKeypad
        open={keypadOpen}
        onOpenChange={setKeypadOpen}
        title="份量調整"
        value={keypadVal}
        unit="g"
        allowedUnits={['g', 'oz']}
        onUnitChange={(u) => toast.show(`單位: ${u}`)}
        onConfirm={(val) => {
          setKeypadVal(Number(val) || 0);
          toast.show('已變更');
        }}
      />

      {/* 系統 10: 出生年月選擇器 */}
      <MonthPickerDialog
        open={monthPickerOpen}
        onOpenChange={setMonthPickerOpen}
        value={monthPickerVal}
        onChange={(val) => {
          setMonthPickerVal(val);
          toast.show('已變更');
        }}
      />
    </div>
  );
};
