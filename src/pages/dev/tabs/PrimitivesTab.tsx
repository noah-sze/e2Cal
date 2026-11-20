import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { HoldToDeleteButton } from '@/components/ui/HoldToDeleteButton';
import { HoldToDeleteIconButton } from '@/components/ui/HoldToDeleteIconButton';
import { SpringNumber } from '@/components/ui/SpringNumber';
import { AutoMarquee } from '@/components/ui/AutoMarquee';
import { BrandWordmark, BrandText } from '@/components/ui/Logo';
import { EquipmentBadge } from '@/components/workout/EquipmentBadge';
import { MuscleIntensityBadge } from '@/components/workout/MuscleIntensityBadge';
import { MacroSquares } from '@/components/food/MacroSquares';
import { CopySnippet } from '../components/CopySnippet';
import { toast } from '@/components/ui/toast';

export const PrimitivesTab: React.FC = () => {
  const [segmentValue, setSegmentValue] = useState('active');
  const [selectValue, setSelectValue] = useState('raw');
  const [springTarget, setSpringTarget] = useState(1850);
  const [deleteCount, setDeleteCount] = useState(0);
  const [iconDeleteCount, setIconDeleteCount] = useState(0);

  return (
    <div className="space-y-6">
      {/* 標題與客觀說明 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-foreground font-sans">
            原子組件
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5 font-sans">
            基礎原子元件與通用控件矩陣，扁平無陰影，以精緻邊框與等寬字體為準則。
          </p>
        </div>
        <div className="text-2xs font-mono text-muted-foreground tabular-nums">
          L2 原型庫
        </div>
      </div>

      {/* 按鈕矩陣 */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <CopySnippet variant="subtle" value="<Button />" className="text-xs font-mono text-muted-foreground">
              Buttons
            </CopySnippet>
            <span className="text-2xs text-muted-foreground">(按鈕型態矩陣)</span>
          </div>
          <span className="text-3xs font-mono text-muted-foreground">6 VARIANTS</span>
        </div>
        <div className="p-4 rounded-lg border border-border bg-card space-y-4">
          <div className="space-y-2">
            <div className="text-2xs font-mono text-muted-foreground">Variants</div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="default" className="shadow-none">Primary</Button>
              <Button variant="secondary" className="shadow-none">Secondary</Button>
              <Button variant="outline" className="shadow-none">Outline</Button>
              <Button variant="destructive" className="shadow-none">Destructive</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="link">Link</Button>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-2xs font-mono text-muted-foreground">Sizes</div>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" className="shadow-none">Small (h-8)</Button>
              <Button size="default" className="shadow-none">Default (h-9)</Button>
              <Button size="lg" className="shadow-none">Large (h-10)</Button>
              <Button size="icon" aria-label="Icon" className="shadow-none">✕</Button>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-2xs font-mono text-muted-foreground">Disabled state</div>
            <div className="flex flex-wrap items-center gap-2">
              <Button disabled variant="default" className="shadow-none">Disabled Primary</Button>
              <Button disabled variant="outline" className="shadow-none">Disabled Outline</Button>
              <Button disabled variant="destructive" className="shadow-none">Disabled Destructive</Button>
            </div>
          </div>
        </div>
      </div>

      {/* 標籤與膠囊 */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <CopySnippet variant="subtle" value="<Badge />" className="text-xs font-mono text-muted-foreground">
              Badges & indicators
            </CopySnippet>
            <span className="text-2xs text-muted-foreground">(標籤與機能膠囊)</span>
          </div>
          <span className="text-3xs font-mono text-muted-foreground">ATOMIC BADGES</span>
        </div>
        <div className="p-4 rounded-lg border border-border bg-card space-y-4">
          <div className="space-y-2">
            <div className="text-2xs font-mono text-muted-foreground">Standard badges</div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="default" className="shadow-none">Default</Badge>
              <Badge variant="secondary" className="shadow-none">Secondary</Badge>
              <Badge variant="outline" className="shadow-none">Outline</Badge>
              <Badge variant="destructive" className="shadow-none">Destructive</Badge>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-2xs font-mono text-muted-foreground">Equipment capsules</div>
            <div className="flex flex-wrap items-center gap-2">
              <EquipmentBadge equipment="barbell" />
              <EquipmentBadge equipment="dumbbell" />
              <EquipmentBadge equipment="cable" />
              <EquipmentBadge equipment="machine" />
              <EquipmentBadge equipment="bodyweight" />
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-2xs font-mono text-muted-foreground">Muscle roles (17 個精細解剖肌群)</div>
            <div className="flex flex-wrap items-center gap-2">
              <MuscleIntensityBadge muscle="upper_chest" role="primary" showRole={true} />
              <MuscleIntensityBadge muscle="triceps" role="secondary" showRole={true} />
              <MuscleIntensityBadge muscle="rear_delts" role="stabilizer" showRole={true} />
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-2xs font-mono text-muted-foreground">Macro split matrix (碳水 -&gt; 蛋白質 -&gt; 脂肪)</div>
            <div className="flex items-center gap-3">
              <MacroSquares carbs={220} protein={140} fat={50} />
              <div className="text-2xs font-mono text-muted-foreground tabular-nums">
                C: 220 g (51%) · P: 140 g (29%) · F: 50 g (20%)
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 輸入控制項 */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <CopySnippet variant="subtle" value="<Input />" className="text-xs font-mono text-muted-foreground">
              Inputs & controls
            </CopySnippet>
            <span className="text-2xs text-muted-foreground">(表單輸入控件)</span>
          </div>
          <span className="text-3xs font-mono text-muted-foreground">CONTROLS</span>
        </div>
        <div className="p-4 rounded-lg border border-border bg-card space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="standard-input" className="text-xs">Text input</Label>
              <Input id="standard-input" placeholder="食物或動作名稱" className="shadow-none" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mono-input" className="text-xs">Mono numeric</Label>
              <Input id="mono-input" className="font-mono tabular-nums shadow-none" defaultValue="145.0" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="disabled-input" className="text-xs">Disabled</Label>
              <Input id="disabled-input" disabled defaultValue="唯讀數值" className="shadow-none" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border">
            <div className="space-y-2">
              <div className="text-2xs font-mono text-muted-foreground">Segmented control</div>
              <SegmentedControl
                value={segmentValue}
                onChange={setSegmentValue}
                options={[
                  { value: 'active', label: '使用中' },
                  { value: 'archived', label: '已歸檔' },
                  { value: 'all', label: '全部' },
                ]}
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <div className="text-2xs font-mono text-muted-foreground">Select dropdown</div>
              <Select value={selectValue} onValueChange={(val) => { if (val) setSelectValue(val); }}>
                <SelectTrigger className="h-8 text-xs font-mono border-border bg-background shadow-none">
                  <SelectValue placeholder="選擇基準..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="raw">生重 (Raw Weight)</SelectItem>
                  <SelectItem value="cooked">複合熟食菜餚</SelectItem>
                  <SelectItem value="package">完整工業包裝</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* 專案專利互動機制 */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <CopySnippet variant="subtle" value="<HoldToDeleteButton />" className="text-xs font-mono text-muted-foreground">
              Interactive mechanics
            </CopySnippet>
            <span className="text-2xs text-muted-foreground">(物理防呆與動畫)</span>
          </div>
          <span className="text-3xs font-mono text-muted-foreground">PATENTED MECHANICS</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* 長按按鈕 */}
          <div className="p-3.5 rounded-lg border border-border bg-card space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-foreground">Hold to confirm</span>
              <span className="text-3xs font-mono text-muted-foreground">500 ms</span>
            </div>
            <div className="flex items-center gap-3">
              <HoldToDeleteButton
                onConfirm={() => {
                  setDeleteCount((c) => c + 1);
                  toast.show('已確認刪除');
                }}
                text="長按確認刪除"
              />
              <span className="text-2xs font-mono text-muted-foreground tabular-nums">
                次數: {deleteCount}
              </span>
            </div>
          </div>

          {/* 雙向對稱卡鉗圖標按鈕 */}
          <div className="p-3.5 rounded-lg border border-border bg-card space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-foreground">Hold icon caliper</span>
              <span className="text-3xs font-mono text-muted-foreground">DUAL ARC CALIPER</span>
            </div>
            <div className="flex items-center gap-4">
              <HoldToDeleteIconButton
                onConfirm={() => {
                  setIconDeleteCount((c) => c + 1);
                  toast.show('已刪除');
                }}
                title="長按刪除條目"
              />
              <span className="text-2xs font-mono text-muted-foreground tabular-nums">
                次數: {iconDeleteCount}
              </span>
            </div>
          </div>

          {/* 物理彈簧數字滾輪 */}
          <div className="p-3.5 rounded-lg border border-border bg-card space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-foreground">Spring ticker</span>
              <span className="text-3xs font-mono text-muted-foreground">PHYSICS</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="text-lg font-mono font-semibold text-foreground tabular-nums">
                <SpringNumber value={springTarget} /> <span className="text-xs font-normal text-muted-foreground">kcal</span>
              </div>
              <div className="flex items-center gap-1">
                {[1200, 1850, 2450].map((val) => (
                  <Button
                    key={val}
                    variant={springTarget === val ? 'default' : 'outline'}
                    size="sm"
                    className="h-6 text-2xs font-mono px-2 shadow-none"
                    onClick={() => setSpringTarget(val)}
                  >
                    {val}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {/* 自動跑馬燈 */}
          <div className="p-3.5 rounded-lg border border-border bg-card space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-foreground">Auto marquee</span>
              <span className="text-3xs font-mono text-muted-foreground">PING-PONG</span>
            </div>
            <div className="p-2 rounded border border-border bg-background max-w-xs">
              <AutoMarquee className="text-xs font-mono">
                特級初榨橄欖油佐迷迭香生雞胸肉慢煎沙拉盤
              </AutoMarquee>
            </div>
          </div>

          {/* 官方品牌字標真理源 */}
          <div className="p-3.5 rounded-lg border border-border bg-card space-y-2.5 md:col-span-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-foreground">Brand wordmark SSOT</span>
              <span className="text-3xs font-mono text-muted-foreground">GEIST SANS VARIABLE</span>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <BrandWordmark variant="lockup" />
              <div className="h-4 w-px bg-border" />
              <span className="text-xs text-muted-foreground">
                <BrandText text="正文語境：e2Cal 純客戶端本地優先飲食與肌力記錄工具" />
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
