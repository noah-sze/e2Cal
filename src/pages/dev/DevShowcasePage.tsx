import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Moon, Sun, ArrowLeft } from 'lucide-react';
import { BrandWordmark, BrandText } from '@/components/ui/Logo';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useDevTokens } from './useDevTokens';
import { TokensTab } from './tabs/TokensTab';
import { PrimitivesTab } from './tabs/PrimitivesTab';
import { ComponentsTab } from './tabs/ComponentsTab';
import { DialogsTab } from './tabs/DialogsTab';
import { BodyMapTab } from './tabs/BodyMapTab';
import { AITab } from './tabs/AITab';
import { DatabaseTab } from './tabs/DatabaseTab';
import { IndexedDBTab } from './tabs/IndexedDBTab';
import { SyncDiagnosticsTab } from './tabs/SyncDiagnosticsTab';

export default function DevShowcasePage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'tokens' | 'primitives' | 'components' | 'dialogs' | 'bodymap' | 'ai' | 'database' | 'indexeddb' | 'sync'>('tokens');
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));

  const { tokens, updateToken, resetTokens, exportCss, hasModifications } = useDevTokens();

  const toggleTheme = () => {
    const root = document.documentElement;
    if (root.classList.contains('dark')) {
      root.classList.remove('dark');
      setIsDark(false);
    } else {
      root.classList.add('dark');
      setIsDark(true);
    }
  };

  const modifiedCount = Object.keys(tokens).length;

  return (
    <div className="fixed inset-0 h-full w-full overflow-y-auto overflow-x-hidden bg-background text-foreground flex flex-col font-sans selection:bg-foreground selection:text-background">
      {/* 頂部靜音控制台導覽列 (h-12 / 48px 嚴格網格) */}
      <header className="sticky top-0 z-40 w-full border-b border-border bg-background px-4 sm:px-6 h-12 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/app')}
            className="h-7 px-2 text-xs font-mono text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-1" />
            返回
          </Button>
          <div className="h-3.5 w-px bg-border" />
          <div className="flex items-center gap-2">
            <BrandWordmark variant="lockup" />
            <span className="text-2xs font-mono text-muted-foreground">/ dev</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {hasModifications && (
            <Badge variant="outline" className="text-3xs font-mono text-muted-foreground border-border py-0 h-5">
              覆蓋 {modifiedCount} 項
            </Badge>
          )}
          <Button
            variant="outline"
            size="icon"
            onClick={toggleTheme}
            className="w-7 h-7 rounded border-border"
            aria-label="切換主題"
          >
            {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </Button>
        </div>
      </header>

      {/* 頁面主體 (精密間距與節奏) */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 pb-20 space-y-6">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
          <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
            <TabsList className="h-8 p-0.5 bg-muted rounded border border-border overflow-x-auto max-w-full no-scrollbar justify-start">
              <TabsTrigger value="tokens" className="text-xs font-mono px-3 h-7 shrink-0 data-[state=active]:bg-background data-[state=active]:shadow-none">
                Tokens
              </TabsTrigger>
              <TabsTrigger value="primitives" className="text-xs font-mono px-3 h-7 shrink-0 data-[state=active]:bg-background data-[state=active]:shadow-none">
                Primitives
              </TabsTrigger>
              <TabsTrigger value="components" className="text-xs font-mono px-3 h-7 shrink-0 data-[state=active]:bg-background data-[state=active]:shadow-none">
                Components
              </TabsTrigger>
              <TabsTrigger value="dialogs" className="text-xs font-mono px-3 h-7 shrink-0 data-[state=active]:bg-background data-[state=active]:shadow-none">
                Dialogs
              </TabsTrigger>
              <TabsTrigger value="bodymap" className="text-xs font-mono px-3 h-7 shrink-0 data-[state=active]:bg-background data-[state=active]:shadow-none">
                BodyMap
              </TabsTrigger>
              <TabsTrigger value="ai" className="text-xs font-mono px-3 h-7 shrink-0 data-[state=active]:bg-background data-[state=active]:shadow-none">
                AI
              </TabsTrigger>
              <TabsTrigger value="database" className="text-xs font-mono px-3 h-7 shrink-0 data-[state=active]:bg-background data-[state=active]:shadow-none">
                Database
              </TabsTrigger>
              <TabsTrigger value="indexeddb" className="text-xs font-mono px-3 h-7 shrink-0 data-[state=active]:bg-background data-[state=active]:shadow-none">
                IndexedDB
              </TabsTrigger>
              <TabsTrigger value="sync" className="text-xs font-mono px-3 h-7 shrink-0 data-[state=active]:bg-background data-[state=active]:shadow-none">
                Sync &amp; Storage
              </TabsTrigger>
            </TabsList>
            <div className="text-2xs font-mono text-muted-foreground hidden lg:block shrink-0">
              <BrandText text="e2Cal UI System" />
            </div>
          </div>

          <div className="pt-4">
            <TabsContent value="tokens" className="m-0 focus-visible:outline-none">
              <TokensTab
                tokens={tokens}
                updateToken={updateToken}
                resetTokens={resetTokens}
                exportCss={exportCss}
                hasModifications={hasModifications}
              />
            </TabsContent>

            <TabsContent value="primitives" className="m-0 focus-visible:outline-none">
              <PrimitivesTab />
            </TabsContent>

            <TabsContent value="components" className="m-0 focus-visible:outline-none">
              <ComponentsTab />
            </TabsContent>

            <TabsContent value="dialogs" className="m-0 focus-visible:outline-none">
              <DialogsTab />
            </TabsContent>

            <TabsContent value="bodymap" className="m-0 focus-visible:outline-none">
              <BodyMapTab />
            </TabsContent>

            <TabsContent value="ai" className="m-0 focus-visible:outline-none">
              <AITab />
            </TabsContent>

            <TabsContent value="database" className="m-0 focus-visible:outline-none">
              <DatabaseTab />
            </TabsContent>

            <TabsContent value="indexeddb" className="m-0 focus-visible:outline-none">
              <IndexedDBTab />
            </TabsContent>

            <TabsContent value="sync" className="m-0 focus-visible:outline-none">
              <SyncDiagnosticsTab />
            </TabsContent>
          </div>
        </Tabs>
      </main>
    </div>
  );
}
