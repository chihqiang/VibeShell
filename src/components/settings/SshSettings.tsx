import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  DEFAULT_SSH_PORT,
  DEFAULT_MONITOR_INTERVAL,
  DEFAULT_HEARTBEAT_INTERVAL,
  DEFAULT_RECONNECT_MAX_RETRIES,
  DEFAULT_RECONNECT_INITIAL_DELAY,
  DEFAULT_RECONNECT_MAX_DELAY,
  SETTINGS_DEBOUNCE_MS,
} from '@/constants';

interface SshSettingsProps {
  defaults: Record<string, string>;
  onSave: (key: string, value: string) => void;
}

export function SshSettings({ defaults, onSave }: SshSettingsProps) {
  const { t } = useTranslation();
  // Local form state — syncs from props, debounces saves
  const [form, setForm] = useState<Record<string, string>>(defaults);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstRender = useRef(true);

  // Sync external defaults into local form when they change (e.g. initial load)
  useEffect(() => {
    setForm(defaults);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(defaults)]);

  // Debounced save — flushes to backend 600ms after last keystroke
  const debouncedSave = useCallback(
    (updated: Record<string, string>) => {
      if (firstRender.current) {
        firstRender.current = false;
        return;
      }
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        for (const key of Object.keys(updated)) {
          if (updated[key] !== defaults[key]) {
            onSave(key, updated[key]);
          }
        }
      }, SETTINGS_DEBOUNCE_MS);
    },
    [defaults, onSave],
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const updateField = (key: string, value: string) => {
    const updated = { ...form, [key]: value };
    setForm(updated);
    debouncedSave(updated);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.ssh')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>{t('settings.defaultHostname')}</Label>
          <Input
            type="text"
            value={form.hostname || ''}
            onChange={(e) => updateField('hostname', e.target.value)}
            placeholder="192.168.1.1"
            className="mt-1"
          />
        </div>
        <div>
          <Label>{t('settings.defaultUsername')}</Label>
          <Input
            type="text"
            value={form.username || ''}
            onChange={(e) => updateField('username', e.target.value)}
            placeholder="root"
            className="mt-1"
          />
        </div>
        <div>
          <Label>{t('settings.defaultPort')}</Label>
          <Input
            type="text"
            inputMode="numeric"
            value={form.port && form.port !== '0' ? form.port : ''}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, '');
              updateField('port', v || '0');
            }}
            placeholder={String(DEFAULT_SSH_PORT)}
            className="mt-1"
          />
        </div>
        <div>
          <Label>{t('settings.monitorInterval')}</Label>
          <Input
            type="text"
            inputMode="numeric"
            value={form.monitorInterval || ''}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, '');
              const num = parseInt(v, 10);
              updateField('monitorInterval', isNaN(num) || num < 1 ? String(DEFAULT_MONITOR_INTERVAL) : String(num));
            }}
            placeholder={String(DEFAULT_MONITOR_INTERVAL)}
            className="mt-1"
          />
          <p className="text-[11px] text-muted-foreground mt-0.5">{t('settings.monitorIntervalHint')}</p>
        </div>
        <div>
          <Label>{t('settings.heartbeatInterval')}</Label>
          <Input
            type="text"
            inputMode="numeric"
            value={form.heartbeatInterval || ''}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, '');
              const num = parseInt(v, 10);
              updateField(
                'heartbeatInterval',
                isNaN(num) || num < 1 ? String(DEFAULT_HEARTBEAT_INTERVAL) : String(num),
              );
            }}
            placeholder={String(DEFAULT_HEARTBEAT_INTERVAL)}
            className="mt-1"
          />
          <p className="text-[11px] text-muted-foreground mt-0.5">{t('settings.heartbeatIntervalHint')}</p>
        </div>

        <div className="border-t border-border pt-4">
          <Label className="text-xs font-semibold text-foreground">{t('settings.reconnectTitle')}</Label>
        </div>

        <div className="flex items-center justify-between">
          <Label className="text-xs">{t('settings.reconnectEnabled')}</Label>
          <Switch
            checked={form.reconnectEnabled !== 'false'}
            onCheckedChange={(v) => updateField('reconnectEnabled', String(v))}
          />
        </div>

        <div>
          <Label>{t('settings.reconnectMaxRetries')}</Label>
          <Input
            type="text"
            inputMode="numeric"
            value={form.reconnectMaxRetries || ''}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, '');
              const num = parseInt(v, 10);
              updateField(
                'reconnectMaxRetries',
                isNaN(num) || num < 1 ? String(DEFAULT_RECONNECT_MAX_RETRIES) : String(num),
              );
            }}
            placeholder={String(DEFAULT_RECONNECT_MAX_RETRIES)}
            className="mt-1"
          />
        </div>

        <div>
          <Label>{t('settings.reconnectInitialDelay')}</Label>
          <Input
            type="text"
            inputMode="numeric"
            value={form.reconnectInitialDelay || ''}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, '');
              const num = parseInt(v, 10);
              updateField(
                'reconnectInitialDelay',
                isNaN(num) || num < 1 ? String(DEFAULT_RECONNECT_INITIAL_DELAY) : String(num),
              );
            }}
            placeholder={String(DEFAULT_RECONNECT_INITIAL_DELAY)}
            className="mt-1"
          />
          <p className="text-[11px] text-muted-foreground mt-0.5">{t('settings.reconnectInitialDelayHint')}</p>
        </div>

        <div>
          <Label>{t('settings.reconnectMaxDelay')}</Label>
          <Input
            type="text"
            inputMode="numeric"
            value={form.reconnectMaxDelay || ''}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, '');
              const num = parseInt(v, 10);
              updateField(
                'reconnectMaxDelay',
                isNaN(num) || num < 1 ? String(DEFAULT_RECONNECT_MAX_DELAY) : String(num),
              );
            }}
            placeholder={String(DEFAULT_RECONNECT_MAX_DELAY)}
            className="mt-1"
          />
          <p className="text-[11px] text-muted-foreground mt-0.5">{t('settings.reconnectMaxDelayHint')}</p>
        </div>
      </CardContent>
    </Card>
  );
}
