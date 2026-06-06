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
        'fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-foreground px-4 py-2 text-sm text-background shadow-lg transition-all duration-300',
        visible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0 pointer-events-none',
      )}
    >
      {message}
    </div>
  );
}
