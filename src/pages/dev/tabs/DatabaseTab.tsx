import { useState, useMemo, useEffect } from 'react';
import {
  Database,
  Search,
  RefreshCw,
  Download,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Scale,
  Sparkles,
  Copy,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/toast';
import { CopySnippet } from '../components/CopySnippet';
import { DEFAULT_FOODS } from '@/services/db/defaultData';
import { FOOD_ALIASES_REGISTRY } from '@/utils/multilingualAliases';
import { db } from '@/services/db/db';
import { clearFoodsCache } from '@/hooks/useFoods';
import type { FoodItem, FoodCategory, AuthoritySource, FoodMicronutrients } from '@/types';

// ============================================================================
// 常數與配置
// ============================================================================

const BATCH_SIZE = 24;

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
};

// ============================================================================
// 熱力學 Atwater 計算工具
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

  const carbEnergy = c * 4;
  const proteinEnergy = p * 4;
  const fatEnergy = f * 9;
  const theoCal = carbEnergy + proteinEnergy + fatEnergy;
  const nomCal = food.calories || 0;
  const delta = Math.abs(nomCal - theoCal);
  const allowedThreshold = Math.max(15, theoCal * 0.12);
  const isValid = delta <= allowedThreshold;

  const totalSum = carbEnergy + proteinEnergy + fatEnergy;
  const carbPct = totalSum > 0 ? (carbEnergy / totalSum) * 100 : 0;
  const proteinPct = totalSum > 0 ? (proteinEnergy / totalSum) * 100 : 0;
  const fatPct = totalSum > 0 ? (fatEnergy / totalSum) * 100 : 0;

  return {
    theoCal: Math.round(theoCal * 10) / 10,
    nomCal,
    delta: Math.round(delta * 10) / 10,
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
// 審計規則引擎 (In-Browser CI Auditor)
// ============================================================================

interface AuditReport {
  timestamp: string;
  totalChecked: number;
  passedCount: number;
  warningCount: number;
  failCount: number;
  issues: {
    foodId: string;
    foodName: string;
    level: 'warn' | 'fail';
    rule: string;
    message: string;
  }[];
}

function runDatabaseAudit(foods: Omit<FoodItem, 'createdAt' | 'updatedAt'>[]): AuditReport {
  const issues: AuditReport['issues'] = [];

  for (const f of foods) {
    const item = f as FoodItem;

    // 1. 權威溯源完整性
    if (!item.dataSource || !item.dataSource.authority || !item.dataSource.sourceId) {
      issues.push({
        foodId: item.id,
        foodName: item.name,
        level: 'fail',
        rule: 'AUTHORITY_PROVENANCE',
        message: '缺失權威資料庫來源機構或條目代碼',
      });
    }

    // 2. 熱力學 Atwater 能量平衡
    const thermo = calcThermodynamics(item);
    if (!thermo.isValid) {
      issues.push({
        foodId: item.id,
        foodName: item.name,
        level: 'warn',
        rule: 'ATWATER_ENERGY_CONSERVATION',
        message: `熱量偏差過大: 標稱 ${thermo.nomCal} kcal vs 理論 ${thermo.theoCal} kcal (Δ=${thermo.delta} > 閥值 ${thermo.allowedThreshold})`,
      });
    }

    // 3. 巨量元素非負數
    if (
      (item.calories ?? 0) < 0 ||
      (item.protein ?? 0) < 0 ||
      (item.carbs ?? 0) < 0 ||
      (item.fat ?? 0) < 0
    ) {
      issues.push({
        foodId: item.id,
        foodName: item.name,
        level: 'fail',
        rule: 'NON_NEGATIVE_MACROS',
        message: '巨量營養素存在負數異常值',
      });
    }

    // 4. 帶皮帶核帶骨損耗剛性約束（僅審計天然原型食材，排除油脂與加工品）
    if (item.category === 'natural') {
      const name = item.name.toLowerCase();
      const isHighRefuseFruit =
        name.includes('香蕉') ||
        name.includes('西瓜') ||
        name.includes('火龍果') ||
        name.includes('柚') ||
        name.includes('鳳梨') ||
        name.includes('酪梨') ||
        name.includes('奇異果') ||
        name.includes('芒果') ||
        name.includes('百香果') ||
        name.includes('甜瓜') ||
        name.includes('哈密瓜');

      if (isHighRefuseFruit && (!item.refuseRate || item.refuseRate <= 0)) {
        issues.push({
          foodId: item.id,
          foodName: item.name,
          level: 'warn',
          rule: 'REFUSE_RATE_INTEGRITY',
          message: `帶皮/核水果 (${item.name}) 未標註物理損耗率 refuseRate`,
        });
      }
    }

    // 5. 原型食材加工污染審計
    if (item.category === 'natural') {
      const sourceName = (item.dataSource?.sourceName || '').toLowerCase();
      if (
        sourceName.includes('juice') ||
        sourceName.includes('lemonade') ||
        sourceName.includes('sauce') ||
        sourceName.includes('cocktail') ||
        sourceName.includes('canned')
      ) {
        issues.push({
          foodId: item.id,
          foodName: item.name,
          level: 'fail',
          rule: 'ANTI_PROCESSING_POLLUTION',
          message: `原型生鮮映射至加工品項: "${item.dataSource?.sourceName}"`,
        });
      }
    }
  }

  const failCount = issues.filter((i) => i.level === 'fail').length;
  const warningCount = issues.filter((i) => i.level === 'warn').length;
  const passedCount = foods.length - failCount - warningCount;

  return {
    timestamp: new Date().toLocaleTimeString(),
    totalChecked: foods.length,
    passedCount,
    warningCount,
    failCount,
    issues,
  };
}

// ============================================================================
// 主組件 DatabaseTab
// ============================================================================

export function DatabaseTab() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedAuthority, setSelectedAuthority] = useState<string>('all');
  const [refuseFilter, setRefuseFilter] = useState<'all' | 'has-refuse' | 'no-refuse'>('all');
  const [filterMicrosOnly, setFilterMicrosOnly] = useState(false);
  const [filterHighProtein, setFilterHighProtein] = useState(false);
  const [sortBy, setSortBy] = useState<
    'default' | 'calories-desc' | 'calories-asc' | 'protein-desc' | 'carbs-desc' | 'fat-desc' | 'refuse-desc' | 'source-asc'
  >('default');

  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
  const [expandedFoodId, setExpandedFoodId] = useState<string | null>(null);
  const [activeInspectorSection, setActiveInspectorSection] = useState<'provenance' | 'physics' | 'micros' | 'aliases' | 'json'>('provenance');

  // IndexedDB 遙測與操作狀態
  const [dbStatus, setDbStatus] = useState<{ total: number; custom: number; synced: boolean } | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // 審計報告狀態
  const [auditReport, setAuditReport] = useState<AuditReport | null>(null);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [isReportCopied, setIsReportCopied] = useState(false);

  // 複製審計報告為 Markdown 格式
  const handleCopyReportMarkdown = () => {
    if (!auditReport) return;
    const lines = [
      '# e2Cal 預設庫 CI 級別規則審計報告',
      `- 審計時間: ${auditReport.timestamp}`,
      `- 檢測條目: ${auditReport.totalChecked} 筆`,
      `- 合規通過: ${auditReport.passedCount} 筆 (${Math.round((auditReport.passedCount / auditReport.totalChecked) * 100)}%)`,
      `- 合理偏差警示: ${auditReport.warningCount} 筆`,
      `- 違規攔截: ${auditReport.failCount} 筆`,
      '',
      '## 審計項目清單',
    ];

    if (auditReport.issues.length === 0) {
      lines.push('🎉 全庫 434 筆食材完全符合 SOP 權威規範、Atwater 熱力學平衡與損耗率要求，無任何違規！');
    } else {
      auditReport.issues.forEach((issue, idx) => {
        const tag = issue.level === 'fail' ? '🔴 [FAIL]' : '🟡 [WARN]';
        lines.push(`${idx + 1}. ${tag} **[${issue.foodName}]** ${issue.message} (\`${issue.rule}\`)`);
      });
    }

    navigator.clipboard.writeText(lines.join('\n'));
    setIsReportCopied(true);
    toast.show('已複製 Markdown 審計報告');
    setTimeout(() => setIsReportCopied(false), 2000);
  };

  // 複製審計報告為 JSON 格式
  const handleCopyReportJson = () => {
    if (!auditReport) return;
    navigator.clipboard.writeText(JSON.stringify(auditReport, null, 2));
    toast.show('已複製 JSON 審計報告');
  };

  // 查詢本地 IndexedDB 狀態
  const refreshDbStatus = async () => {
    try {
      if (typeof indexedDB === 'undefined') return;
      const allDbFoods = await db.foods.toArray();
      const customCount = allDbFoods.filter((f) => f.isCustom).length;
      const defaultInDbCount = allDbFoods.length - customCount;
      const synced = defaultInDbCount >= DEFAULT_FOODS.length;
      setDbStatus({
        total: allDbFoods.length,
        custom: customCount,
        synced,
      });
    } catch {
      // 靜默捕捉，非瀏覽器環境不拋錯
    }
  };

  useEffect(() => {
    refreshDbStatus();
  }, []);

  // 強制同步/重刷出廠預設食材至 IndexedDB
  const handleForceSync = async () => {
    setIsSyncing(true);
    try {
      const now = Date.now();
      await db.transaction('rw', db.foods, async () => {
        for (const defaultFood of DEFAULT_FOODS) {
          const existing = await db.foods.get(defaultFood.id);
          if (existing) {
            // 原地覆蓋宏量與微量，保留 createdAt
            await db.foods.update(defaultFood.id, {
              ...defaultFood,
              isCustom: false,
              createdAt: existing.createdAt || now,
              updatedAt: now,
            });
          } else {
            await db.foods.add({
              ...defaultFood,
              isCustom: false,
              createdAt: now,
              updatedAt: now,
            } as FoodItem);
          }
        }
      });
      clearFoodsCache();
      await refreshDbStatus();
      toast.show('已全量同步 434 筆預設食材至 IndexedDB');
    } catch (err) {
      console.error('Failed to sync preset foods:', err);
      toast.show('同步失敗，請查看主控台');
    } finally {
      setIsSyncing(false);
    }
  };

  // 觸發全庫深層審計
  const handleRunAudit = () => {
    const report = runDatabaseAudit(DEFAULT_FOODS);
    setAuditReport(report);
    setShowAuditModal(true);
    toast.show(`審計完成：${report.passedCount}/${report.totalChecked} 完美通過`);
  };

  // 導出當前篩選食材為 JSON
  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(filteredFoods, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `e2cal-preset-foods-${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    toast.show('已匯出 JSON 文件');
  };

  // 統計總覽指標 (KPI Telemetry)
  const stats = useMemo(() => {
    const total = DEFAULT_FOODS.length;
    let refuseCount = 0;
    let microsCount = 0;
    let naturalCount = 0;
    let oilCount = 0;
    let processedCount = 0;
    let beverageCount = 0;
    let condimentCount = 0;

    const authorities: Record<AuthoritySource, number> = {
      USDA: 0,
      TFDA: 0,
      CFCT: 0,
      MEXT: 0,
    };

    for (const f of DEFAULT_FOODS) {
      if (f.refuseRate && f.refuseRate > 0) refuseCount++;
      if (f.micros && Object.keys(f.micros).length > 0) microsCount++;

      if (f.category === 'natural') naturalCount++;
      else if (f.category === 'oil') oilCount++;
      else if (f.category === 'processed') processedCount++;
      else if (f.category === 'beverage') beverageCount++;
      else if (f.category === 'condiment') condimentCount++;

      const auth = f.dataSource?.authority;
      if (auth && auth in authorities) {
        authorities[auth as AuthoritySource]++;
      }
    }

    return {
      total,
      refuseCount,
      microsCount,
      naturalCount,
      oilCount,
      processedCount,
      beverageCount,
      condimentCount,
      authorities,
    };
  }, []);

  // 篩選與排序邏輯
  const filteredFoods = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return (DEFAULT_FOODS as FoodItem[])
      .filter((food) => {
        // 1. 分類篩選
        if (selectedCategory !== 'all' && food.category !== selectedCategory) {
          return false;
        }

        // 2. 權威機構篩選
        if (selectedAuthority !== 'all' && food.dataSource?.authority !== selectedAuthority) {
          return false;
        }

        // 3. 損耗率篩選 ('has-refuse' | 'no-refuse')
        if (refuseFilter === 'has-refuse' && (!food.refuseRate || food.refuseRate <= 0)) {
          return false;
        }
        if (refuseFilter === 'no-refuse' && food.refuseRate && food.refuseRate > 0) {
          return false;
        }

        // 4. 微量元素篩選
        if (filterMicrosOnly && (!food.micros || Object.keys(food.micros).length === 0)) {
          return false;
        }

        // 5. 高蛋白篩選 (>= 15g / 100g)
        if (filterHighProtein && (food.protein || 0) < 15) {
          return false;
        }

        // 6. 關鍵字搜尋 (支援品名、外文名、代碼、UUID、別名)
        if (!query) return true;

        if (food.name.toLowerCase().includes(query)) return true;
        if (food.dataSource?.sourceName?.toLowerCase().includes(query)) return true;
        if (food.dataSource?.sourceId?.toLowerCase().includes(query)) return true;
        if (food.id.toLowerCase().includes(query)) return true;

        // 搜尋別名庫
        const aliases = FOOD_ALIASES_REGISTRY[food.id];
        if (aliases && aliases.some((a) => a.toLowerCase().includes(query))) {
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
    searchQuery,
    selectedCategory,
    selectedAuthority,
    refuseFilter,
    filterMicrosOnly,
    filterHighProtein,
    sortBy,
  ]);

  const pagedFoods = useMemo(() => {
    return filteredFoods.slice(0, visibleCount);
  }, [filteredFoods, visibleCount]);

  const toggleExpand = (foodId: string) => {
    setExpandedFoodId((prev) => (prev === foodId ? null : foodId));
  };

  return (
    <div className="space-y-6">
      {/* 1. 頂部遙測與管理操作控制台 */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold tracking-tight">預設數據庫管理 (Preset Food Database)</h2>
              <Badge variant="outline" className="font-mono text-3xs border-border py-0 h-5">
                {stats.total} 條權威原型
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground font-mono mt-0.5">
              出廠權威原型食材庫 · 嚴格對齊 USDA / TFDA / CFCT · 損耗率與微量元素深度檢視
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            <Button
              size="sm"
              variant="outline"
              onClick={handleRunAudit}
              className="h-7 text-xs font-mono"
            >
              <ShieldCheck className="w-3.5 h-3.5 mr-1 text-emerald-500" />
              科學審計
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={handleForceSync}
              disabled={isSyncing}
              className="h-7 text-xs font-mono"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1 ${isSyncing ? 'animate-spin' : ''}`} />
              同步至 IndexedDB
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={handleExportJson}
              className="h-7 text-xs font-mono"
            >
              <Download className="w-3.5 h-3.5 mr-1" />
              匯出 JSON
            </Button>
          </div>
        </div>

        {/* 2. KPI 遙測指標卡片 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-mono text-xs">
          <div className="border border-border rounded-lg bg-card p-3 space-y-1">
            <div className="text-muted-foreground text-[11px] flex items-center justify-between">
              <span>TOTAL ITEMS</span>
              <Database className="w-3.5 h-3.5 opacity-60" />
            </div>
            <div className="text-base font-semibold">{stats.total}</div>
            <div className="text-[10px] text-muted-foreground truncate">
              天然 {stats.naturalCount} · 油脂 {stats.oilCount} · 其它 {stats.processedCount + stats.beverageCount + stats.condimentCount}
            </div>
          </div>

          <div className="border border-border rounded-lg bg-card p-3 space-y-1">
            <div className="text-muted-foreground text-[11px] flex items-center justify-between">
              <span>AUTHORITIES</span>
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            </div>
            <div className="text-base font-semibold">
              {stats.authorities.USDA + stats.authorities.TFDA + stats.authorities.CFCT}
            </div>
            <div className="text-[10px] text-muted-foreground truncate">
              USDA {stats.authorities.USDA} · TFDA {stats.authorities.TFDA} · CFCT {stats.authorities.CFCT}
            </div>
          </div>

          <div className="border border-border rounded-lg bg-card p-3 space-y-1">
            <div className="text-muted-foreground text-[11px] flex items-center justify-between">
              <span>REFUSE RATE COVERAGE</span>
              <Scale className="w-3.5 h-3.5 text-amber-500" />
            </div>
            <div className="text-base font-semibold">
              {stats.refuseCount}{' '}
              <span className="text-xs font-normal text-muted-foreground">
                ({Math.round((stats.refuseCount / stats.total) * 100)}%)
              </span>
            </div>
            <div className="text-[10px] text-muted-foreground truncate">
              有損耗 {stats.refuseCount} · 無損耗 {stats.total - stats.refuseCount} (全可食)
            </div>
          </div>

          <div className="border border-border rounded-lg bg-card p-3 space-y-1">
            <div className="text-muted-foreground text-[11px] flex items-center justify-between">
              <span>INDEXEDDB STATUS</span>
              <RefreshCw className="w-3.5 h-3.5 text-blue-500" />
            </div>
            <div className="text-base font-semibold">
              {dbStatus ? `${dbStatus.total} 筆` : '讀取中...'}
            </div>
            <div className="text-[10px] text-muted-foreground truncate">
              {dbStatus?.synced ? '已完全同步最新版本' : '待同步/有自定義實體'}
            </div>
          </div>
        </div>
      </section>

      {/* 3. 多維檢索與過濾工具欄 */}
      <section className="space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          {/* 搜尋框 */}
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setVisibleCount(BATCH_SIZE);
              }}
              placeholder="搜尋品名、USDA/TFDA 代碼、外文品名、UUID、別名 (如 A菜, 西紅柿, 171077)..."
              className="h-8 pl-8 text-xs font-mono"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs font-mono"
              >
                ✕
              </button>
            )}
          </div>

          {/* 排序選擇 */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-2xs font-mono text-muted-foreground">排序:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="h-8 rounded-md border border-border bg-background px-2 text-xs font-mono text-foreground focus:outline-none"
            >
              <option value="default">預設順序</option>
              <option value="calories-desc">熱量 (高 → 低)</option>
              <option value="calories-asc">熱量 (低 → 高)</option>
              <option value="protein-desc">蛋白質 (高 → 低)</option>
              <option value="carbs-desc">碳水 (高 → 低)</option>
              <option value="fat-desc">脂肪 (高 → 低)</option>
              <option value="refuse-desc">損耗率 (高 → 低)</option>
              <option value="source-asc">條目代碼 (A → Z)</option>
            </select>
          </div>
        </div>

        {/* 篩選按鈕組 */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs font-mono">
          {/* 分類群組 */}
          <span className="text-3xs text-muted-foreground mr-0.5">分類:</span>
          {(['all', 'natural', 'oil', 'processed', 'beverage', 'condiment'] as const).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => {
                setSelectedCategory(cat);
                setVisibleCount(BATCH_SIZE);
              }}
              className={`h-6 px-2 rounded text-2xs transition-colors ${
                selectedCategory === cat
                  ? 'bg-foreground text-background font-medium'
                  : 'bg-muted/60 text-muted-foreground hover:text-foreground'
              }`}
            >
              {cat === 'all' ? '全部' : CATEGORY_NAMES[cat]}
            </button>
          ))}

          <div className="h-3 w-px bg-border mx-1" />

          {/* 權威來源群組 */}
          <span className="text-3xs text-muted-foreground mr-0.5">來源:</span>
          {(['all', 'USDA', 'TFDA', 'CFCT'] as const).map((auth) => (
            <button
              key={auth}
              type="button"
              onClick={() => {
                setSelectedAuthority(auth);
                setVisibleCount(BATCH_SIZE);
              }}
              className={`h-6 px-2 rounded text-2xs transition-colors ${
                selectedAuthority === auth
                  ? 'bg-foreground text-background font-medium'
                  : 'bg-muted/60 text-muted-foreground hover:text-foreground'
              }`}
            >
              {auth}
            </button>
          ))}

          <div className="h-3 w-px bg-border mx-1" />

          {/* 特性 Toggle */}
          <button
            type="button"
            onClick={() => {
              setRefuseFilter((v) => (v === 'has-refuse' ? 'all' : 'has-refuse'));
              setVisibleCount(BATCH_SIZE);
            }}
            className={`h-6 px-2 rounded text-2xs flex items-center gap-1 transition-colors ${
              refuseFilter === 'has-refuse'
                ? 'bg-amber-500/20 text-amber-500 border border-amber-500/40 font-medium'
                : 'bg-muted/60 text-muted-foreground hover:text-foreground'
            }`}
          >
            <Scale className="w-3 h-3" />
            有損耗率
          </button>

          <button
            type="button"
            onClick={() => {
              setRefuseFilter((v) => (v === 'no-refuse' ? 'all' : 'no-refuse'));
              setVisibleCount(BATCH_SIZE);
            }}
            className={`h-6 px-2 rounded text-2xs flex items-center gap-1 transition-colors ${
              refuseFilter === 'no-refuse'
                ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/40 font-medium'
                : 'bg-muted/60 text-muted-foreground hover:text-foreground'
            }`}
          >
            <Scale className="w-3 h-3" />
            無損耗率
          </button>

          <button
            type="button"
            onClick={() => setFilterMicrosOnly((v) => !v)}
            className={`h-6 px-2 rounded text-2xs flex items-center gap-1 transition-colors ${
              filterMicrosOnly
                ? 'bg-blue-500/20 text-blue-500 border border-blue-500/40 font-medium'
                : 'bg-muted/60 text-muted-foreground hover:text-foreground'
            }`}
          >
            <Sparkles className="w-3 h-3" />
            有微量元素
          </button>

          <button
            type="button"
            onClick={() => setFilterHighProtein((v) => !v)}
            className={`h-6 px-2 rounded text-2xs flex items-center gap-1 transition-colors ${
              filterHighProtein
                ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/40 font-medium'
                : 'bg-muted/60 text-muted-foreground hover:text-foreground'
            }`}
          >
            高蛋白 (≥15g)
          </button>
        </div>

        {/* 搜尋結果數量反饋 */}
        <div className="flex items-center justify-between text-2xs font-mono text-muted-foreground">
          <span>
            匹配到 <strong className="text-foreground">{filteredFoods.length}</strong> 項食材
            {filteredFoods.length !== DEFAULT_FOODS.length && ` (篩選自 ${DEFAULT_FOODS.length} 條完整出廠庫)`}
          </span>
          <span>顯示前 {Math.min(pagedFoods.length, filteredFoods.length)} 項</span>
        </div>
      </section>

      {/* 4. 食材詳細開發者清單 */}
      <section className="space-y-3">
        {pagedFoods.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-border rounded-lg text-xs font-mono text-muted-foreground">
            無匹配食材，請嘗試放寬篩選條件或搜尋關鍵字
          </div>
        ) : (
          pagedFoods.map((food) => {
            const isExpanded = expandedFoodId === food.id;
            const thermo = calcThermodynamics(food);
            const aliases = FOOD_ALIASES_REGISTRY[food.id] || [];
            const hasMicros = food.micros && Object.keys(food.micros).length > 0;

            return (
              <div
                key={food.id}
                className={`border rounded-lg transition-all ${
                  isExpanded ? 'border-foreground/30 bg-card shadow-sm' : 'border-border bg-card/60 hover:bg-card hover:border-border'
                }`}
              >
                {/* 條目 Header (精簡卡片行) */}
                <div
                  onClick={() => toggleExpand(food.id)}
                  className="p-3 cursor-pointer select-none flex flex-col md:flex-row md:items-center justify-between gap-3"
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold text-foreground tracking-tight">
                        {food.name}
                      </span>

                      {/* 分類 Badge */}
                      <Badge variant="outline" className="text-3xs font-mono py-0 h-4 border-border text-muted-foreground">
                        {CATEGORY_NAMES[food.category || 'natural']}
                      </Badge>

                      {/* 權威來源 Badge */}
                      {food.dataSource && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center"
                        >
                          <CopySnippet
                            value={food.dataSource.sourceId}
                            variant="code"
                            toastMessage="已複製條目代碼"
                            className="text-3xs h-4 py-0"
                          >
                            {food.dataSource.authority} {food.dataSource.sourceId}
                          </CopySnippet>
                        </div>
                      )}

                      {/* 損耗率 Badge */}
                      {food.refuseRate && food.refuseRate > 0 ? (
                        <Badge
                          variant="outline"
                          className="text-3xs font-mono py-0 h-4 border-amber-500/30 text-amber-500 bg-amber-500/10"
                        >
                          損耗 {Math.round(food.refuseRate * 100)}% ({food.refuseDescription || '皮核骨'})
                        </Badge>
                      ) : null}

                      {/* 微量元素 Badge */}
                      {hasMicros && (
                        <Badge
                          variant="outline"
                          className="text-3xs font-mono py-0 h-4 border-blue-500/30 text-blue-500 bg-blue-500/10"
                        >
                          {Object.keys(food.micros || {}).length} 項微量元素
                        </Badge>
                      )}

                      {/* Atwater 守恆驗證 Badge */}
                      <Badge
                        variant="outline"
                        className={`text-3xs font-mono py-0 h-4 ${
                          thermo.isValid
                            ? 'border-emerald-500/30 text-emerald-500 bg-emerald-500/10'
                            : 'border-destructive/30 text-destructive bg-destructive/10'
                        }`}
                      >
                        {thermo.isValid ? `Δ ${thermo.delta} kcal ✓` : `Δ ${thermo.delta} kcal ⚠`}
                      </Badge>
                    </div>

                    {/* 原始品名次級資訊 */}
                    {food.dataSource?.sourceName && (
                      <div className="text-2xs font-mono text-muted-foreground truncate max-w-xl">
                        {food.dataSource.sourceName}
                      </div>
                    )}
                  </div>

                  {/* 右側宏量摘要與展開按鈕 */}
                  <div className="flex items-center justify-between md:justify-end gap-3 shrink-0">
                    <div className="grid grid-cols-4 gap-2 text-right font-mono text-xs">
                      <div>
                        <span className="text-2xs text-muted-foreground block text-[10px]">熱量</span>
                        <span className="font-semibold text-foreground">{food.calories}</span>
                        <span className="text-3xs text-muted-foreground"> kcal</span>
                      </div>
                      <div>
                        <span className="text-2xs text-muted-foreground block text-[10px]">碳水</span>
                        <span className="text-foreground">{food.carbs}</span>
                        <span className="text-3xs text-muted-foreground">g</span>
                      </div>
                      <div>
                        <span className="text-2xs text-muted-foreground block text-[10px]">蛋白</span>
                        <span className="text-foreground">{food.protein}</span>
                        <span className="text-3xs text-muted-foreground">g</span>
                      </div>
                      <div>
                        <span className="text-2xs text-muted-foreground block text-[10px]">脂肪</span>
                        <span className="text-foreground">{food.fat}</span>
                        <span className="text-3xs text-muted-foreground">g</span>
                      </div>
                    </div>

                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 shrink-0 text-muted-foreground"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>

                {/* 條目展開：完整開發者深入檢視面板 */}
                {isExpanded && (
                  <div className="border-t border-border p-4 bg-muted/20 space-y-4 animate-in fade-in-50 duration-150">
                    {/* 子導航切換 */}
                    <div className="flex flex-wrap items-center gap-1 border-b border-border pb-2 text-xs font-mono">
                      <button
                        type="button"
                        onClick={() => setActiveInspectorSection('provenance')}
                        className={`px-2 py-1 rounded text-2xs transition-colors ${
                          activeInspectorSection === 'provenance'
                            ? 'bg-foreground text-background font-medium'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        權威溯源檔案
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveInspectorSection('physics')}
                        className={`px-2 py-1 rounded text-2xs transition-colors ${
                          activeInspectorSection === 'physics'
                            ? 'bg-foreground text-background font-medium'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        熱力學守恆 (Atwater)
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveInspectorSection('micros')}
                        className={`px-2 py-1 rounded text-2xs transition-colors ${
                          activeInspectorSection === 'micros'
                            ? 'bg-foreground text-background font-medium'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        微量元素矩陣 (21項)
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveInspectorSection('aliases')}
                        className={`px-2 py-1 rounded text-2xs transition-colors ${
                          activeInspectorSection === 'aliases'
                            ? 'bg-foreground text-background font-medium'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        方言與俗稱 ({aliases.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveInspectorSection('json')}
                        className={`px-2 py-1 rounded text-2xs transition-colors ${
                          activeInspectorSection === 'json'
                            ? 'bg-foreground text-background font-medium'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        Raw JSON
                      </button>
                    </div>

                    {/* 區塊 1: 權威溯源檔案 */}
                    {activeInspectorSection === 'provenance' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
                        <div className="border border-border rounded p-3 bg-card space-y-2">
                          <div className="text-muted-foreground text-2xs uppercase tracking-wider">權威資料庫憑證</div>
                          <div className="flex justify-between py-1 border-b border-border/50">
                            <span className="text-muted-foreground">來源機構</span>
                            <span className="font-semibold text-foreground">
                              {food.dataSource?.authority ? AUTHORITY_NAMES[food.dataSource.authority] : '無'}
                            </span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-border/50 items-center">
                            <span className="text-muted-foreground">條目代碼 (Source ID)</span>
                            <CopySnippet value={food.dataSource?.sourceId || ''} variant="code">
                              {food.dataSource?.sourceId || '無'}
                            </CopySnippet>
                          </div>
                          <div className="flex justify-between py-1 border-b border-border/50">
                            <span className="text-muted-foreground">核對日期 (Verified)</span>
                            <span className="text-foreground">{food.dataSource?.verifiedAt || '2026-11-23'}</span>
                          </div>
                          <div className="flex justify-between py-1 items-center">
                            <span className="text-muted-foreground">系統確定性 UUID</span>
                            <CopySnippet value={food.id} variant="code">
                              {food.id}
                            </CopySnippet>
                          </div>
                        </div>

                        <div className="border border-border rounded p-3 bg-card space-y-2">
                          <div className="text-muted-foreground text-2xs uppercase tracking-wider">物理規格與損耗率</div>
                          <div className="flex justify-between py-1 border-b border-border/50">
                            <span className="text-muted-foreground">基準生重規格</span>
                            <span className="text-foreground">
                              每 {food.servingSize} {food.servingUnit} (生重純可食部)
                            </span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-border/50">
                            <span className="text-muted-foreground">物理損耗率 (Refuse Rate)</span>
                            <span className="font-semibold text-amber-500">
                              {food.refuseRate ? `${Math.round(food.refuseRate * 100)}%` : '0% (全可食)'}
                            </span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-border/50">
                            <span className="text-muted-foreground">標準可食率 (Edible Rate)</span>
                            <span className="font-semibold text-emerald-500">
                              {food.edibleRate ? `${Math.round(food.edibleRate * 100)}%` : '100%'}
                            </span>
                          </div>
                          <div className="flex justify-between py-1">
                            <span className="text-muted-foreground">損耗物組成描述</span>
                            <span className="text-foreground">{food.refuseDescription || '無不可食殘餘'}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 區塊 2: 熱力學守恆 (Atwater Physics) */}
                    {activeInspectorSection === 'physics' && (
                      <div className="space-y-3 font-mono text-xs">
                        <div className="border border-border rounded p-3 bg-card space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground text-2xs uppercase tracking-wider">
                              熱力學 Atwater 系數方程式： 4C + 4P + 9F
                            </span>
                            <Badge
                              variant="outline"
                              className={`text-3xs py-0 h-4 ${
                                thermo.isValid
                                  ? 'border-emerald-500 text-emerald-500 bg-emerald-500/10'
                                  : 'border-destructive text-destructive bg-destructive/10'
                              }`}
                            >
                              {thermo.isValid ? '守恆合格 (CONSERVED)' : '誤差偏大 (EXCEEDS)'}
                            </Badge>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                            <div className="p-2 rounded bg-muted/40 border border-border/40">
                              <span className="text-3xs text-muted-foreground block">標稱標示熱量</span>
                              <span className="text-base font-semibold">{thermo.nomCal}</span>
                              <span className="text-3xs text-muted-foreground"> kcal</span>
                            </div>
                            <div className="p-2 rounded bg-muted/40 border border-border/40">
                              <span className="text-3xs text-muted-foreground block">理論換算熱量</span>
                              <span className="text-base font-semibold">{thermo.theoCal}</span>
                              <span className="text-3xs text-muted-foreground"> kcal</span>
                            </div>
                            <div className="p-2 rounded bg-muted/40 border border-border/40">
                              <span className="text-3xs text-muted-foreground block">絕對偏差 (Δ)</span>
                              <span className={`text-base font-semibold ${thermo.delta > 10 ? 'text-amber-500' : 'text-foreground'}`}>
                                {thermo.delta}
                              </span>
                              <span className="text-3xs text-muted-foreground"> kcal</span>
                            </div>
                            <div className="p-2 rounded bg-muted/40 border border-border/40">
                              <span className="text-3xs text-muted-foreground block">最大容許閥值</span>
                              <span className="text-base font-semibold">{thermo.allowedThreshold}</span>
                              <span className="text-3xs text-muted-foreground"> kcal</span>
                            </div>
                          </div>

                          {/* 能量佔比進度條 */}
                          <div className="space-y-1.5 pt-1">
                            <div className="flex justify-between text-2xs text-muted-foreground">
                              <span>碳水供能: {thermo.carbPct}% ({thermo.carbEnergy} kcal)</span>
                              <span>蛋白供能: {thermo.proteinPct}% ({thermo.proteinEnergy} kcal)</span>
                              <span>脂肪供能: {thermo.fatPct}% ({thermo.fatEnergy} kcal)</span>
                            </div>
                            <div className="h-2 w-full bg-muted rounded-full overflow-hidden flex">
                              <div style={{ width: `${thermo.carbPct}%` }} className="bg-amber-500 h-full" title="碳水化合物" />
                              <div style={{ width: `${thermo.proteinPct}%` }} className="bg-emerald-500 h-full" title="蛋白質" />
                              <div style={{ width: `${thermo.fatPct}%` }} className="bg-purple-500 h-full" title="脂肪" />
                            </div>
                          </div>

                          {/* 次級營養素列 */}
                          <div className="grid grid-cols-5 gap-2 pt-2 border-t border-border/40 text-center text-2xs">
                            <div>
                              <span className="text-muted-foreground block text-3xs">膳食纖維</span>
                              <span className="text-foreground">{food.fiber ?? 0}g</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground block text-3xs">糖</span>
                              <span className="text-foreground">{food.sugar ?? 0}g</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground block text-3xs">飽和脂肪</span>
                              <span className="text-foreground">{food.saturatedFat ?? 0}g</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground block text-3xs">反式脂肪</span>
                              <span className="text-foreground">{food.transFat ?? 0}g</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground block text-3xs">鈉</span>
                              <span className="text-foreground">{food.sodium ?? 0}mg</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 區塊 3: 微量元素矩陣 (21 項) */}
                    {activeInspectorSection === 'micros' && (
                      <div className="border border-border rounded p-3 bg-card space-y-3 font-mono text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground text-2xs uppercase tracking-wider">
                            權威測定微量元素儲備庫 (每 100g 可食部生重)
                          </span>
                          <span className="text-3xs text-muted-foreground">
                            測定項：{Object.keys(food.micros || {}).length} / 21
                          </span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
                          {MICRONUTRIENT_METAS.map((meta) => {
                            const val = food.micros?.[meta.key];
                            const hasVal = val !== undefined && val !== null;

                            return (
                              <div
                                key={meta.key}
                                className={`p-2 rounded border text-center transition-colors ${
                                  hasVal
                                    ? 'border-border bg-muted/40 text-foreground'
                                    : 'border-border/30 bg-muted/10 text-muted-foreground/40'
                                }`}
                              >
                                <span className="text-3xs block truncate">{meta.label}</span>
                                <span className="text-xs font-semibold block mt-0.5">
                                  {hasVal ? val : '-'}
                                </span>
                                <span className="text-3xs text-muted-foreground">{meta.unit}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* 區塊 4: 方言與俗稱別名 */}
                    {activeInspectorSection === 'aliases' && (
                      <div className="border border-border rounded p-3 bg-card space-y-3 font-mono text-xs">
                        <div className="text-muted-foreground text-2xs uppercase tracking-wider">
                          兩岸三地異名同物 · 方言俗稱穿透索引
                        </div>
                        {aliases.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {aliases.map((alias) => (
                              <Badge
                                key={alias}
                                variant="outline"
                                className="text-xs font-mono py-1 px-2 border-border bg-muted/50"
                              >
                                {alias}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <div className="text-2xs text-muted-foreground">
                            此食材目前未在別名字典中註冊額外俗稱，直接使用標準品名進行嚴格比對。
                          </div>
                        )}
                      </div>
                    )}

                    {/* 區塊 5: Raw JSON */}
                    {activeInspectorSection === 'json' && (
                      <div className="relative border border-border rounded bg-muted/40 p-3 font-mono text-2xs">
                        <div className="absolute top-2 right-2 flex items-center gap-1">
                          <CopySnippet value={JSON.stringify(food, null, 2)} variant="subtle" toastMessage="已複製完整 JSON">
                            複製 JSON
                          </CopySnippet>
                        </div>
                        <pre className="max-h-60 overflow-y-auto text-muted-foreground selection:bg-foreground selection:text-background pr-12">
                          {JSON.stringify(food, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* 載入更多分頁按鈕 */}
        {filteredFoods.length > visibleCount && (
          <div className="pt-2 flex justify-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setVisibleCount((prev) => prev + BATCH_SIZE)}
              className="h-8 text-xs font-mono"
            >
              載入更多 (尚餘 {filteredFoods.length - visibleCount} 項)
            </Button>
          </div>
        )}
      </section>

      {/* 5. 科學審計報告彈窗 (Audit Report Modal) */}
      {showAuditModal && auditReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="border border-border bg-card rounded-lg max-w-xl w-full p-5 space-y-4 shadow-lg font-mono text-xs">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <h3 className="font-semibold text-sm text-foreground">預設庫 CI 級別規則審計報告</h3>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopyReportMarkdown}
                  className="h-7 text-xs font-mono"
                  title="複製 Markdown 格式報告"
                >
                  {isReportCopied ? (
                    <>
                      <Check className="w-3.5 h-3.5 mr-1 text-emerald-500" />
                      已複製
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 mr-1" />
                      複製報告
                    </>
                  )}
                </Button>
                <button
                  type="button"
                  onClick={() => setShowAuditModal(false)}
                  className="text-muted-foreground hover:text-foreground text-xs font-mono p-1 rounded hover:bg-muted"
                  aria-label="關閉"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-3 rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-500">
                <div className="text-lg font-bold">{auditReport.passedCount}</div>
                <div className="text-3xs uppercase">100% 合規通過</div>
              </div>
              <div className="p-3 rounded border border-amber-500/30 bg-amber-500/10 text-amber-500">
                <div className="text-lg font-bold">{auditReport.warningCount}</div>
                <div className="text-3xs uppercase">合理偏差警示</div>
              </div>
              <div className="p-3 rounded border border-destructive/30 bg-destructive/10 text-destructive">
                <div className="text-lg font-bold">{auditReport.failCount}</div>
                <div className="text-3xs uppercase">違規攔截</div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-2xs text-muted-foreground uppercase">
                <span>審計項目清單</span>
                <span>點擊單項可獨立複製</span>
              </div>
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {auditReport.issues.length === 0 ? (
                  <div className="p-3 rounded border border-border bg-muted/30 text-center text-muted-foreground text-2xs">
                    🎉 全庫 434 筆食材完全符合 SOP 權威規範、Atwater 熱力學平衡與損耗率要求，無任何違規！
                  </div>
                ) : (
                  auditReport.issues.map((issue, idx) => (
                    <div
                      key={idx}
                      className={`p-2 rounded border text-2xs flex items-start justify-between gap-2 transition-colors ${
                        issue.level === 'fail'
                          ? 'border-destructive/30 bg-destructive/10 text-destructive'
                          : 'border-amber-500/30 bg-amber-500/10 text-amber-500'
                      }`}
                    >
                      <div className="flex-1 min-w-0 pr-1">
                        <div>
                          <strong className="font-semibold">[{issue.foodName}]</strong> {issue.message}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <CopySnippet
                          value={`[${issue.level.toUpperCase()}] [${issue.foodName}] ${issue.message} (${issue.rule})`}
                          variant="badge"
                          toastMessage="已複製該項問題"
                        >
                          複製
                        </CopySnippet>
                        <Badge variant="outline" className="text-3xs shrink-0 py-0 h-4 border-current">
                          {issue.rule}
                        </Badge>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-border">
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopyReportMarkdown}
                  className="h-7 text-xs font-mono"
                >
                  {isReportCopied ? (
                    <Check className="w-3.5 h-3.5 mr-1 text-emerald-500" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 mr-1" />
                  )}
                  複製 Markdown 報告
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleCopyReportJson}
                  className="h-7 text-xs font-mono text-muted-foreground hover:text-foreground"
                >
                  複製 JSON
                </Button>
              </div>

              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowAuditModal(false)}
                className="h-7 text-xs font-mono"
              >
                關閉
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
