import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { listKeys } from '@/services/keyService';
import { Input } from '@/components/ui/input';
import { ImportKeyDialog } from '@/components/keys';
import type { HostConfig } from '@/types';
import type { KeyEntry } from '@/types/key';
import { AuthToggle, KeySelector } from '@/components/host';
import { Field, NumberInput } from '@/components/ui';
import { DEFAULT_SSH_PORT } from '@/constants';

interface HostFormProps {
  value: HostConfig;
  onChange: (data: HostConfig) => void;
  keys: KeyEntry[];
  compact?: boolean;
}

export function HostForm({ value, onChange, keys, compact }: HostFormProps) {
  const { t } = useTranslation();
  const [keyOpen, setKeyOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [allKeys, setAllKeys] = useState(keys);
  const keyRef = useRef<HTMLDivElement>(null);

  const updateField = <K extends keyof HostConfig>(key: K, v: HostConfig[K]) => {
    onChange({ ...value, [key]: v });
  };

  const selectedKey = value.key_id
    ? (allKeys.find((k) => value.key_id === k.id) ?? null)
    : null;

  const handleSelectKey = async (entry: KeyEntry) => {
    updateField('key_id', entry.id);
    updateField('key_passphrase', entry.password || '');
    // 密钥的 passphrase 同步到 password 字段，供连接时传输到后端
    updateField('password', entry.password || '');
    setKeyOpen(false);
  };

  const renderImportDialog = () => (
    <ImportKeyDialog
      open={importDialogOpen}
      onClose={() => setImportDialogOpen(false)}
      onImported={async () => {
        const updated = await listKeys();
        setAllKeys(updated);
      }}
    />
  );

  const renderKeySection = () => (
    <div ref={keyRef}>
      <KeySelector
        selectedKey={selectedKey}
        allKeys={allKeys}
        keyOpen={keyOpen}
        keyPassphrase={value.key_passphrase || ''}
        onToggle={() => setKeyOpen(!keyOpen)}
        onSelect={handleSelectKey}
        onPassphraseChange={(v) => updateField('key_passphrase', v)}
        onImport={() => {
          setKeyOpen(false);
          setImportDialogOpen(true);
        }}
        compact={compact}
      />
    </div>
  );

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
            <NumberInput
              value={value.port}
              onChange={(v) => updateField('port', v)}
              placeholder={String(DEFAULT_SSH_PORT)}
              compact
            />
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
            <AuthToggle value={value.auth_method} onChange={(v) => updateField('auth_method', v)} compact />
          </div>

          {value.auth_method === 'password' ? (
            <Field label={t('quickConnect.password')} compact>
              <Input
                type="password"
                value={value.password}
                onChange={(e) => updateField('password', e.target.value)}
                className="h-8 w-24 text-xs"
              />
            </Field>
          ) : (
            renderKeySection()
          )}
        </div>

        {renderImportDialog()}
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
          <NumberInput
            value={value.port}
            onChange={(v) => updateField('port', v)}
            placeholder={String(DEFAULT_SSH_PORT)}
          />
        </Field>
      </div>

      <Field label={t('connection.username')}>
        <Input value={value.username} onChange={(e) => updateField('username', e.target.value)} />
      </Field>

      <Field label={t('connection.authMethod')}>
        <AuthToggle value={value.auth_method} onChange={(v) => updateField('auth_method', v)} />
      </Field>

      {value.auth_method === 'password' ? (
        <Field label={t('connection.password')}>
          <Input type="password" value={value.password} onChange={(e) => updateField('password', e.target.value)} />
        </Field>
      ) : (
        renderKeySection()
      )}

      {renderImportDialog()}
    </>
  );
}
