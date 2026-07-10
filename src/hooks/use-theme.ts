import { useCallback, useEffect } from 'react';
import { useStorage } from '@/utils/storage';
import { STORAGE_KEYS } from '@/constants/storage-keys';
import type { Theme } from '@/types/common';

export type { Theme };

export const themeDisplayName: Record<Theme, string> = {
  dark: 'Dark',
  light: 'Light',
  auto: 'Auto',
};

export const themeOptions: Theme[] = ['dark', 'light', 'auto'];

const DEFAULT_THEME: Theme = 'dark';

function isValidTheme(t: string): t is Theme {
  return t === 'dark' || t === 'light' || t === 'auto';
}

function getSystemTheme(): 'dark' | 'light' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getResolvedTheme(theme: Theme): 'dark' | 'light' {
  return theme === 'auto' ? getSystemTheme() : theme;
}

function applyTheme(theme: Theme) {
  const resolved = getResolvedTheme(theme);
  const root = document.documentElement;
  if (resolved === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
  root.style.setProperty('--term-flush', String(Date.now()));
}

export function useTheme() {
  const [theme, persistTheme] = useStorage<Theme>(STORAGE_KEYS.THEME, DEFAULT_THEME);
  const actualTheme = isValidTheme(theme) ? theme : DEFAULT_THEME;

  useEffect(() => {
    applyTheme(actualTheme);

    // Listen for system theme changes when in auto mode
    if (actualTheme === 'auto') {
      const mql = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = () => applyTheme('auto');
      mql.addEventListener('change', handler);
      return () => mql.removeEventListener('change', handler);
    }
  }, [actualTheme]);

  const setTheme = useCallback(
    (t: Theme) => {
      persistTheme(t);
      applyTheme(t);
    },
    [persistTheme],
  );

  return { theme: actualTheme, setTheme };
}
