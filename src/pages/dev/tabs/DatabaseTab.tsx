import { useState, useMemo, useEffect } from 'react';
import {
  Search,
  RefreshCw,
  Download,
  ChevronDown,
  ChevronUp,
  FlaskConical,
  Plus,
  Check,
} from 'lucide-react';
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
import {
  getAuthorityFoods,
  importAuthorityFoodToDatabase,
} from '@/services/authorityFoodService';
import { matchesMultilingual } from '@/utils/multilingualSearch';
import type {
  FoodItem,
  FoodCategory,
  AuthoritySource,
  FoodMicronutrients,
} from '@/types';

// ============================================================================
// 常數與配置
// ============================================================================

const BATCH_SIZE = 30;

interface MicronutrientMeta {
  key: keyof FoodMicronutrients;
  label: string;
  unit: string;
  group: 'mineral' | 'vitamin' | 'lipid' | 'amino';
}

const MICRONUTRIENT_METAS: MicronutrientMeta[] = [
  // 電解質與礦物質
  { key: 'potassium', label: '鉀 (K)', unit: 'mg', group: 'mineral' },
  { key: 'calcium', label: '鈣 (Ca)', unit: 'mg', group: 'mineral' },
  { key: 'magnesium', label: '鎂 (Mg)', unit: 'mg', group: 'mineral' },
  { key: 'iron', label: '鐵 (Fe)', unit: 'mg', group: 'mineral' },
  { key: 'zinc', label: '鋅 (Zn)', unit: 'mg', group: 'mineral' },
  { key: 'selenium', label: '硒 (Se)', unit: 'mcg', group: 'mineral' },

  // 維生素群
  { key: 'vitaminA', label: '維生素 A', unit: 'mcg RAE', group: 'vitamin' },
  { key: 'vitaminC', label: '維生素 C', unit: 'mg', group: 'vitamin' },
  { key: 'vitaminD', label: '維生素 D', unit: 'mcg', group: 'vitamin' },
  { key: 'vitaminE', label: '維生素 E', unit: 'mg', group: 'vitamin' },
  { key: 'vitaminB1', label: '硫胺素 (B1)', unit: 'mg', group: 'vitamin' },
  { key: 'vitaminB2', label: '核黃素 (B2)', unit: 'mg', group: 'vitamin' },
  { key: 'vitaminB3', label: '煙鹼酸 (B3)', unit: 'mg', group: 'vitamin' },
  { key: 'vitaminB6', label: '吡哆醇 (B6)', unit: 'mg', group: 'vitamin' },
  { key: 'vitaminB12', label: '鈷胺素 (B12)', unit: 'mcg', group: 'vitamin' },
  { key: 'folate', label: '葉酸 (B9)', unit: 'mcg DFE', group: 'vitamin' },

  // 脂類與胺基酸
  { key: 'cholesterol', label: '膽固醇', unit: 'mg', group: 'lipid' },
  { key: 'omega3EPA', label: 'EPA', unit: 'g', group: 'lipid' },
  { key: 'omega3DHA', label: 'DHA', unit: 'g', group: 'lipid' },
  { key: 'omega3ALA', label: 'ALA', unit: 'g', group: 'lipid' },
  { key: 'leucine', label: '亮氨酸 (Leucine)', unit: 'mg', group: 'amino' },
];

const CATEGORY_NAMES: Record<FoodCategory, string> = {
  natural: '天然原型',
  oil: '食用油脂',
  processed: '工業食品',
  beverage: '飲品',
  condiment: '調味佐料',
};

const AUTHORITY_NAMES: Record<AuthoritySource, string> = {
  USDA: '美國農業部 (USDA FoodData Central)',
  TFDA: '台灣衛福部 (TFDA 台灣食品成分資料庫)',
  CFCT: '中國疾控中心 (CFCT 中國食物成分表)',
  MEXT: '日本文部科學省 (MEXT 日本食品標準成分表)',
  AFCD: '澳洲澳新食品標準局 (FSANZ AFCD)',
  CoFID: '英國衛生安全局 (UKHSA CoFID)',
};

