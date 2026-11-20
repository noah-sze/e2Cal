import { useEffect, useState, useCallback, useMemo } from 'react';

export interface DevTokenConfig {
  // 核心色彩
  '--background'?: string;
  '--foreground'?: string;
  '--card'?: string;
  '--border'?: string;
  '--primary'?: string;
  '--destructive'?: string;
  '--muted'?: string;
  '--muted-foreground'?: string;

  // 熱量、三大營養素與微量鈉 (Calories, Carbs, Protein, Fat, Sodium)
  '--calories'?: string;
  '--carbs'?: string;
  '--protein'?: string;
  '--fat'?: string;
  '--sodium'?: string;

  // 肌群強度赤陶階梯
  '--muscle-intensity-high-bg'?: string;
  '--muscle-intensity-med-bg'?: string;
  '--muscle-intensity-low-bg'?: string;

  // 容器幾何與字體排版
  '--radius'?: string;
  '--tracking-brand'?: string;
  '--text-xs'?: string;
  '--text-2xs'?: string;

  // 字型家族 (Font Families)
  '--font-brand'?: string;
  '--font-sans'?: string;
  '--font-mono'?: string;
  '--font-serif'?: string;
}

const STORAGE_KEY = 'e2cal_dev_tokens_overrides';

export function useDevTokens() {
  const [tokens, setTokens] = useState<DevTokenConfig>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // 即時將所有自訂 Token 注入 document.documentElement
  const applyTokensToDom = useCallback((activeTokens: DevTokenConfig) => {
    const root = document.documentElement;
    Object.entries(activeTokens).forEach(([prop, val]) => {
      if (val !== undefined && val !== '') {
        root.style.setProperty(prop, val);
      } else {
        root.style.removeProperty(prop);
      }
    });
  }, []);

  // 當 tokens 改變時，套用至 DOM 並暫存至 localStorage
  useEffect(() => {
    applyTokensToDom(tokens);
    try {
      if (Object.keys(tokens).length > 0) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // 忽略暫存寫入異常
    }
  }, [tokens, applyTokensToDom]);

  // 卸載時清理 DOM inline properties，確保不污染正式 App 流程
  useEffect(() => {
    return () => {
      const root = document.documentElement;
      Object.keys(tokens).forEach((prop) => {
        root.style.removeProperty(prop);
      });
    };
  }, [tokens]);

  const updateToken = useCallback((key: keyof DevTokenConfig, value: string) => {
    setTokens((prev) => {
      const next = { ...prev };
      if (!value) {
        delete next[key];
      } else {
        next[key] = value;
      }
      return next;
    });
  }, []);

  const resetTokens = useCallback(() => {
    const root = document.documentElement;
    Object.keys(tokens).forEach((prop) => {
      root.style.removeProperty(prop);
    });
    setTokens({});
    localStorage.removeItem(STORAGE_KEY);
  }, [tokens]);

  const exportCss = useCallback(() => {
    if (Object.keys(tokens).length === 0) {
      return '/* 目前無自訂覆蓋，使用專案預設 Design Tokens */';
    }
    const lines = Object.entries(tokens)
      .map(([key, val]) => `    ${key}: ${val};`)
      .join('\n');
    return `/* e2Cal Custom Design Tokens Export */\n:root {\n${lines}\n}`;
  }, [tokens]);

  const hasModifications = useMemo(() => Object.keys(tokens).length > 0, [tokens]);

  return {
    tokens,
    updateToken,
    resetTokens,
    exportCss,
    hasModifications,
  };
}
