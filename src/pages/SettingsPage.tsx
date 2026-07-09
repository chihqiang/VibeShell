import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getSshDefaults, saveSshDefaults } from '@/storage/config';
import { Toast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { GeneralSettings } from '@/components/settings/GeneralSettings';
import { SshSettings } from '@/components/settings/SshSettings';

import { BackupSettings } from '@/components/settings/BackupSettings';
import { AboutSettings } from '@/components/settings/AboutSettings';

const settingsSections = ['general', 'ssh', 'backup', 'about'] as const;
type Section = (typeof settingsSections)[number];

export default function SettingsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [active, setActive] = useState<Section>('general');
  const [toastCount, setToastCount] = useState(0);
  const triggerToast = () => setToastCount((c) => c + 1);

  const [sshDefaults, setSshDefaults] = useState<Record<string, string>>({});

  // Load SSH defaults from backend on mount
  useEffect(() => {
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
  }, []);

  const handleSshSave = (key: string, value: string) => {
    const updated = { ...sshDefaults, [key]: value };
    setSshDefaults(updated);
    // Persist to backend
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

  const sectionContent: Record<Section, React.ReactNode> = {
    general: <GeneralSettings onSaved={triggerToast} />,
    ssh: <SshSettings defaults={sshDefaults} onSave={handleSshSave} />,
    backup: <BackupSettings />,
    about: <AboutSettings />,
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background">
      <div className="flex items-center gap-3 px-5 py-3 border-b border-border">
        <Button variant="ghost" size="icon-sm" onClick={() => navigate('/')}>
          <ArrowLeft size={16} />
        </Button>
        <h2 className="text-sm font-semibold text-foreground">{t('settings.title')}</h2>
      </div>
      <div className="flex-1 flex min-h-0">
        <nav className="flex-shrink-0 w-44 border-r border-border p-2 space-y-0.5">
          {settingsSections.map((s) => (
            <button
              key={s}
              onClick={() => setActive(s)}
              className={cn(
                'w-full h-8 px-3 text-xs rounded-lg text-left transition-colors cursor-pointer',
                active === s
                  ? 'bg-primary/10 text-primary font-medium border-l-2 border-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 border-l-2 border-transparent',
              )}
            >
              {sectionLabel[s]}
            </button>
          ))}
        </nav>
        <div className="flex-1 p-5 overflow-y-auto max-w-2xl space-y-4">{sectionContent[active]}</div>
      </div>
      <Toast message={t('common.saved')} trigger={toastCount} />
    </div>
  );
}
