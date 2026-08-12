import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useNProgress } from '@/hooks/use-nprogress';
import { proxyTestConnect } from '@/services/sshService';
import type { ProxyConfig } from '@/types/config';

interface ProxySettingsProps {
  defaults: ProxyConfig;
  onSave: (values: ProxyConfig) => void;
}

/** 代理设置 — 支持 SOCKS5 代理，可选匿名或用户名密码认证 */
export function ProxySettings({ defaults, onSave }: ProxySettingsProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { start: nprogressStart, done: nprogressDone } = useNProgress();
  const [form, setForm] = useState<ProxyConfig>(defaults);
  const [hasChanges, setHasChanges] = useState(false);
  const [testing, setTesting] = useState(false);
  const defaultsRef = useRef(defaults);

  // Sync from props when defaults change (initial load)
  useEffect(() => {
    setForm(defaults);
    setHasChanges(false);
    defaultsRef.current = defaults;
  }, [defaults]);

  const updateField = (patch: Partial<ProxyConfig>) => {
    const updated = { ...form, ...patch };
    setForm(updated);
    setHasChanges(JSON.stringify(updated) !== JSON.stringify(defaultsRef.current));
  };

  const handleSave = () => {
    onSave(form);
    defaultsRef.current = { ...form };
    setHasChanges(false);
  };

  const handleReset = () => {
    setForm(defaultsRef.current);
    setHasChanges(false);
  };

  /** 测试当前代理配置是否可用 */
  const handleTest = async () => {
    setTesting(true);
    nprogressStart();
    try {
      const msg = await proxyTestConnect({
        hostname: form.host,
        port: form.port,
        username: form.username,
        password: form.password,
      });
      toast(msg, { type: 'success' });
    } catch (e) {
      const msg = typeof e === 'string' ? e : e instanceof Error ? e.message : String(e);
      toast(msg, { type: 'error' });
    } finally {
      setTesting(false);
      nprogressDone();
    }
  };

  const enabled = form.enabled;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{t('settings.proxy')}</span>
          {hasChanges && <span className="text-xs text-amber-500 font-normal">{t('settings.unsavedChanges')}</span>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-xs">{t('settings.proxyEnabled')}</Label>
          <Switch checked={form.enabled} onCheckedChange={(v) => updateField({ enabled: v })} />
        </div>

        {enabled && (
          <>
            <div className="flex items-start gap-2 rounded-md bg-muted/50 border border-border px-3 py-2">
              <span className="text-sm">💡</span>
              <span className="text-xs text-muted-foreground leading-relaxed">{t('settings.proxyTypeFixed')}</span>
            </div>

            <div className="grid grid-cols-4 gap-3">
              <div className="col-span-3">
                <Label>{t('settings.proxyHost')}</Label>
                <Input
                  type="text"
                  value={form.host}
                  onChange={(e) => updateField({ host: e.target.value })}
                  placeholder="127.0.0.1"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>{t('settings.proxyPort')}</Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  value={form.port || ''}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, '');
                    updateField({ port: v ? parseInt(v, 10) : 0 });
                  }}
                  placeholder="7897"
                  className="mt-1"
                />
              </div>
            </div>

            <div className="border-t border-border pt-4">
              <Label className="text-xs font-semibold text-foreground">{t('settings.proxyAuth')}</Label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t('settings.proxyUsername')}</Label>
                <Input
                  type="text"
                  value={form.username}
                  onChange={(e) => updateField({ username: e.target.value })}
                  placeholder={t('settings.proxyAuthOptional')}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>{t('settings.proxyPassword')}</Label>
                <Input
                  type="password"
                  value={form.password}
                  onChange={(e) => updateField({ password: e.target.value })}
                  placeholder={t('settings.proxyAuthOptional')}
                  className="mt-1"
                />
              </div>
            </div>
          </>
        )}

        {/* 底部按钮：始终显示（未启用时也要能保存“关闭”状态）。
            测试按钮仅在启用代理时才有意义。 */}
        <div className="flex gap-2 justify-end border-t border-border pt-4">
          {enabled && (
            <Button variant="outline" size="sm" onClick={handleTest} disabled={testing || !form.host || !form.port}>
              {testing ? t('settings.proxyTesting') : t('settings.proxyTest')}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleReset} disabled={!hasChanges}>
            {t('settings.reset')}
          </Button>
          <Button size="sm" onClick={handleSave} disabled={!hasChanges}>
            {t('settings.saveSettings')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
