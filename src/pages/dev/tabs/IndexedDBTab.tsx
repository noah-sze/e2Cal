import { useState, useEffect, useMemo, useCallback } from 'react';
import { RefreshCw, Trash2, Database, Plus, Search, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { MetricValue } from '@/components/ui/metric-value';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/components/ui/toast';
import { CopySnippet } from '../components/CopySnippet';
import { db } from '@/services/db/db';
import type {
  BodyMetric,
  DailyDietLog,
  FoodItem,
  WorkoutLog,
} from '@/types';

type TableKey =
  | 'user_base_info'
  | 'foods'
  | 'recipes'
  | 'daily_diet_logs'
  | 'exercises'
  | 'equipments'
  | 'routines'
  | 'workout_logs'
  | 'body_metrics';

interface TableMeta {
  key: TableKey;
  label: string;
}

const TABLE_METAS: ReadonlyArray<TableMeta> = [
  { key: 'user_base_info', label: 'user_base_info' },
  { key: 'foods', label: 'foods' },
  { key: 'recipes', label: 'recipes' },
  { key: 'daily_diet_logs', label: 'daily_diet_logs' },
  { key: 'exercises', label: 'exercises' },
  { key: 'equipments', label: 'equipments' },
  { key: 'routines', label: 'routines' },
  { key: 'workout_logs', label: 'workout_logs' },
  { key: 'body_metrics', label: 'body_metrics' },
];

const PAGE_SIZE = 20;

interface TableRowRecord {
  id: string;
  name?: string;
  date?: string;
  updatedAt?: number;
  rev?: number;
}

async function readTableRows(tableKey: TableKey): Promise<TableRowRecord[]> {
  switch (tableKey) {
    case 'user_base_info':
      return await db.user_base_info.toArray();
    case 'foods':
      return await db.foods.toArray();
    case 'recipes':
      return await db.recipes.toArray();
    case 'daily_diet_logs':
      return await db.daily_diet_logs.toArray();
    case 'exercises':
      return await db.exercises.toArray();
    case 'equipments':
      return await db.equipments.toArray();
    case 'routines':
      return await db.routines.toArray();
    case 'workout_logs':
      return await db.workout_logs.toArray();
    case 'body_metrics':
      return await db.body_metrics.toArray();
  }
}

async function deleteTableRow(tableKey: TableKey, id: string): Promise<void> {
  switch (tableKey) {
    case 'user_base_info':
      await db.user_base_info.delete(id);
      break;
    case 'foods':
      await db.foods.delete(id);
      break;
    case 'recipes':
      await db.recipes.delete(id);
      break;
    case 'daily_diet_logs':
      await db.daily_diet_logs.delete(id);
      break;
    case 'exercises':
      await db.exercises.delete(id);
      break;
    case 'equipments':
      await db.equipments.delete(id);
      break;
    case 'routines':
      await db.routines.delete(id);
      break;
    case 'workout_logs':
      await db.workout_logs.delete(id);
      break;
    case 'body_metrics':
      await db.body_metrics.delete(id);
      break;
  }
}

async function clearSingleTable(tableKey: TableKey): Promise<void> {
  switch (tableKey) {
    case 'user_base_info':
      await db.user_base_info.clear();
      break;
    case 'foods':
      await db.foods.clear();
      break;
    case 'recipes':
      await db.recipes.clear();
      break;
    case 'daily_diet_logs':
      await db.daily_diet_logs.clear();
      break;
    case 'exercises':
      await db.exercises.clear();
      break;
    case 'equipments':
      await db.equipments.clear();
      break;
    case 'routines':
      await db.routines.clear();
      break;
    case 'workout_logs':
      await db.workout_logs.clear();
      break;
    case 'body_metrics':
      await db.body_metrics.clear();
      break;
  }
}

function formatDateOffset(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

/**
 * Live IndexedDB (Dexie) 檢視與開發測試資料生成器
 */
export function IndexedDBTab() {
  const [selectedTable, setSelectedTable] = useState<TableKey>('foods');
  const [counts, setCounts] = useState<Record<TableKey, number>>({
    user_base_info: 0,
    foods: 0,
    recipes: 0,
    daily_diet_logs: 0,
    exercises: 0,
    equipments: 0,
    routines: 0,
    workout_logs: 0,
    body_metrics: 0,
  });
  const [rows, setRows] = useState<TableRowRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [confirmClearTable, setConfirmClearTable] = useState(false);
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  const loadCountsAndRows = useCallback(async (tableKey: TableKey) => {
    setIsLoading(true);
    try {
      const [
        cUser,
        cFoods,
        cRecipes,
        cDiet,
        cEx,
        cEq,
        cRt,
        cWLogs,
        cMetrics,
        tableRows,
      ] = await Promise.all([
        db.user_base_info.count(),
        db.foods.count(),
        db.recipes.count(),
        db.daily_diet_logs.count(),
        db.exercises.count(),
        db.equipments.count(),
        db.routines.count(),
        db.workout_logs.count(),
        db.body_metrics.count(),
        readTableRows(tableKey),
      ]);

      setCounts({
        user_base_info: cUser,
        foods: cFoods,
        recipes: cRecipes,
        daily_diet_logs: cDiet,
        exercises: cEx,
        equipments: cEq,
        routines: cRt,
        workout_logs: cWLogs,
        body_metrics: cMetrics,
      });
      setRows(tableRows);
    } catch (err) {
      console.error('Failed to inspect IndexedDB:', err);
      toast.show('讀取 IndexedDB 失敗');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleSelectTable = (tableKey: TableKey) => {
    setSelectedTable(tableKey);
    setVisibleCount(PAGE_SIZE);
    setExpandedRowId(null);
    setConfirmClearTable(false);
  };

  useEffect(() => {
    void loadCountsAndRows(selectedTable);
  }, [selectedTable, loadCountsAndRows]);

  const totalRows = useMemo(
    () => Object.values(counts).reduce((sum, n) => sum + n, 0),
    [counts]
  );

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => JSON.stringify(row).toLowerCase().includes(q));
  }, [rows, searchQuery]);

  const pagedRows = useMemo(
    () => filteredRows.slice(0, visibleCount),
    [filteredRows, visibleCount]
  );

  const handleDeleteRow = async (id: string) => {
    await deleteTableRow(selectedTable, id);
    toast.show('已刪除');
    await loadCountsAndRows(selectedTable);
  };

  const handleClearTable = async () => {
    if (!confirmClearTable) {
      setConfirmClearTable(true);
      return;
    }
    await clearSingleTable(selectedTable);
    setConfirmClearTable(false);
    toast.show(`已清空 ${selectedTable}`);
    await loadCountsAndRows(selectedTable);
  };

  const handleClearAllTables = async () => {
    if (!confirmClearAll) {
      setConfirmClearAll(true);
      return;
    }
    await Promise.all(TABLE_METAS.map((t) => clearSingleTable(t.key)));
    setConfirmClearAll(false);
    toast.show('已清空全部 9 張資料表');
    await loadCountsAndRows(selectedTable);
  };

  const handleSeed14DayMetrics = async () => {
    const now = Date.now();
    const metrics: BodyMetric[] = Array.from({ length: 14 }, (_, idx) => {
      const daysAgo = 13 - idx;
      const oscillation = Math.sin(idx * 1.3) * 0.45;
      const trendDrop = idx * 0.06;
      return {
        id: crypto.randomUUID(),
        date: formatDateOffset(daysAgo),
        weight: Math.round((71.2 - trendDrop + oscillation) * 10) / 10,
        bodyFat: Math.round((18.4 - idx * 0.04) * 10) / 10,
        waistCm: Math.round((81.5 - idx * 0.05) * 10) / 10,
        createdAt: now - daysAgo * 86400_000,
        updatedAt: now,
        rev: 1,
      };
    });
    await db.body_metrics.bulkPut(metrics);
    toast.show('已寫入 14 天體態測試資料');
    await loadCountsAndRows(selectedTable);
  };

  const handleSeedNutritionAndWorkout = async () => {
    const now = Date.now();
    const foodId = crypto.randomUUID();
    const sampleFood: FoodItem = {
      id: foodId,
      name: '帶骨去皮雞腿',
      category: 'natural',
      servingSize: 100,
      servingUnit: 'g',
      calories: 158,
      carbs: 0,
      protein: 19.6,
      fat: 8.2,
      refuseRate: 0.21,
      edibleRate: 0.79,
      refuseDescription: 'bone 21%',
      dataSource: {
        authority: 'TFDA',
        sourceId: 'TFDA-DEV-01',
        sourceName: '肉雞帶骨腿肉（開發測試）',
        verifiedAt: formatDateOffset(0),
      },
      micros: { potassium: 245, iron: 1.1, zinc: 1.7 },
      isCustom: false,
      createdAt: now,
      updatedAt: now,
      rev: 1,
    };

    const today = formatDateOffset(0);
    const sampleDietLog: DailyDietLog = {
      id: crypto.randomUUID(),
      date: today,
      meta: { activityLevel: 1.55, macroSplit: { carbs: 40, protein: 30, fat: 30 } },
      entries: [
        {
          id: crypto.randomUUID(),
          date: today,
          mealType: 'lunch',
          entryType: 'item',
          foodId,
          quantity: 158,
          grossQuantity: 200,
          unit: 'g',
          createdAt: now,
          updatedAt: now,
          rev: 1,
        },
      ],
      createdAt: now,
      updatedAt: now,
      rev: 1,
    };

    const sampleWorkoutLog: WorkoutLog = {
      id: crypto.randomUUID(),
      date: today,
      exercises: [
        {
          exerciseId: crypto.randomUUID(),
          sets: [
            {
              id: crypto.randomUUID(),
              setNumber: 1,
              weight: 80,
              reps: 8,
              isCompleted: true,
              updatedAt: now,
              rev: 1,
            },
            {
              id: crypto.randomUUID(),
              setNumber: 2,
              weight: 85,
              reps: 6,
              isCompleted: true,
              updatedAt: now,
              rev: 1,
            },
          ],
        },
      ],
      createdAt: now,
      updatedAt: now,
      rev: 1,
    };

    await Promise.all([
      db.foods.put(sampleFood),
      db.daily_diet_logs.put(sampleDietLog),
      db.workout_logs.put(sampleWorkoutLog),
    ]);
    toast.show('已寫入食材、飲食與訓練測試資料');
    await loadCountsAndRows(selectedTable);
  };

  return (
    <div className="space-y-6">
      {/* 1. Schema 版本與全表總覽 */}
      <section className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-foreground" />
              <h2 className="text-sm font-semibold tracking-tight">IndexedDB Live Inspector</h2>
              <Badge variant="outline" className="font-mono text-3xs border-border py-0 h-5">
                Dexie v{db.verno}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground font-mono mt-0.5">
              即時檢視本機 9 張 IndexedDB 資料表、匯入測試資料或清理單表記錄
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            <Button
              size="sm"
              variant="outline"
              onClick={() => void loadCountsAndRows(selectedTable)}
              disabled={isLoading}
              className="h-7 text-xs font-mono"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
              重新整理
            </Button>
            <Button
              size="sm"
              variant={confirmClearAll ? 'destructive' : 'outline'}
              onClick={() => void handleClearAllTables()}
              onBlur={() => setConfirmClearAll(false)}
              className="h-7 text-xs font-mono"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1" />
              {confirmClearAll ? '確認清空全部表？' : '清空全部表'}
            </Button>
          </div>
        </div>

        {/* KPI 總覽與 9 表計數網格 */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 font-mono text-xs">
          <div className="border border-border rounded-lg bg-card p-3 space-y-1">
            <span className="text-3xs text-muted-foreground uppercase tracking-wider">Schema</span>
            <div>
              <MetricValue
                value={`v${db.verno}`}
                unit="Dexie"
                valueClassName="text-base font-semibold text-foreground"
                unitClassName="text-3xs"
              />
            </div>
          </div>
          <div className="border border-border rounded-lg bg-card p-3 space-y-1">
            <span className="text-3xs text-muted-foreground uppercase tracking-wider">總筆數</span>
            <div>
              <MetricValue
                value={totalRows}
                unit="筆"
                valueClassName="text-base font-semibold text-foreground"
                unitClassName="text-3xs"
              />
            </div>
          </div>
          {TABLE_METAS.slice(0, 3).map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => handleSelectTable(t.key)}
              className={`border rounded-lg p-3 space-y-1 text-left transition-colors cursor-pointer ${
                selectedTable === t.key ? 'border-foreground bg-muted' : 'border-border bg-card hover:bg-hover'
              }`}
            >
              <span className="text-3xs text-muted-foreground block truncate">{t.label}</span>
              <MetricValue
                value={counts[t.key]}
                unit="筆"
                valueClassName="text-base font-semibold text-foreground"
                unitClassName="text-3xs"
              />
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 font-mono text-xs">
          {TABLE_METAS.slice(3).map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => handleSelectTable(t.key)}
              className={`border rounded-lg p-2.5 space-y-0.5 text-left transition-colors cursor-pointer ${
                selectedTable === t.key ? 'border-foreground bg-muted' : 'border-border bg-card hover:bg-hover'
              }`}
            >
              <span className="text-3xs text-muted-foreground block truncate">{t.label}</span>
              <MetricValue
                value={counts[t.key]}
                unit="筆"
                valueClassName="text-sm font-semibold text-foreground"
                unitClassName="text-3xs"
              />
            </button>
          ))}
        </div>
      </section>

      {/* 2. 開發測試資料生成器 (Seeder) */}
      <section className="border border-border rounded-lg bg-card p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-0.5">
          <div className="text-xs font-semibold font-sans">Dev Test Seeder (UUIDv4 · rev: 1)</div>
          <div className="text-3xs font-mono text-muted-foreground">
            快速生成含權威溯源、損耗率、EWMA 體態與訓練組數的標準測試資料
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button
            size="sm"
            variant="outline"
            onClick={() => void handleSeed14DayMetrics()}
            className="h-7 text-xs font-mono"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            寫入 14 天體態
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void handleSeedNutritionAndWorkout()}
            className="h-7 text-xs font-mono"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            寫入飲食與訓練
          </Button>
        </div>
      </section>

      {/* 3. 資料表檢視與篩選 */}
      <section className="space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <Select value={selectedTable} onValueChange={(v) => handleSelectTable(v as TableKey)}>
            <SelectTrigger className="h-8 sm:w-56 bg-card border-border font-mono text-xs shadow-none">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="font-mono text-xs">
              {TABLE_METAS.map((t) => (
                <SelectItem key={t.key} value={t.key}>
                  {t.label} ({counts[t.key]})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setVisibleCount(PAGE_SIZE);
              }}
              placeholder={`檢索 ${selectedTable} (ID、名稱、日期或任意欄位)...`}
              className="pl-8 h-8 text-xs font-mono bg-card shadow-none"
            />
          </div>

          <Button
            size="sm"
            variant={confirmClearTable ? 'destructive' : 'outline'}
            onClick={() => void handleClearTable()}
            onBlur={() => setConfirmClearTable(false)}
            disabled={counts[selectedTable] === 0}
            className="h-8 text-xs font-mono shrink-0"
          >
            <Trash2 className="w-3.5 h-3.5 mr-1" />
            {confirmClearTable ? `確認清空 ${selectedTable}？` : `清空 ${selectedTable}`}
          </Button>
        </div>

        <div className="flex items-center justify-between text-xs font-mono text-muted-foreground px-1">
          <span>
            顯示 {pagedRows.length} / {filteredRows.length} 筆
          </span>
          <span className="text-3xs">點擊列展開完整 JSON</span>
        </div>

        {filteredRows.length === 0 ? (
          <div className="border border-border rounded-lg bg-card p-10 text-center text-xs font-mono text-muted-foreground">
            {selectedTable} 無資料
          </div>
        ) : (
          <div className="space-y-1.5">
            {pagedRows.map((row) => {
              const isExpanded = expandedRowId === row.id;
              const jsonText = JSON.stringify(row, null, 2);
              return (
                <div
                  key={row.id}
                  className={`border rounded-lg bg-card ${
                    isExpanded ? 'border-foreground' : 'border-border'
                  }`}
                >
                  <div
                    onClick={() => setExpandedRowId(isExpanded ? null : row.id)}
                    className="p-2.5 flex items-center justify-between gap-2 cursor-pointer hover:bg-hover transition-colors"
                  >
                    <div className="min-w-0 flex items-center gap-2 font-mono text-xs">
                      <code className="text-3xs px-1.5 py-0.5 rounded bg-muted border border-border text-foreground shrink-0">
                        {row.id.slice(0, 8)}
                      </code>
                      <span className="text-foreground font-sans font-medium truncate">
                        {row.name || row.date || '-'}
                      </span>
                      {row.rev !== undefined && (
                        <Badge variant="outline" className="text-3xs font-mono py-0 h-4 border-border">
                          rev {row.rev}
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleDeleteRow(row.id);
                        }}
                        className="h-6 px-1.5 text-3xs font-mono text-destructive hover:bg-destructive-subtle"
                        aria-label="刪除列"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-border bg-muted p-3 relative">
                      <pre className="text-3xs font-mono text-foreground overflow-x-auto max-h-64 leading-relaxed">
                        {jsonText}
                      </pre>
                      <div className="absolute right-3 top-3">
                        <CopySnippet value={jsonText}>複製 JSON</CopySnippet>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {visibleCount < filteredRows.length && (
          <div className="pt-1 text-center">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
              className="h-8 text-xs font-mono"
            >
              載入更多 ({filteredRows.length - visibleCount} 筆剩餘)
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
