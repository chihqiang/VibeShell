import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getVersion } from '@tauri-apps/api/app';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import * as os from '@tauri-apps/plugin-os';
import { ExternalLink, RefreshCw, Loader2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

export function AboutSettings() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [info, setInfo] = useState({
    platform: '',
    version: '',
    arch: '',
    hostname: '',
    appVersion: '',
  });
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    getVersion().then((v) => setInfo((prev) => ({ ...prev, appVersion: v })));
    setInfo((prev) => ({
      ...prev,
      platform: os.platform(),
      version: os.version(),
      arch: os.arch(),
    }));
    os.hostname().then((h) => {
      setInfo((prev) => ({ ...prev, hostname: h || '' }));
    });
  }, []);

  async function handleCheckUpdate() {
    setUpdating(true);
    try {
      const update = await check();
      if (!update?.available) {
        toast(t('settings.updateNotAvailable'));
        return;
      }
      toast(t('settings.updateDownloading'));
      await update.download();
      toast(t('settings.updateInstalling'));
      await update.install();
      toast(t('settings.updateRelaunch'));
      await relaunch();
    } catch {
      toast(t('settings.updateError'));
    } finally {
      setUpdating(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.aboutAppInfo')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4">
            <span className="text-xs text-muted-foreground">vibeshell v{info.appVersion || '...'}</span>
            <div className="flex items-center gap-2">
              <a
                href="https://github.com/chihqiang/vibeshell"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 h-7 px-3 text-xs rounded-md border border-input bg-background text-foreground hover:bg-muted transition-colors"
              >
                <ExternalLink size={14} />
                GitHub
              </a>
              <button
                onClick={handleCheckUpdate}
                disabled={updating}
                className="inline-flex items-center gap-1.5 h-7 px-3 text-xs rounded-md border border-input bg-background text-foreground hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {updating ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                {t('settings.aboutCheckUpdate')}
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.aboutSysInfo')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <InfoRow label={t('settings.aboutPlatform')} value={info.platform} />
          <InfoRow label={t('settings.aboutVersion')} value={info.version} />
          <InfoRow label={t('settings.aboutArch')} value={info.arch} />
          {info.hostname && <InfoRow label={t('settings.aboutHostname')} value={info.hostname} />}
        </CardContent>
      </Card>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-medium">{value}</span>
    </div>
  );
}