// ============================================================================
// Atwater 熱力學分析工具
// ============================================================================

interface ThermodynamicsResult {
  theoCal: number;
  nomCal: number;
  delta: number;
  allowedThreshold: number;
  isValid: boolean;
  carbEnergy: number;
  proteinEnergy: number;
  fatEnergy: number;
  carbPct: number;
  proteinPct: number;
  fatPct: number;
}

function calcThermodynamics(food: FoodItem): ThermodynamicsResult {
  const c = food.carbs || 0;
  const p = food.protein || 0;
  const f = food.fat || 0;
  const fiber = food.fiber || 0;

  // 1. 粗算總碳水理論熱量 (Gross Atwater: 4P + 4C + 9F)
  const carbEnergy = c * 4;
  const proteinEnergy = p * 4;
  const fatEnergy = f * 9;
  const theoCal = carbEnergy + proteinEnergy + fatEnergy;
  const nomCal = food.calories || 0;
  const deltaGross = Math.abs(nomCal - theoCal);

  // 2. 淨碳水理論熱量 (Net Atwater: 扣除膳食纖維，纖維按 2 kcal/g)
  const netCarbs = Math.max(0, c - fiber);
  const fiberEnergy = fiber * 2;
  const netTheoCal = p * 4 + netCarbs * 4 + fatEnergy + fiberEnergy;
  const deltaNet = Math.abs(nomCal - netTheoCal);

  // 3. 雙軌判定
  const minDelta = Math.min(deltaGross, deltaNet);
  const bestTheoCal = deltaNet < deltaGross ? netTheoCal : theoCal;
  const allowedThreshold = Math.max(15, Math.min(theoCal, netTheoCal) * 0.12);
  const isValid = minDelta <= allowedThreshold;

  const totalSum = carbEnergy + proteinEnergy + fatEnergy;
  const carbPct = totalSum > 0 ? (carbEnergy / totalSum) * 100 : 0;
  const proteinPct = totalSum > 0 ? (proteinEnergy / totalSum) * 100 : 0;
  const fatPct = totalSum > 0 ? (fatEnergy / totalSum) * 100 : 0;

  return {
    theoCal: Math.round(bestTheoCal * 10) / 10,
    nomCal,
    delta: Math.round(minDelta * 10) / 10,
    allowedThreshold: Math.round(allowedThreshold * 10) / 10,
    isValid,
    carbEnergy: Math.round(carbEnergy * 10) / 10,
    proteinEnergy: Math.round(proteinEnergy * 10) / 10,
    fatEnergy: Math.round(fatEnergy * 10) / 10,
    carbPct: Math.round(carbPct),
    proteinPct: Math.round(proteinPct),
    fatPct: Math.round(fatPct),
  };
}

// ============================================================================
// 主組件 DatabaseTab (六大權威科研食物庫瀏覽器)
// ============================================================================

type SortByOption =
  | 'default'
  | 'calories-desc'
  | 'calories-asc'
  | 'protein-desc'
  | 'carbs-desc'
  | 'fat-desc'
  | 'refuse-desc'
  | 'source-asc';

