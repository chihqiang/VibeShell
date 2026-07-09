import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/utils';
import { getSshDefaults, saveSshDefaults } from '@/services/configService';
import { Toast } from '@/components/ui/toast';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { GeneralSettings } from './GeneralSettings';
import { SshSettings } from './SshSettings';
import { BackupSettings } from './BackupSettings';
import { AboutSettings } from './AboutSettings';

const settingsSections = ['general', 'ssh', 'backup', 'about'] as const;
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
      });
    });
  }, [open]);

  const handleSshSave = (key: string, value: string) => {
    const updated = { ...sshDefaults, [key]: value };
    setSshDefaults(updated);
    saveSshDefaults({
      hostname: updated.hostname || '',
      username: updated.username || '',
      port: parseInt(updated.port || '22', 10),
      monitorInterval: parseInt(updated.monitorInterval || '4', 10),
      heartbeatInterval: parseInt(updated.heartbeatInterval || '10', 10),
      reconnectEnabled: updated.reconnectEnabled !== 'false',
      reconnectMaxRetries: parseInt(updated.reconnectMaxRetries || '10', 10),
      reconnectInitialDelay: parseInt(updated.reconnectInitialDelay || '1', 10),
      reconnectMaxDelay: parseInt(updated.reconnectMaxDelay || '30', 10),
    });
    triggerToast();
  };

  const sectionLabel: Record<Section, string> = {
    general: t('settings.general'),
    ssh: t('settings.ssh'),
    backup: t('settings.backup'),
    about: t('settings.about'),
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl p-0 gap-0 overflow-hidden">
          <DialogTitle className="sr-only">{t('settings.title')}</DialogTitle>
          <div className="flex h-[480px]">
            {/* 左侧导航 */}
            <nav className="flex-shrink-0 w-36 border-r border-border py-3 space-y-0.5 bg-muted/30">
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
              {active === 'backup' && <BackupSettings />}
              {active === 'about' && <AboutSettings />}
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <Toast message={t('common.saved')} trigger={toastCount} />
    </>
  );
}
