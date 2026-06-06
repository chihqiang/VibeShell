import { useCallback, useEffect, useState } from 'react';

function isSameType(a: unknown, b: unknown): boolean {
  if (a === null || b === null) return a === null && b === null;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (typeof a !== typeof b) return false;
  return true;
}

export function getStorage<T>(key: string, defaultValue: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return defaultValue;
    const parsed: unknown = JSON.parse(raw);
    if (!isSameType(parsed, defaultValue)) return defaultValue;
    return parsed as T;
  } catch {
    return defaultValue;
  }
}

export function setStorage<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export function useStorage<T>(key: string, defaultValue: T): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => getStorage(key, defaultValue));

  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === key && e.newValue !== null) {
        try {
          setValue(JSON.parse(e.newValue) as T);
        } catch {
          setValue(defaultValue);
        }
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, [key, defaultValue]);

  const setAndPersist = useCallback(
    (next: T) => {
      setValue(next);
      setStorage(key, next);
    },
    [key],
  );

  return [value, setAndPersist];
}
