import { useState, useEffect, useCallback } from 'react';
import {
  parseStoredUiScale,
  applyUiScale,
  persistUiScale,
  UI_SCALE_CHANGE_EVENT,
  UI_SCALE_STORAGE_KEY,
  type UiScale,
} from '@/utils/uiScale';

function readCurrentUiScale(): UiScale {
  if (typeof window === 'undefined') return 'default';
  try {
    return parseStoredUiScale(window.localStorage.getItem(UI_SCALE_STORAGE_KEY));
  } catch {
    return 'default';
  }
}

export function useUiScale() {
  const [scale, setScaleState] = useState<UiScale>(readCurrentUiScale);

  useEffect(() => {
    const handleUpdate = () => {
      const nextScale = readCurrentUiScale();
      setScaleState(nextScale);
      applyUiScale(nextScale);
    };

    window.addEventListener(UI_SCALE_CHANGE_EVENT, handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener(UI_SCALE_CHANGE_EVENT, handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  const setScale = useCallback((nextScale: UiScale) => {
    setScaleState(nextScale);
    applyUiScale(nextScale);
    persistUiScale(nextScale);
  }, []);

  return {
    scale,
    setScale,
  };
}
