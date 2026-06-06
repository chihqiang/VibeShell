import { useCallback, useEffect } from 'react';
import { useStorage } from '@/lib/storage';

export type Theme = 'dark' | 'light';

export const themeDisplayName: Record<Theme, string> = {
  dark: 'Dark',
  light: 'Light',
};

export const themeOptions: Theme[] = ['dark', 'light'];

const STORAGE_KEY = 'vibeshell-theme';
const DEFAULT_THEME: Theme = 'light';

function isValidTheme(t: string): t is Theme {
  return t === 'dark' || t === 'light';
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

export function useTheme() {
  const [theme, persistTheme] = useStorage<Theme>(STORAGE_KEY, DEFAULT_THEME);
  const actualTheme = isValidTheme(theme) ? theme : DEFAULT_THEME;

  useEffect(() => {
    applyTheme(actualTheme);
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
