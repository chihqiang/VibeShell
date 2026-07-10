import { useTranslation } from 'react-i18next';
import { ChevronDown, FileKey, Upload } from 'lucide-react';
import { cn } from '@/utils';
import { Input } from '@/components/ui/input';
import type { KeyEntry } from '@/types/key';

export function KeySelector({
  selectedKey,
  allKeys,
  keyOpen,
  keyPassphrase,
  onToggle,
  onSelect,
  onPassphraseChange,
  onImport,
  compact,
}: {
  selectedKey: KeyEntry | null;
  allKeys: KeyEntry[];
  keyOpen: boolean;
  keyPassphrase: string;
  onToggle: () => void;
  onSelect: (entry: KeyEntry) => void;
  onPassphraseChange: (v: string) => void;
  onImport: () => void;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className={compact ? 'flex flex-col gap-1 relative' : 'relative'}>
      {compact && <span className="text-[11px] text-muted-foreground font-medium">{t('connection.privateKey')}</span>}
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          'flex items-center justify-between rounded-lg border border-input bg-background transition-colors cursor-pointer hover:border-muted-foreground',
          compact ? 'h-8 w-36 px-2 text-xs' : 'w-full h-8 px-2.5 py-1 text-sm',
        )}
      >
        <span className={cn(selectedKey ? 'text-foreground' : 'text-muted-foreground', compact && 'truncate')}>
          {selectedKey ? selectedKey.name : t('sidebar.selectKey')}
        </span>
        <ChevronDown size={compact ? 12 : 14} className="text-muted-foreground flex-shrink-0 ml-1" />
      </button>

      {keyOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={onToggle} />
          <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-lg border border-border bg-popover shadow-lg overflow-hidden">
            <div className="max-h-48 overflow-y-auto">
              {allKeys.length === 0 ? (
                <div className={cn('text-muted-foreground', compact ? 'px-3 py-2 text-[11px]' : 'px-3 py-2 text-xs')}>
                  {t('sidebar.noKeys')}
                </div>
              ) : (
                allKeys.map((k) => (
                  <button
                    key={k.id}
                    onClick={() => onSelect(k)}
                    className={cn(
                      'flex items-center gap-2 w-full text-left transition-colors hover:bg-muted cursor-pointer',
                      selectedKey?.id === k.id ? 'bg-primary/5' : '',
                      compact ? 'px-3 py-1.5 text-xs' : 'px-3 py-2 text-sm',
                    )}
                  >
                    <FileKey size={compact ? 12 : 14} className="text-muted-foreground flex-shrink-0" />
                    {compact ? (
                      <span className="truncate">{k.name}</span>
                    ) : (
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-sm text-foreground truncate">{k.name}</span>
                        <span className="text-[11px] text-muted-foreground font-mono truncate">
                          {k.key_type} {k.fingerprint}
                        </span>
                      </div>
                    )}
                  </button>
                ))
              )}
            </div>

            <div className="h-px bg-border mx-2" />

            <button
              onClick={onImport}
              className={cn(
                'flex items-center gap-1.5 w-full h-8 px-3 text-left text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer',
                compact ? 'text-xs' : 'text-sm',
              )}
            >
              <Upload size={compact ? 12 : 13} />
              {t('sidebar.importKey')}
            </button>
          </div>
        </>
      )}

      <Input
        type="password"
        value={keyPassphrase}
        onChange={(e) => onPassphraseChange(e.target.value)}
        placeholder={t('sidebar.keyPassphrasePlaceholder') || 'Enter passphrase'}
        className={compact ? 'h-8 w-36 text-xs' : ''}
      />
    </div>
  );
}
