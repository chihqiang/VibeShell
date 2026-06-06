import { useTranslation } from 'react-i18next';
import { Lock, KeyRound } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AuthMethod } from '@/lib/types';

export default function AuthToggle({
  value,
  onChange,
  compact,
}: {
  value: AuthMethod;
  onChange: (v: AuthMethod) => void;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  if (compact) {
    return (
      <div className="flex items-center gap-0.5 bg-muted rounded-lg p-0.5">
        {(['password', 'key'] as const).map((method) => (
          <button
            key={method}
            onClick={() => onChange(method)}
            className={cn(
              'flex items-center gap-1 h-7 px-2 text-[10px] rounded-md cursor-pointer transition-colors',
              value === method
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {method === 'password' ? <Lock size={10} /> : <KeyRound size={10} />}
            {method === 'password' ? t('connection.passwordAuth') : t('connection.keyAuth')}
          </button>
        ))}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-2">
      {(['password', 'key'] as const).map((method) => (
        <button
          key={method}
          onClick={() => onChange(method)}
          className={cn(
            'flex items-center justify-center gap-2 h-9 text-sm rounded-lg border transition-all cursor-pointer',
            value === method
              ? 'bg-primary/10 border-primary text-primary'
              : 'bg-background border-input text-muted-foreground hover:border-muted-foreground',
          )}
        >
          {method === 'password' ? <Lock size={14} /> : <KeyRound size={14} />}
          {method === 'password' ? t('connection.passwordAuth') : t('connection.keyAuth')}
        </button>
      ))}
    </div>
  );
}