export function DatabaseTab() {
  const [authorityFoods, setAuthorityFoods] = useState<FoodItem[]>([]);
  const [localFoodIds, setLocalFoodIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  // 搜尋與篩選狀態
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedAuthority, setSelectedAuthority] = useState<string>('all');
  const [refuseFilter, setRefuseFilter] = useState<'all' | 'with-refuse' | 'zero-refuse'>('all');
  const [filterMicrosOnly, setFilterMicrosOnly] = useState(false);
  const [sortBy, setSortBy] = useState<SortByOption>('default');

  // UI 展開與分頁
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
  const [expandedFoodId, setExpandedFoodId] = useState<string | null>(null);
  const [activeInspectorSection, setActiveInspectorSection] = useState<'provenance' | 'thermo' | 'micros' | 'json'>('provenance');

  // 載入權威庫數據與本地 ID 集合
  const loadData = async () => {
    setIsLoading(true);
    try {
      const foods = await getAuthorityFoods();
      setAuthorityFoods(foods);

      if (typeof indexedDB !== 'undefined') {
        const localFoods = await db.foods.toArray();
        setLocalFoodIds(new Set(localFoods.map((f) => f.id)));
      }
    } catch (err) {
      console.error('Failed to load authority foods:', err);
      toast.show('載入權威數據庫失敗');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // 統計指標
  const stats = useMemo(() => {
    const total = authorityFoods.length;
    let refuseCount = 0;
    let microsCount = 0;

    const authorities: Record<AuthoritySource, number> = {
      USDA: 0,
      TFDA: 0,
      CFCT: 0,
      MEXT: 0,
      AFCD: 0,
      CoFID: 0,
    };

    for (const f of authorityFoods) {
      if (f.refuseRate && f.refuseRate > 0) refuseCount++;
      if (f.micros && Object.keys(f.micros).length > 0) microsCount++;

      const auth = f.dataSource?.authority;
      if (auth && auth in authorities) {
        authorities[auth as AuthoritySource]++;
      }
    }

    return {
      total,
      refuseCount,
      microsCount,
      authorities,
    };
  }, [authorityFoods]);

  // 過濾與排序
  const filteredFoods = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return authorityFoods
      .filter((food) => {
        // 分類過濾
        if (selectedCategory !== 'all' && food.category !== selectedCategory) {
          return false;
        }

        // 權威庫過濾
        if (selectedAuthority !== 'all' && food.dataSource?.authority !== selectedAuthority) {
          return false;
        }

        // 損耗率過濾
        if (refuseFilter === 'with-refuse' && (!food.refuseRate || food.refuseRate <= 0)) {
          return false;
        }
        if (refuseFilter === 'zero-refuse' && food.refuseRate && food.refuseRate > 0) {
          return false;
        }

        // 僅看有微量元素
        if (filterMicrosOnly && (!food.micros || Object.keys(food.micros).length === 0)) {
          return false;
        }

        // 關鍵字檢索
        if (!query) return true;

        if (matchesMultilingual(query, food, 'food')) {
          return true;
        }

        if (food.dataSource?.sourceId && food.dataSource.sourceId.toLowerCase().includes(query)) {
          return true;
        }

        if (food.dataSource?.sourceName && food.dataSource.sourceName.toLowerCase().includes(query)) {
          return true;
        }

        return false;
      })
      .sort((a, b) => {
        if (sortBy === 'calories-desc') return (b.calories || 0) - (a.calories || 0);
        if (sortBy === 'calories-asc') return (a.calories || 0) - (b.calories || 0);
        if (sortBy === 'protein-desc') return (b.protein || 0) - (a.protein || 0);
        if (sortBy === 'carbs-desc') return (b.carbs || 0) - (a.carbs || 0);
        if (sortBy === 'fat-desc') return (b.fat || 0) - (a.fat || 0);
        if (sortBy === 'refuse-desc') return (b.refuseRate || 0) - (a.refuseRate || 0);
        if (sortBy === 'source-asc') return (a.dataSource?.sourceId || '').localeCompare(b.dataSource?.sourceId || '');
        return 0;
      });
  }, [
    authorityFoods,
    searchQuery,
    selectedCategory,
    selectedAuthority,
    refuseFilter,
    filterMicrosOnly,
    sortBy,
  ]);

  const pagedFoods = useMemo(() => {
    return filteredFoods.slice(0, visibleCount);
  }, [filteredFoods, visibleCount]);

  const toggleExpand = (foodId: string) => {
    setExpandedFoodId((prev) => (prev === foodId ? null : foodId));
  };

  // 導入單一食物至本地庫
  const handleImportToLocal = async (food: FoodItem) => {
    try {
      await importAuthorityFoodToDatabase(food);
      setLocalFoodIds((prev) => new Set([...prev, food.id]));
      toast.show(`已導入「${food.name}」`);
    } catch {
      toast.show('導入失敗');
    }
  };

  // 匯出當前篩選食物為 JSON
  const handleExportJson = () => {
    const dataStr =
      'data:text/json;charset=utf-8,' +
      encodeURIComponent(JSON.stringify(filteredFoods, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `e2cal-authority-foods-${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    toast.show('已匯出 JSON 文件');
  };

  return (
    <div className="space-y-6">
      {/* 1. 頂部遙測與控制台 */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold tracking-tight">六大權威科研數據庫 (Authority Foods Browser)</h2>
              <Badge variant="outline" className="font-mono text-3xs border-border py-0 h-5">
                {stats.total.toLocaleString()} 筆科研化驗條目
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground font-mono mt-0.5">
              USDA / TFDA / CFCT / MEXT / AFCD / CoFID · 離線按需檢索 · 100% 純可食部基準
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            <Button
              size="sm"
              variant="outline"
              onClick={loadData}
              disabled={isLoading}
              className="h-7 text-xs font-mono"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
              重新整理
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={handleExportJson}
              disabled={filteredFoods.length === 0}
              className="h-7 text-xs font-mono"
            >
              <Download className="w-3.5 h-3.5 mr-1" />
              匯出 JSON ({filteredFoods.length})
            </Button>
          </div>
        </div>

        {/* 2. KPI 遙測指標卡片 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-mono text-xs">
          <div className="border border-border rounded-lg bg-card p-3 space-y-1">
            <span className="text-3xs text-muted-foreground uppercase tracking-wider">權威總條目</span>
            <div>
              <MetricValue
                value={stats.total.toLocaleString()}
                unit="條"
                valueClassName="text-lg font-semibold text-foreground"
                unitClassName="text-3xs"
              />
            </div>
            <div className="text-3xs text-muted-foreground flex items-baseline gap-1">
              <span>本地庫:</span>
              <MetricValue
                value={localFoodIds.size}
                unit="條已導入"
                valueClassName="text-foreground"
                unitClassName="text-3xs"
              />
            </div>
          </div>

          <div className="border border-border rounded-lg bg-card p-3 space-y-1">
            <span className="text-3xs text-muted-foreground uppercase tracking-wider">損耗率測定</span>
            <div>
              <MetricValue
                value={stats.refuseCount.toLocaleString()}
                unit={`(${stats.total > 0 ? Math.round((stats.refuseCount / stats.total) * 100) : 0}%)`}
                valueClassName="text-lg font-semibold text-foreground"
                unitClassName="text-3xs"
              />
            </div>
            <div className="text-3xs text-muted-foreground">
              帶皮 / 帶核 / 帶骨解剖損耗
            </div>
          </div>

          <div className="border border-border rounded-lg bg-card p-3 space-y-1">
            <span className="text-3xs text-muted-foreground uppercase tracking-wider">微量元素測定</span>
            <div>
              <MetricValue
                value={stats.microsCount.toLocaleString()}
                unit={`(${stats.total > 0 ? Math.round((stats.microsCount / stats.total) * 100) : 0}%)`}
                valueClassName="text-lg font-semibold text-foreground"
                unitClassName="text-3xs"
              />
            </div>
            <div className="text-3xs text-muted-foreground">
              含維生素與電解質分析
            </div>
          </div>

          <div className="border border-border rounded-lg bg-card p-3 space-y-1">
            <span className="text-3xs text-muted-foreground uppercase tracking-wider">機構分佈</span>
            <div className="text-3xs text-muted-foreground flex flex-wrap gap-x-2 gap-y-0.5 leading-tight">
              <span>USDA: {stats.authorities.USDA.toLocaleString()}</span>
              <span>TFDA: {stats.authorities.TFDA.toLocaleString()}</span>
              <span>CFCT: {stats.authorities.CFCT.toLocaleString()}</span>
              <span>MEXT: {stats.authorities.MEXT.toLocaleString()}</span>
              <span>AFCD: {stats.authorities.AFCD.toLocaleString()}</span>
              <span>CoFID: {stats.authorities.CoFID.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </section>

      {/* 3. 多維度篩選矩陣 */}
      <section className="space-y-3">
        {/* 搜尋欄位 */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setVisibleCount(BATCH_SIZE);
            }}
            placeholder="檢索 18,635 筆權威條目（支援中文、英文名、同義詞、拼音首字母、機構編號）..."
            className="pl-9 h-9 text-xs font-mono bg-card"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-3xs font-mono text-muted-foreground hover:text-foreground"
            >
              清除
            </button>
          )}
        </div>

        {/* 標籤群組過濾列 */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
          {/* 權威機構選單 */}
          <div className="flex items-center gap-1 bg-card border border-border rounded-md px-1.5 py-1">
            <span className="text-3xs text-muted-foreground px-1">來源:</span>
            {(['all', 'USDA', 'TFDA', 'CFCT', 'MEXT', 'AFCD', 'CoFID'] as const).map((auth) => (
              <button
                key={auth}
                onClick={() => {
                  setSelectedAuthority(auth);
                  setVisibleCount(BATCH_SIZE);
                }}
                className={`px-1.5 py-0.5 rounded text-3xs transition-colors ${
                  selectedAuthority === auth
                    ? 'bg-foreground text-background font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {auth === 'all' ? '全部' : auth}
              </button>
            ))}
          </div>

          {/* 分類選單 */}
          <div className="flex items-center gap-1 bg-card border border-border rounded-md px-1.5 py-1">
            <span className="text-3xs text-muted-foreground px-1">類別:</span>
            {(['all', 'natural', 'oil', 'processed', 'beverage', 'condiment'] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => {
                  setSelectedCategory(cat);
                  setVisibleCount(BATCH_SIZE);
                }}
                className={`px-1.5 py-0.5 rounded text-3xs transition-colors ${
                  selectedCategory === cat
                    ? 'bg-foreground text-background font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {cat === 'all' ? '全部' : CATEGORY_NAMES[cat]}
              </button>
            ))}
          </div>

          {/* 損耗率篩選 */}
          <div className="flex items-center gap-1 bg-card border border-border rounded-md px-1.5 py-1">
            <span className="text-3xs text-muted-foreground px-1">損耗率:</span>
            {(
              [
                { key: 'all', label: '全部' },
                { key: 'with-refuse', label: '有損耗 (>0%)' },
                { key: 'zero-refuse', label: '0% 損耗' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.key}
                onClick={() => {
                  setRefuseFilter(opt.key);
                  setVisibleCount(BATCH_SIZE);
                }}
                className={`px-1.5 py-0.5 rounded text-3xs transition-colors ${
                  refuseFilter === opt.key
                    ? 'bg-foreground text-background font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* 僅看微量元素開關 */}
          <button
            type="button"
            onClick={() => {
              setFilterMicrosOnly((prev) => !prev);
              setVisibleCount(BATCH_SIZE);
            }}
            className={`flex items-center gap-1 px-2 py-1 rounded-md border text-3xs transition-colors ${
              filterMicrosOnly
                ? 'bg-foreground text-background border-foreground font-semibold'
                : 'bg-card text-muted-foreground border-border hover:text-foreground'
            }`}
          >
            <FlaskConical className="w-3 h-3" />
            僅微量元素
          </button>

          {/* 排序方式 */}
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortByOption)}>
            <SelectTrigger className="h-7 w-auto min-w-36 px-2.5 bg-card border-border rounded-md text-3xs font-mono text-muted-foreground hover:text-foreground shadow-none">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="font-mono text-xs">
              <SelectItem value="default">預設排序</SelectItem>
              <SelectItem value="calories-desc">熱量：由高到低</SelectItem>
              <SelectItem value="calories-asc">熱量：由低到高</SelectItem>
              <SelectItem value="protein-desc">蛋白質：由高到低</SelectItem>
              <SelectItem value="carbs-desc">碳水：由高到低</SelectItem>
              <SelectItem value="fat-desc">脂肪：由高到低</SelectItem>
              <SelectItem value="refuse-desc">損耗率：由高到低</SelectItem>
              <SelectItem value="source-asc">來源代碼：升冪</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </section>

      {/* 4. 食物條目清單 */}
      <section className="space-y-2">
        <div className="flex items-center justify-between text-xs font-mono text-muted-foreground px-1">
          <span>
            顯示 {pagedFoods.length} / {filteredFoods.length} 筆
            {searchQuery && ` (符合關鍵字「${searchQuery}」)`}
          </span>
          <span className="text-3xs">點擊卡片展開深度科研檢視器</span>
        </div>

        {isLoading ? (
          <div className="border border-border rounded-lg bg-card p-12 text-center text-xs font-mono text-muted-foreground">
            <RefreshCw className="w-5 h-5 mx-auto mb-2 animate-spin text-muted-foreground" />
            正在加載 18,635 筆權威科研食物庫...
          </div>
        ) : filteredFoods.length === 0 ? (
          <div className="border border-border rounded-lg bg-card p-12 text-center text-xs font-mono text-muted-foreground">
            無符合條件之權威食物條目
          </div>
        ) : (
          <div className="space-y-1.5">
            {pagedFoods.map((food) => {
              const isExpanded = expandedFoodId === food.id;
              const thermo = calcThermodynamics(food);
              const isImported = localFoodIds.has(food.id);
              const sourceAuth: AuthoritySource = (food.dataSource?.authority || 'USDA') as AuthoritySource;

              return (
                <div
                  key={food.id}
                  className={`border rounded-lg bg-card transition-colors ${
                    isExpanded ? 'border-foreground' : 'border-border hover:bg-hover'
                  }`}
                >
                  {/* 卡片標頭列 */}
                  <div
                    onClick={() => toggleExpand(food.id)}
                    className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 cursor-pointer select-none"
                  >
                    <div className="flex items-start sm:items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded border border-border flex items-center justify-center shrink-0 font-mono text-3xs font-semibold bg-muted">
                        {sourceAuth}
                      </div>

                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-medium text-foreground tracking-tight">
                            {food.name}
                          </span>

                          <Badge variant="outline" className="text-3xs font-mono border-border py-0 h-4">
                            {CATEGORY_NAMES[food.category || 'natural']}
                          </Badge>

                          <Badge variant="outline" className="text-3xs font-mono border-border py-0 h-4 text-muted-foreground">
                            {sourceAuth} · {food.dataSource?.sourceId}
                          </Badge>

                          {food.refuseRate && food.refuseRate > 0 ? (
                            <Badge variant="outline" className="text-3xs font-mono border-border py-0 h-4 text-muted-foreground">
                              損耗: {Math.round(food.refuseRate * 100)}%
                            </Badge>
                          ) : null}

                          {isImported && (
                            <Badge variant="outline" className="text-3xs font-mono border-emerald-500 text-emerald-500 py-0 h-4">
                              <Check className="w-2.5 h-2.5 mr-0.5" />
                              已在本地
                            </Badge>
                          )}
                        </div>

                        {food.dataSource?.sourceName && (
                          <div className="text-3xs font-mono text-muted-foreground truncate max-w-md sm:max-w-xl">
                            {food.dataSource.sourceName}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 右側數值看板 (C -> P -> F 嚴格順序) */}
                    <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 font-mono text-xs pt-1 sm:pt-0 border-t sm:border-t-0 border-border">
                      <div className="flex items-center gap-2 text-3xs">
                        <span className="text-muted-foreground">
                          C: <MetricValue value={food.carbs} unit="g" valueClassName="text-foreground" unitClassName="text-3xs" />
                        </span>
                        <span className="text-muted-foreground">
                          P: <MetricValue value={food.protein} unit="g" valueClassName="text-foreground" unitClassName="text-3xs" />
                        </span>
                        <span className="text-muted-foreground">
                          F: <MetricValue value={food.fat} unit="g" valueClassName="text-foreground" unitClassName="text-3xs" />
                        </span>
                        <MetricValue
                          value={food.calories}
                          unit="kcal"
                          className="ml-1"
                          valueClassName="text-foreground font-semibold"
                          unitClassName="text-3xs"
                        />
                      </div>

                      <div className="flex items-center gap-1.5">
                        {!isImported ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleImportToLocal(food);
                            }}
                            className="h-6 px-1.5 text-3xs font-mono text-muted-foreground hover:text-foreground"
                          >
                            <Plus className="w-3 h-3 mr-0.5" />
                            導入
                          </Button>
                        ) : null}

                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 展開之深度檢視抽屜 (Deep Inspector) */}
                  {isExpanded && (
                    <div className="border-t border-border bg-muted p-3.5 space-y-3 font-mono text-xs">
                      {/* 抽屜內部分頁標籤 */}
                      <div className="flex items-center gap-1 border-b border-border pb-2 text-3xs">
                        <button
                          onClick={() => setActiveInspectorSection('provenance')}
                          className={`px-2 py-1 rounded transition-colors ${
                            activeInspectorSection === 'provenance'
                              ? 'bg-foreground text-background font-semibold'
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          權威憑證
                        </button>

                        <button
                          onClick={() => setActiveInspectorSection('thermo')}
                          className={`px-2 py-1 rounded transition-colors ${
                            activeInspectorSection === 'thermo'
                              ? 'bg-foreground text-background font-semibold'
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          Atwater 能量分析
                        </button>

                        <button
                          onClick={() => setActiveInspectorSection('micros')}
                          className={`px-2 py-1 rounded transition-colors ${
                            activeInspectorSection === 'micros'
                              ? 'bg-foreground text-background font-semibold'
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          微量元素 ({food.micros ? Object.keys(food.micros).length : 0})
                        </button>

                        <button
                          onClick={() => setActiveInspectorSection('json')}
                          className={`px-2 py-1 rounded transition-colors ${
                            activeInspectorSection === 'json'
                              ? 'bg-foreground text-background font-semibold'
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          原始 JSON
                        </button>
                      </div>

                      {/* 1. 權威憑證 Section */}
                      {activeInspectorSection === 'provenance' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                          <div className="border border-border rounded p-2.5 bg-card space-y-1">
                            <span className="text-3xs text-muted-foreground uppercase">官方機構全稱</span>
                            <div className="font-sans text-xs font-medium text-foreground">
                              {AUTHORITY_NAMES[sourceAuth] || sourceAuth}
                            </div>
                            <div className="text-3xs text-muted-foreground">
                              機構代碼: <code className="text-foreground">{sourceAuth}</code>
                            </div>
                          </div>

                          <div className="border border-border rounded p-2.5 bg-card space-y-1">
                            <span className="text-3xs text-muted-foreground uppercase">條目編號 (Source ID)</span>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-foreground">
                                {food.dataSource?.sourceId}
                              </span>
                              <CopySnippet value={food.dataSource?.sourceId || ''}>複製代碼</CopySnippet>
                            </div>
                            <div className="text-3xs text-muted-foreground">
                              UUIDv5: <code className="text-3xs">{food.id}</code>
                            </div>
                          </div>

                          <div className="border border-border rounded p-2.5 bg-card space-y-1 sm:col-span-2">
                            <span className="text-3xs text-muted-foreground uppercase">官方原著品名 (Source Name)</span>
                            <div className="text-xs text-foreground font-sans">
                              {food.dataSource?.sourceName || '-'}
                            </div>
                            {food.refuseDescription && (
                              <div className="text-3xs text-muted-foreground pt-1 border-t border-border mt-1">
                                損耗描述: <span className="text-foreground">{food.refuseDescription}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* 2. Atwater 理論熱力學分析 Section */}
                      {activeInspectorSection === 'thermo' && (
                        <div className="space-y-2">
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                            <div className="border border-border rounded p-2 bg-card">
                              <span className="text-3xs text-muted-foreground">標稱熱量</span>
                              <div className="text-sm font-semibold text-foreground">{thermo.nomCal} kcal</div>
                            </div>
                            <div className="border border-border rounded p-2 bg-card">
                              <span className="text-3xs text-muted-foreground">理論 Atwater 熱量</span>
                              <div className="text-sm font-semibold text-foreground">{thermo.theoCal} kcal</div>
                            </div>
                            <div className="border border-border rounded p-2 bg-card">
                              <span className="text-3xs text-muted-foreground">計算偏差 (Δ)</span>
                              <div className="text-sm font-semibold text-foreground">
                                {thermo.delta} kcal <span className="text-3xs text-muted-foreground">(閥值 {thermo.allowedThreshold})</span>
                              </div>
                            </div>
                            <div className="border border-border rounded p-2 bg-card">
                              <span className="text-3xs text-muted-foreground">能量守恆評估</span>
                              <div className={`text-sm font-semibold ${thermo.isValid ? 'text-emerald-500' : 'text-amber-500'}`}>
                                {thermo.isValid ? '符合理論守恆' : '化驗合理偏差'}
                              </div>
                            </div>
                          </div>

                          <div className="border border-border rounded p-2.5 bg-card text-3xs text-muted-foreground space-y-1">
                            <div className="flex justify-between">
                              <span>碳水供能: {thermo.carbEnergy} kcal ({thermo.carbPct}%)</span>
                              <span>蛋白質供能: {thermo.proteinEnergy} kcal ({thermo.proteinPct}%)</span>
                              <span>脂肪供能: {thermo.fatEnergy} kcal ({thermo.fatPct}%)</span>
                            </div>
                            {food.fiber ? (
                              <div>包含膳食纖維: {food.fiber}g (按 2 kcal/g 淨碳水計算法校驗)</div>
                            ) : null}
                          </div>
                        </div>
                      )}

                      {/* 3. 微量元素 Section */}
                      {activeInspectorSection === 'micros' && (
                        <div>
                          {food.micros && Object.keys(food.micros).length > 0 ? (
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-xs">
                              {MICRONUTRIENT_METAS.map((m) => {
                                const val = food.micros?.[m.key];
                                if (val === undefined || val === null) return null;
                                return (
                                  <div
                                    key={m.key}
                                    className="border border-border rounded px-2 py-1.5 bg-card flex justify-between items-baseline"
                                  >
                                    <span className="text-3xs text-muted-foreground truncate">{m.label}</span>
                                    <span className="text-xs font-semibold text-foreground tabular-nums">
                                      {val} <span className="text-3xs font-normal text-muted-foreground">{m.unit}</span>
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="border border-border rounded p-4 text-center text-3xs text-muted-foreground bg-card">
                              該權威條目暫無微量元素測定數值
                            </div>
                          )}
                        </div>
                      )}

                      {/* 4. 原始 JSON Section */}
                      {activeInspectorSection === 'json' && (
                        <div className="relative">
                          <pre className="p-3 bg-card border border-border rounded text-3xs overflow-x-auto max-h-60 text-foreground">
                            {JSON.stringify(food, null, 2)}
                          </pre>
                          <div className="absolute right-2 top-2">
                            <CopySnippet value={JSON.stringify(food, null, 2)}>
                              複製 JSON
                            </CopySnippet>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* 載入更多按鈕 */}
        {visibleCount < filteredFoods.length && (
          <div className="pt-2 text-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setVisibleCount((prev) => prev + BATCH_SIZE)}
              className="h-8 text-xs font-mono"
            >
              載入更多 ({filteredFoods.length - visibleCount} 筆剩餘)
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
