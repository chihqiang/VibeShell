import { createContext, useState, useCallback, useMemo, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface ToastItem {
  id: number;
  message: string;
  leaving: boolean;
}

interface ToastOptions {
  duration?: number;
}

interface ToastContextValue {
  toast: (msg: string, options?: ToastOptions) => void;
  dismissToast: (id: number) => void;
}

const DISMISS_DELAY = 200;

// eslint-disable-next-line react-refresh/only-export-components
export const ToastContext = createContext<ToastContextValue>({
  toast: () => {},
  dismissToast: () => {},
});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const removeItem = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const dismissToast = useCallback(
    (id: number) => {
      setItems((prev) => prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
      setTimeout(() => removeItem(id), DISMISS_DELAY);
    },
    [removeItem],
  );

  const toast = useCallback(
    (message: string, options?: ToastOptions) => {
      const id = nextId.current++;
      const duration = options?.duration ?? 3000;
      setItems((prev) => [...prev, { id, message, leaving: false }]);
      setTimeout(() => dismissToast(id), duration);
    },
    [dismissToast],
  );

  const value = useMemo(() => ({ toast, dismissToast }), [toast, dismissToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-6 left-1/2 z-[100] flex flex-col-reverse gap-2 -translate-x-1/2 pointer-events-none">
        {items.map((t) => (
          <div
            key={t.id}
            onClick={() => dismissToast(t.id)}
            className={cn(
              'rounded-lg bg-foreground px-4 py-2 text-sm text-background shadow-lg cursor-pointer pointer-events-auto',
              t.leaving ? 'animate-fade-out-down' : 'animate-fade-in-up',
            )}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
