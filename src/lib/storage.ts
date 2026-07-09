import { useCallback, useEffect, useRef, useState } from 'react';

function isSameType(a: unknown, b: unknown): boolean {
  if (a === null || b === null) return a === null && b === null;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (typeof a !== typeof b) return false;
  if (typeof a === 'object' && typeof b === 'object') {
    const bKeys = Object.keys(b as Record<string, unknown>);
    return bKeys.every((k) => k in (a as Record<string, unknown>));
  }
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

  // Store defaultValue in a ref so it doesn't trigger effect re-registration
  // when callers pass inline object literals (new identity each render).
  const defaultRef = useRef(defaultValue);
  defaultRef.current = defaultValue;

  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === key && e.newValue !== null) {
        try {
          setValue(JSON.parse(e.newValue) as T);
        } catch {
          setValue(defaultRef.current);
        }
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, [key]);

  const setAndPersist = useCallback(
    (next: T) => {
      setValue(next);
      setStorage(key, next);
    },
    [key],
  );

  return [value, setAndPersist];
}
