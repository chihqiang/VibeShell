import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface ToastProps {
  message: string;
  trigger: number;
}

export function Toast({ message, trigger }: ToastProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (trigger === 0) return;
    setVisible(true);
    const id = setTimeout(() => setVisible(false), 1500);
    return () => clearTimeout(id);
  }, [trigger]);

  return (
    <div
      className={cn(
        'fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground shadow-lg transition-all duration-300',
        visible ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0 pointer-events-none',
      )}
    >
      <div className="flex items-center gap-2">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
        {message}
      </div>
    </div>
  );
}
