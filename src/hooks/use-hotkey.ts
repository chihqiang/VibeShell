import { useState, useEffect, useRef, useCallback } from 'react';
import { listen } from '@tauri-apps/api/event';
import { loadHotkeys, saveHotkeys } from '@/apis/api/config';
import type { HotkeyAction, HotkeyConfig } from '@/apis/types/config';
import { getHotkeyDefaults } from '@/storage/config';
import { useNotify } from '@/hooks/use-notify';

export function useHotkey(action: HotkeyAction, callback: () => void) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    let cancelled = false;
    let unlistenFn: (() => void) | null = null;

    listen<string>('shortcut://action', (event) => {
      if (event.payload === action) {
        callbackRef.current();
      }
    }).then((fn) => {
      if (cancelled) {
        fn();
      } else {
        unlistenFn = fn;
      }
    });

    return () => {
      cancelled = true;
      unlistenFn?.();
    };
  }, [action]);
}

export function useHotkeyStorage(): [HotkeyConfig, (config: HotkeyConfig) => void, boolean] {
  const { notifyError } = useNotify();
  const [config, setConfig] = useState<HotkeyConfig>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [defaults, data] = await Promise.all([getHotkeyDefaults(), loadHotkeys()]);
        setConfig({ ...defaults, ...data });
      } catch (e) {
        notifyError(e, false);
      } finally {
        setLoaded(true);
      }
    })();
  }, [notifyError]);

  const save = useCallback(
    (next: HotkeyConfig) => {
      setConfig(next);
      saveHotkeys({ config: next }).catch((e) => notifyError(e, false));
    },
    [notifyError],
  );

  return [config, save, loaded];
}
