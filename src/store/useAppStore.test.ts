import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from './useAppStore';
import { format } from 'date-fns';

describe('useAppStore (全域應用狀態與日期會話合約)', () => {
  beforeEach(() => {
    // 重置為當天
    useAppStore.setState({
      selectedDate: format(new Date(), 'yyyy-MM-dd'),
    });
  });

  it('初始狀態下 selectedDate 恆定為當天的真實物理日期', () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const state = useAppStore.getState();
    expect(state.selectedDate).toBe(today);
  });

  it('在同一次會話期間，setSelectedDate 應能正常切換日期', () => {
    const state = useAppStore.getState();
    state.setSelectedDate('2026-11-01');
    expect(useAppStore.getState().selectedDate).toBe('2026-11-01');
  });

  it('partialize 持久化白名單中嚴禁包含 selectedDate', () => {
    // 獲取 persist 配置中的 partialize
    const persistOptions = useAppStore.persist?.getOptions();
    if (persistOptions?.partialize) {
      const state = useAppStore.getState();
      const partial = persistOptions.partialize({
        ...state,
        selectedDate: '2026-11-01',
        hidePwaInstallPrompt: true,
        nutritionDisplayMode: 'per100g',
        hasConfirmedRawWeight: true,
      });
      expect('selectedDate' in partial).toBe(false);
      expect(partial.hidePwaInstallPrompt).toBe(true);
      expect(partial.nutritionDisplayMode).toBe('per100g');
      expect(partial.hasConfirmedRawWeight).toBe(true);
    }
  });

  it('merge 防禦性水合：即使外部 localStorage 存在歷史殘留舊日期，亦被徹底阻斷，確保為當前物理今天', () => {
    const persistOptions = useAppStore.persist?.getOptions();
    if (persistOptions?.merge) {
      const today = format(new Date(), 'yyyy-MM-dd');
      const currentState = {
        ...useAppStore.getState(),
        selectedDate: today,
        hidePwaInstallPrompt: false,
        nutritionDisplayMode: 'serving' as const,
      };
      const persistedStateWithOldDate = {
        selectedDate: '2025-01-01', // 舊版殘留歷史日期
        hidePwaInstallPrompt: true,
      };

      const merged = persistOptions.merge(persistedStateWithOldDate, currentState);
      // selectedDate 必須為當前真實物理今天，絕不被 2025-01-01 覆蓋
      expect(merged.selectedDate).toBe(today);
      expect(merged.hidePwaInstallPrompt).toBe(true);
    }
  });
});
