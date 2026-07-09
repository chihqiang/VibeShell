import { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { getVersion } from '@tauri-apps/api/app';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import * as os from '@tauri-apps/plugin-os';
import { ExternalLink, RefreshCw, Loader2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

const CHECK_TIMEOUT_MS = 30_000;
const DOWNLOAD_TIMEOUT_MS = 300_000;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

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
  const [progress, setProgress] = useState<number | null>(null);
  const [statusText, setStatusText] = useState('');
  const progressRef = useRef(0);

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
    setProgress(null);
    progressRef.current = 0;
    setStatusText(t('settings.updateChecking'));

    try {
      // Retry check up to MAX_RETRIES times to handle transient network failures
      let update: Awaited<ReturnType<typeof check>> = null;
      let lastError: unknown = null;

      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          setStatusText(
            attempt > 1
              ? t('settings.updateRetrying', { attempt, max: MAX_RETRIES })
              : t('settings.updateChecking'),
          );
          update = await check({ timeout: CHECK_TIMEOUT_MS });
          break;
        } catch (err) {
          lastError = err;
          if (attempt < MAX_RETRIES) {
            await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
          }
        }
      }

      if (!update) {
        const errMsg = lastError instanceof Error ? lastError.message : String(lastError);
        toast(t('settings.updateCheckFailed') + ': ' + errMsg, { type: 'error', duration: 8000 });
        return;
      }

      // update is non-null means an update is available
      setStatusText(t('settings.updateDownloading'));
      setProgress(0);

      let contentLength = 0;
      let downloaded = 0;

      await update.download(
        (event) => {
          if (event.event === 'Started' && event.data.contentLength) {
            contentLength = event.data.contentLength;
          } else if (event.event === 'Progress') {
            downloaded += event.data.chunkLength;
            if (contentLength > 0) {
              const pct = Math.min(100, Math.round((downloaded / contentLength) * 100));
              if (pct > progressRef.current) {
                progressRef.current = pct;
                setProgress(pct);
              }
            }
          } else if (event.event === 'Finished') {
            setProgress(100);
          }
        },
        { timeout: DOWNLOAD_TIMEOUT_MS },
      );

      toast(t('settings.updateInstalling'));
      setStatusText(t('settings.updateInstalling'));
      await update.install();
      toast(t('settings.updateRelaunch'));
      await relaunch();
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      toast(t('settings.updateError') + ': ' + errMsg, { type: 'error', duration: 8000 });
    } finally {
      setUpdating(false);
      setProgress(null);
      setStatusText('');
      progressRef.current = 0;
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
            <span className="text-xs text-muted-foreground">VibeShell v{info.appVersion || '...'}</span>
            <div className="flex items-center gap-2">
              <a
                href="https://github.com/chihqiang/VibeShell"
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
          {updating && (
            <div className="mt-3 space-y-1.5">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{statusText}</span>
                {progress !== null && <span>{progress}%</span>}
              </div>
              {progress !== null ? (
                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              ) : (
                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div className="h-full w-1/3 bg-primary animate-pulse" />
                </div>
              )}
            </div>
          )}
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
