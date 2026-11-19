import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { HoldToDeleteButton } from '@/components/ui/HoldToDeleteButton';
import { SpringNumber } from '@/components/ui/SpringNumber';
import { AutoMarquee } from '@/components/ui/AutoMarquee';
import { BrandWordmark, BrandText } from '@/components/ui/Logo';
import { EquipmentBadge } from '@/components/workout/EquipmentBadge';
import { MuscleIntensityBadge } from '@/components/workout/MuscleIntensityBadge';
import { MacroSquares } from '@/components/food/MacroSquares';

export const PrimitivesTab: React.FC = () => {
  const [segmentValue, setSegmentValue] = useState('active');
  const [springTarget, setSpringTarget] = useState(1850);
  const [deleteCount, setDeleteCount] = useState(0);

  return (
    <div className="space-y-6">
      {/* 標題與定位 */}
      <div>
        <h2 className="text-sm font-semibold tracking-tight text-foreground">
          Primitive Components
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          基礎原子元件與通用控件矩陣，扁平無陰影，以精緻邊框與等寬字體為準則。
        </p>
      </div>

      {/* 按鈕矩陣 */}
      <div className="space-y-2.5">
        <h3 className="text-xs font-mono text-muted-foreground">
          Buttons
        </h3>
        <div className="p-4 rounded-lg border border-border bg-card space-y-4">
          <div className="space-y-2">
            <div className="text-2xs font-mono text-muted-foreground">Variants</div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="default">Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="destructive">Destructive</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="link">Link</Button>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-2xs font-mono text-muted-foreground">Sizes</div>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm">Small (h-8)</Button>
              <Button size="default">Default (h-9)</Button>
              <Button size="lg">Large (h-10)</Button>
              <Button size="icon" aria-label="Icon">✕</Button>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-2xs font-mono text-muted-foreground">Disabled state</div>
            <div className="flex flex-wrap items-center gap-2">
              <Button disabled variant="default">Disabled Primary</Button>
              <Button disabled variant="outline">Disabled Outline</Button>
              <Button disabled variant="destructive">Disabled Destructive</Button>
            </div>
          </div>
        </div>
      </div>

      {/* 標籤與膠囊 */}
      <div className="space-y-2.5">
        <h3 className="text-xs font-mono text-muted-foreground">
          Badges & indicators
        </h3>
        <div className="p-4 rounded-lg border border-border bg-card space-y-4">
          <div className="space-y-2">
            <div className="text-2xs font-mono text-muted-foreground">Standard badges</div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="default">Default</Badge>
              <Badge variant="secondary">Secondary</Badge>
              <Badge variant="outline">Outline</Badge>
              <Badge variant="destructive">Destructive</Badge>
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
            <div className="text-2xs font-mono text-muted-foreground">Muscle roles</div>
            <div className="flex flex-wrap items-center gap-2">
              <MuscleIntensityBadge muscle="upper_chest" role="primary" showRole={true} />
              <MuscleIntensityBadge muscle="triceps" role="secondary" showRole={true} />
              <MuscleIntensityBadge muscle="front_delts" role="stabilizer" showRole={true} />
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-2xs font-mono text-muted-foreground">Macro split matrix</div>
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
        <h3 className="text-xs font-mono text-muted-foreground">
          Inputs & controls
        </h3>
        <div className="p-4 rounded-lg border border-border bg-card space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="standard-input" className="text-xs">Text input</Label>
              <Input id="standard-input" placeholder="食物或動作名稱" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mono-input" className="text-xs">Mono numeric</Label>
              <Input id="mono-input" className="font-mono tabular-nums" defaultValue="145.0" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="disabled-input" className="text-xs">Disabled</Label>
              <Input id="disabled-input" disabled defaultValue="唯讀數值" />
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-border">
            <div className="text-2xs font-mono text-muted-foreground">Segmented control</div>
            <SegmentedControl
              value={segmentValue}
              onChange={setSegmentValue}
              options={[
                { value: 'active', label: '使用中' },
                { value: 'archived', label: '已歸檔' },
                { value: 'all', label: '全部' },
              ]}
              className="w-full sm:w-64"
            />
          </div>
        </div>
      </div>

      {/* 專案專利互動機制 */}
      <div className="space-y-2.5">
        <h3 className="text-xs font-mono text-muted-foreground">
          Interactive mechanics
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="p-3.5 rounded-lg border border-border bg-card space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-foreground">Hold to confirm</span>
              <span className="text-3xs font-mono text-muted-foreground">500 ms</span>
            </div>
            <div className="flex items-center gap-3">
              <HoldToDeleteButton
                onConfirm={() => setDeleteCount((c) => c + 1)}
                text="長按確認刪除"
              />
              <span className="text-2xs font-mono text-muted-foreground tabular-nums">
                次數: {deleteCount}
              </span>
            </div>
          </div>

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
                    className="h-6 text-2xs font-mono px-2"
                    onClick={() => setSpringTarget(val)}
                  >
                    {val}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-lg border border-border bg-card space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-foreground">Auto marquee</span>
              <span className="text-3xs font-mono text-muted-foreground">PING-PONG</span>
            </div>
            <div className="p-2 rounded border border-border bg-background max-w-xs">
              <AutoMarquee className="text-xs font-mono">
                極品低溫真空低溫慢煮特級無骨牛小排佐迷迭香海鹽
              </AutoMarquee>
            </div>
          </div>

          <div className="p-3.5 rounded-lg border border-border bg-card space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-foreground">Brand typography</span>
              <span className="text-3xs font-mono text-muted-foreground">GEIST SANS</span>
            </div>
            <div className="flex items-center gap-3">
              <BrandWordmark variant="lockup" />
              <span className="text-xs text-muted-foreground">
                正文：<BrandText text="e2Cal" />
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
