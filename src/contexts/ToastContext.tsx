import { createContext, useState, useCallback, useMemo, useRef, type ReactNode } from 'react';
import { cn } from '@/utils/cn';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { TOAST_DEFAULT_DURATION, TOAST_DISMISS_DELAY } from '@/constants/app';

interface ToastItem {
  id: number;
  message: string;
  leaving: boolean;
  type: 'success' | 'error' | 'info';
}

interface ToastOptions {
  duration?: number;
  type?: 'success' | 'error' | 'info';
}

interface ToastContextValue {
  toast: (msg: string, options?: ToastOptions) => void;
  dismissToast: (id: number) => void;
}

const DISMISS_DELAY = TOAST_DISMISS_DELAY;

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
      const duration = options?.duration ?? TOAST_DEFAULT_DURATION;
      const type = options?.type ?? 'info';
      setItems((prev) => [...prev, { id, message, leaving: false, type }]);
      setTimeout(() => dismissToast(id), duration);
    },
    [dismissToast],
  );

  const value = useMemo(() => ({ toast, dismissToast }), [toast, dismissToast]);

  const typeStyles = {
    success: 'bg-gradient-to-r from-emerald-600 to-emerald-700 shadow-[0_4px_12px_-2px_rgba(16,185,129,0.4)]',
    error: 'bg-gradient-to-r from-red-600 to-red-700 shadow-[0_4px_12px_-2px_rgba(239,68,68,0.4)]',
    info: 'bg-gradient-to-r from-blue-600 to-blue-700 shadow-[0_4px_12px_-2px_rgba(59,130,246,0.4)]',
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-6 left-1/2 z-[100] flex flex-col-reverse gap-2 -translate-x-1/2 pointer-events-none">
        {items.map((t) => {
          const icon =
            t.type === 'success' ? (
              <CheckCircle2 size={15} className="text-green-300 flex-shrink-0" />
            ) : t.type === 'error' ? (
              <AlertCircle size={15} className="text-red-300 flex-shrink-0" />
            ) : (
              <Info size={15} className="text-blue-300 flex-shrink-0" />
            );
          return (
            <div
              key={t.id}
              onClick={() => dismissToast(t.id)}
              className={cn(
                'flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm text-white cursor-pointer pointer-events-auto backdrop-blur-sm',
                typeStyles[t.type],
                t.leaving ? 'animate-fade-out-down' : 'animate-fade-in-up',
              )}
            >
              {icon}
              {t.message}
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
