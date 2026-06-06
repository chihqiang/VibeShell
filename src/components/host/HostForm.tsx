import { useState, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { listKeys } from '@/api/keys';
import { Lock, KeyRound, ChevronDown, FileKey, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import ImportKeyDialog from '@/components/host/dialogs/ImportKeyDialog';
import type { KeyEntry } from '@/api/keys';

export interface HostFormData {
  hostname: string;
  port: number;
  username: string;
  authMethod: 'password' | 'key';
  password: string;
  privateKeyPath: string;
  keyPassphrase: string;
}

interface HostFormProps {
  value: HostFormData;
  onChange: (data: HostFormData) => void;
  keys: KeyEntry[];
  compact?: boolean;
}

function Field({
  label,
  compact,
  className,
  children,
}: {
  label: string;
  compact?: boolean;
  className?: string;
  children: ReactNode;
}) {
  if (compact) {
    return (
      <div className={cn('flex flex-col gap-1', className)}>
        <span className="text-[10px] text-muted-foreground font-medium">{label}</span>
        {children}
      </div>
    );
  }
  return (
    <div className={className}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function PortInput({ value, onChange, compact }: { value: number; onChange: (v: number) => void; compact?: boolean }) {
  return (
    <Input
      value={value || ''}
      onChange={(e) => {
        const v = e.target.value.replace(/\D/g, '');
        onChange(v === '' ? 0 : parseInt(v, 10));
      }}
      placeholder="22"
      className={compact ? 'h-8 w-16 text-xs' : ''}
    />
  );
}

function AuthToggle({
  value,
  onChange,
  compact,
}: {
  value: 'password' | 'key';
  onChange: (v: 'password' | 'key') => void;
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

function KeySelector({
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
      {compact && <span className="text-[10px] text-muted-foreground font-medium">{t('connection.privateKey')}</span>}
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
                        <span className="text-[10px] text-muted-foreground font-mono truncate">
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

export default function HostForm({ value, onChange, keys, compact }: HostFormProps) {
  const { t } = useTranslation();
  const [keyOpen, setKeyOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [allKeys, setAllKeys] = useState<KeyEntry[]>(keys);
  const keyRef = useRef<HTMLDivElement>(null);

  const updateField = <K extends keyof HostFormData>(key: K, v: HostFormData[K]) => {
    onChange({ ...value, [key]: v });
  };

  const selectedKey = value.privateKeyPath
    ? (allKeys.find((k) => value.privateKeyPath.endsWith(k.file_name)) ?? null)
    : null;

  const handleSelectKey = async (entry: KeyEntry) => {
    const { getKeysPath } = await import('@/storage/config');
    updateField('privateKeyPath', `${await getKeysPath()}/${entry.file_name}`);
    updateField('keyPassphrase', entry.password || '');
    setKeyOpen(false);
  };

  if (compact) {
    return (
      <>
        <div className="flex items-end gap-2 justify-center">
          <Field label={t('quickConnect.hostname')} compact>
            <Input
              value={value.hostname}
              onChange={(e) => updateField('hostname', e.target.value)}
              placeholder="192.168.1.1"
              className="h-8 w-32 text-xs"
            />
          </Field>
          <Field label={t('quickConnect.port')} compact>
            <PortInput value={value.port} onChange={(v) => updateField('port', v)} compact />
          </Field>
          <Field label={t('quickConnect.username')} compact>
            <Input
              value={value.username}
              onChange={(e) => updateField('username', e.target.value)}
              placeholder="root"
              className="h-8 w-24 text-xs"
            />
          </Field>

          <div className="flex flex-col h-[52px] justify-end">
            <AuthToggle value={value.authMethod} onChange={(v) => updateField('authMethod', v)} compact />
          </div>

          {value.authMethod === 'password' ? (
            <Field label={t('quickConnect.password')} compact>
              <Input
                type="password"
                value={value.password}
                onChange={(e) => updateField('password', e.target.value)}
                className="h-8 w-24 text-xs"
              />
            </Field>
          ) : (
            <div ref={keyRef}>
              <KeySelector
                selectedKey={selectedKey}
                allKeys={allKeys}
                keyOpen={keyOpen}
                keyPassphrase={value.keyPassphrase}
                onToggle={() => setKeyOpen(!keyOpen)}
                onSelect={handleSelectKey}
                onPassphraseChange={(v) => updateField('keyPassphrase', v)}
                onImport={() => {
                  setKeyOpen(false);
                  setImportDialogOpen(true);
                }}
                compact
              />
            </div>
          )}
        </div>

        <ImportKeyDialog
          open={importDialogOpen}
          onClose={() => setImportDialogOpen(false)}
          onImported={async () => {
            const updated = await listKeys();
            setAllKeys(updated);
          }}
        />
      </>
    );
  }

  return (
    <>
      <div className="grid grid-cols-4 gap-3">
        <Field label={t('connection.hostname')} className="col-span-3">
          <Input
            value={value.hostname}
            onChange={(e) => updateField('hostname', e.target.value)}
            placeholder="192.168.1.1"
          />
        </Field>
        <Field label={t('connection.port')}>
          <PortInput value={value.port} onChange={(v) => updateField('port', v)} />
        </Field>
      </div>

      <Field label={t('connection.username')}>
        <Input value={value.username} onChange={(e) => updateField('username', e.target.value)} />
      </Field>

      <Field label={t('connection.authMethod')}>
        <AuthToggle value={value.authMethod} onChange={(v) => updateField('authMethod', v)} />
      </Field>

      {value.authMethod === 'password' ? (
        <Field label={t('connection.password')}>
          <Input type="password" value={value.password} onChange={(e) => updateField('password', e.target.value)} />
        </Field>
      ) : (
        <div ref={keyRef}>
          <KeySelector
            selectedKey={selectedKey}
            allKeys={allKeys}
            keyOpen={keyOpen}
            keyPassphrase={value.keyPassphrase}
            onToggle={() => setKeyOpen(!keyOpen)}
            onSelect={handleSelectKey}
            onPassphraseChange={(v) => updateField('keyPassphrase', v)}
            onImport={() => {
              setKeyOpen(false);
              setImportDialogOpen(true);
            }}
          />
        </div>
      )}

      <ImportKeyDialog
        open={importDialogOpen}
        onClose={() => setImportDialogOpen(false)}
        onImported={async () => {
          const updated = await listKeys();
          setAllKeys(updated);
        }}
      />
    </>
  );
}
