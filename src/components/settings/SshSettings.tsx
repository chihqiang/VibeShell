import { useTranslation } from 'react-i18next';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

interface SshSettingsProps {
  defaults: Record<string, string>;
  onSave: (key: string, value: string) => void;
}

export function SshSettings({ defaults, onSave }: SshSettingsProps) {
  const { t } = useTranslation();

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
            value={defaults.hostname || ''}
            onChange={(e) => onSave('hostname', e.target.value)}
            placeholder="192.168.1.1"
            className="mt-1"
          />
        </div>
        <div>
          <Label>{t('settings.defaultUsername')}</Label>
          <Input
            type="text"
            value={defaults.username || ''}
            onChange={(e) => onSave('username', e.target.value)}
            placeholder="root"
            className="mt-1"
          />
        </div>
        <div>
          <Label>{t('settings.defaultPort')}</Label>
          <Input
            type="text"
            inputMode="numeric"
            value={defaults.port && defaults.port !== '0' ? defaults.port : ''}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, '');
              onSave('port', v || '0');
            }}
            placeholder="22"
            className="mt-1"
          />
        </div>
        <div>
          <Label>{t('settings.monitorInterval')}</Label>
          <Input
            type="text"
            inputMode="numeric"
            value={defaults.monitorInterval || ''}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, '');
              const num = parseInt(v, 10);
              onSave('monitorInterval', isNaN(num) || num < 1 ? '4' : String(num));
            }}
            placeholder="4"
            className="mt-1"
          />
          <p className="text-[10px] text-muted-foreground mt-0.5">{t('settings.monitorIntervalHint')}</p>
        </div>
        <div>
          <Label>{t('settings.heartbeatInterval')}</Label>
          <Input
            type="text"
            inputMode="numeric"
            value={defaults.heartbeatInterval || ''}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, '');
              const num = parseInt(v, 10);
              onSave('heartbeatInterval', isNaN(num) || num < 1 ? '10' : String(num));
            }}
            placeholder="10"
            className="mt-1"
          />
          <p className="text-[10px] text-muted-foreground mt-0.5">{t('settings.heartbeatIntervalHint')}</p>
        </div>

        <div className="border-t border-border pt-4">
          <Label className="text-xs font-semibold text-foreground">{t('settings.reconnectTitle')}</Label>
        </div>

        <div className="flex items-center justify-between">
          <Label className="text-xs">{t('settings.reconnectEnabled')}</Label>
          <Switch
            checked={defaults.reconnectEnabled !== 'false'}
            onCheckedChange={(v) => onSave('reconnectEnabled', String(v))}
          />
        </div>

        <div>
          <Label>{t('settings.reconnectMaxRetries')}</Label>
          <Input
            type="text"
            inputMode="numeric"
            value={defaults.reconnectMaxRetries || ''}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, '');
              const num = parseInt(v, 10);
              onSave('reconnectMaxRetries', isNaN(num) || num < 1 ? '10' : String(num));
            }}
            placeholder="10"
            className="mt-1"
          />
        </div>

        <div>
          <Label>{t('settings.reconnectInitialDelay')}</Label>
          <Input
            type="text"
            inputMode="numeric"
            value={defaults.reconnectInitialDelay || ''}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, '');
              const num = parseInt(v, 10);
              onSave('reconnectInitialDelay', isNaN(num) || num < 1 ? '1' : String(num));
            }}
            placeholder="1"
            className="mt-1"
          />
          <p className="text-[10px] text-muted-foreground mt-0.5">{t('settings.reconnectInitialDelayHint')}</p>
        </div>

        <div>
          <Label>{t('settings.reconnectMaxDelay')}</Label>
          <Input
            type="text"
            inputMode="numeric"
            value={defaults.reconnectMaxDelay || ''}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, '');
              const num = parseInt(v, 10);
              onSave('reconnectMaxDelay', isNaN(num) || num < 1 ? '30' : String(num));
            }}
            placeholder="30"
            className="mt-1"
          />
          <p className="text-[10px] text-muted-foreground mt-0.5">{t('settings.reconnectMaxDelayHint')}</p>
        </div>
      </CardContent>
    </Card>
  );
}
