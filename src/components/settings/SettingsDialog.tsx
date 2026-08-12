import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/utils';
import { getSshDefaults, saveSshDefaults, getProxyConfig, saveProxyConfig } from '@/services/configService';
import { Toast } from '@/components/ui/toast';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { GeneralSettings } from './GeneralSettings';
import { SshSettings } from './SshSettings';
import { ProxySettings } from './ProxySettings';
import { BackupSettings } from './BackupSettings';
import { AboutSettings } from './AboutSettings';
import type { ProxyConfig } from '@/types/config';
import {
  DEFAULT_SSH_PORT,
  DEFAULT_MONITOR_INTERVAL,
  DEFAULT_HEARTBEAT_INTERVAL,
  DEFAULT_RECONNECT_MAX_RETRIES,
} from '@/constants';

const settingsSections = ['general', 'ssh', 'proxy', 'backup', 'about'] as const;
type Section = (typeof settingsSections)[number];

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** 设置弹窗 — 以 Dialog 形式展示设置内容 */
export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { t } = useTranslation();
  const [active, setActive] = useState<Section>('general');
  const [toastCount, setToastCount] = useState(0);
  const triggerToast = () => setToastCount((c) => c + 1);
  const [sshDefaults, setSshDefaults] = useState<Record<string, string>>({});
  const [proxyDefaults, setProxyDefaults] = useState<ProxyConfig | null>(null);

  useEffect(() => {
    if (!open) return;
    getSshDefaults().then((d) => {
      setSshDefaults({
        hostname: d.hostname,
        username: d.username,
        port: String(d.port),
        monitorInterval: String(d.monitorInterval),
        heartbeatInterval: String(d.heartbeatInterval),
        reconnectEnabled: String(d.reconnectEnabled),
        reconnectMaxRetries: String(d.reconnectMaxRetries),
        reconnectInitialDelay: String(d.reconnectInitialDelay),
        reconnectMaxDelay: String(d.reconnectMaxDelay),
        idleTimeout: String(d.idleTimeout),
      });
    });
    getProxyConfig().then(setProxyDefaults);
  }, [open]);

  const handleSshSave = (values: Record<string, string>) => {
    setSshDefaults(values);
    saveSshDefaults({
      hostname: values.hostname || '',
      username: values.username || '',
      port: parseInt(values.port || String(DEFAULT_SSH_PORT), 10),
      monitorInterval: parseInt(values.monitorInterval || String(DEFAULT_MONITOR_INTERVAL), 10),
      heartbeatInterval: parseInt(values.heartbeatInterval || String(DEFAULT_HEARTBEAT_INTERVAL), 10),
      reconnectEnabled: values.reconnectEnabled !== 'false',
      reconnectMaxRetries: parseInt(values.reconnectMaxRetries || String(DEFAULT_RECONNECT_MAX_RETRIES), 10),
      reconnectInitialDelay: parseInt(values.reconnectInitialDelay || '1', 10),
      reconnectMaxDelay: parseInt(values.reconnectMaxDelay || '30', 10),
      idleTimeout: parseInt(values.idleTimeout || '300', 10),
    });
    triggerToast();
  };

  const handleProxySave = (values: ProxyConfig) => {
    setProxyDefaults(values);
    saveProxyConfig(values);
    triggerToast();
  };

  const sectionLabel: Record<Section, string> = {
    general: t('settings.general'),
    ssh: t('settings.ssh'),
    proxy: t('settings.proxy'),
    backup: t('settings.backup'),
    about: t('settings.about'),
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl p-0 gap-0 overflow-hidden">
          <DialogTitle className="sr-only">{t('settings.title')}</DialogTitle>
          <div className="flex h-120">
            {/* 左侧导航 */}
            <nav className="shrink-0 w-36 border-r border-border py-3 space-y-0.5 bg-muted/30">
              {settingsSections.map((s) => (
                <button
                  key={s}
                  onClick={() => setActive(s)}
                  className={cn(
                    'w-full h-8 px-3 text-xs rounded text-left transition-colors cursor-pointer',
                    active === s
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                  )}
                >
                  {sectionLabel[s]}
                </button>
              ))}
            </nav>
            {/* 右侧内容 */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3">
              {active === 'general' && <GeneralSettings onSaved={triggerToast} />}
              {active === 'ssh' && <SshSettings defaults={sshDefaults} onSave={handleSshSave} />}
              {active === 'proxy' && proxyDefaults && (
                <ProxySettings defaults={proxyDefaults} onSave={handleProxySave} />
              )}
              {active === 'backup' && <BackupSettings />}
              {active === 'about' && <AboutSettings />}
            </div>
          </div>
          {/* Toast 放在 Dialog 内部，关闭 Dialog 时随内容一起消失 */}
          <Toast message={t('common.saved')} trigger={toastCount} />
        </DialogContent>
      </Dialog>
    </>
  );
}
