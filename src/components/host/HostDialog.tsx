import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { saveHost } from '@/services/hostService';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { HostForm } from '@/components/host';
import type { HostConfig } from '@/types/host';
import type { KeyEntry } from '@/types/key';
import { getSshDefaults, getProxyConfig } from '@/services/configService';
import { useNotify } from '@/hooks/use-notify';
import { sshTestConnect } from '@/services/sshService';

import { DEFAULT_SSH_PORT } from '@/constants';
interface HostDialogProps {
  open: boolean;
  onClose: () => void;
  host?: HostConfig | null;
  keys: KeyEntry[];
}

export { type HostConfig };

export function HostDialog({ open, onClose, host, keys }: HostDialogProps) {
  const { t } = useTranslation();
  const { notify, notifyError } = useNotify();
  const editing = !!host;
  const [form, setForm] = useState<HostConfig>(() =>
    host
      ? { ...host, key_passphrase: host.key_passphrase || '' }
      : {
          id: '',
          name: '',
          hostname: '',
          port: DEFAULT_SSH_PORT,
          username: '',
          auth_method: 'password',
          password: '',
          key_id: '',
          key_passphrase: '',
          created_at: 0,
          updated_at: 0,
          last_connected_at: null,
        },
  );
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const portValid = form.port >= 1 && form.port <= 65535;

  async function handleTestConnect() {
    setTesting(true);
    try {
      const proxy = await getProxyConfig();
      const banner = await sshTestConnect({
        hostname: form.hostname,
        port: form.port || DEFAULT_SSH_PORT,
        username: form.username,
        password: form.auth_method === 'password' ? form.password || null : null,
        privateKeyPath: form.auth_method === 'key' ? form.key_id || null : null,
        proxy,
      });
      notify(`${t('connection.testConnectionSuccess')}: ${banner}`);
    } catch (e) {
      notifyError(e);
    } finally {
      setTesting(false);
    }
  }

  // Fetch SSH defaults and fill form when opening for new host
  useEffect(() => {
    if (open && !host) {
      getSshDefaults().then((d) => {
        setForm({
          id: '',
          name: '',
          hostname: d.hostname,
          port: d.port,
          username: d.username,
          auth_method: 'password',
          password: '',
          key_id: '',
          key_passphrase: '',
          created_at: 0,
          updated_at: 0,
          last_connected_at: null,
        });
      });
    }
  }, [open, host]);

  useEffect(() => {
    if (host) {
      setForm({ ...host, key_passphrase: host.key_passphrase || '' });
    }
  }, [host, keys, open]);

  function updateField<K extends keyof HostConfig>(key: K, v: HostConfig[K]) {
    setForm((prev) => ({ ...prev, [key]: v }));
  }

  const handleFormChange = (data: HostConfig) => {
    setForm(data);
  };

  async function handleSave() {
    setSaving(true);
    try {
      await saveHost({ host: form });
      notify(editing ? t('connection.hostUpdated') : t('connection.hostAdded'));
      onClose();
    } catch (e) {
      notifyError(e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) onClose();
        }}
      >
        <DialogContent className="w-[460px] sm:max-w-[460px] p-0">
          <DialogHeader>
            <DialogTitle>{editing ? t('sidebar.editHost') : t('sidebar.addHost')}</DialogTitle>
          </DialogHeader>

          <div className="px-5 py-4 space-y-4">
            <div>
              <Label>{t('connection.name')}</Label>
              <Input
                type="text"
                value={form.name}
                onChange={(e) => updateField('name', e.target.value)}
                placeholder={t('connection.namePlaceholder')}
              />
            </div>

            <HostForm value={form} onChange={handleFormChange} keys={keys} />
          </div>

          <DialogFooter>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleTestConnect}
                disabled={testing || !form.hostname || saving}
              >
                {testing ? t('common.loading') : t('connection.testConnection')}
              </Button>
              <div className="flex gap-2 ml-auto">
                <Button variant="outline" size="sm" onClick={onClose}>
                  {t('connection.cancel')}
                </Button>
                <Button
                  size="sm"
                  disabled={!form.name || !form.hostname || !form.username || !portValid || saving}
                  onClick={handleSave}
                >
                  {saving ? t('common.loading') : t('connection.save')}
                </Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
