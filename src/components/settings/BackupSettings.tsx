import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { backupData, restoreData } from '@/services/backupService';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNotify } from '@/hooks/use-notify';

export function BackupSettings() {
  const { t } = useTranslation();
  const { notifyError } = useNotify();
  const [backupLoading, setBackupLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function handleBackup() {
    setBackupLoading(true);
    setStatus(null);
    try {
      const { save } = await import('@tauri-apps/plugin-dialog');
      const path = await save({
        defaultPath: `vibeshell-backup-${new Date().toISOString().slice(0, 10)}.zip`,
        filters: [{ name: 'ZIP', extensions: ['zip'] }],
      });
      if (!path) {
        setBackupLoading(false);
        return;
      }
      await backupData({ destination: path });
      setStatus(t('settings.backupSuccess'));
    } catch (e) {
      notifyError(e);
    } finally {
      setBackupLoading(false);
    }
  }

  async function handleRestore() {
    setRestoreLoading(true);
    setStatus(null);
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const path = await open({
        filters: [{ name: 'ZIP', extensions: ['zip'] }],
        multiple: false,
      });
      if (!path) {
        setRestoreLoading(false);
        return;
      }
      await restoreData({ source: path });
      setStatus(t('settings.restoreSuccess'));
    } catch (e) {
      notifyError(e);
    } finally {
      setRestoreLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.backup')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground leading-relaxed">{t('settings.backupDesc')}</p>

        <div className="flex items-center gap-3">
          <Button size="sm" onClick={handleBackup} disabled={backupLoading}>
            {backupLoading ? t('common.loading') : t('settings.backupAction')}
          </Button>
          <Button variant="secondary" size="sm" onClick={handleRestore} disabled={restoreLoading}>
            {restoreLoading ? t('common.loading') : t('settings.restoreAction')}
          </Button>
        </div>

        {status && <p className="text-xs text-primary">{status}</p>}
      </CardContent>
    </Card>
  );
}
