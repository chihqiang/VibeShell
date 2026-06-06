import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2, Terminal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTerminalTabs } from '@/contexts/TerminalTabsContext';
import HostForm from '@/components/host/HostForm';
import type { HostFormData, AuthMethod } from '@/lib/types';
import type { HostConfig } from '@/apis/types/hosts';
import type { KeyEntry } from '@/apis/types/keys';
import { buildSshConfig } from '@/lib/utils';
import { fetchHostsAndKeys } from '@/apis/utils/hosts';
import { sshTestConnect } from '@/apis/api/ssh';
import { resolvePrivateKeyPath } from '@/apis/utils/keys';
import { getSshDefaults } from '@/storage/config';
import { useNotify } from '@/hooks/use-notify';

export default function QuickConnect() {
  const { t } = useTranslation();
  const { convertTabToTerminal, activeTabId } = useTerminalTabs();
  const { notifyError } = useNotify();
  const [hosts, setHosts] = useState<HostConfig[]>([]);
  const [keys, setKeys] = useState<KeyEntry[]>([]);
  const [form, setForm] = useState<HostFormData>({
    hostname: '',
    port: 22,
    username: '',
    authMethod: 'password',
    password: '',
    privateKeyPath: '',
    keyPassphrase: '',
  });

  // Fetch SSH defaults from backend and pre-fill form
  useEffect(() => {
    getSshDefaults().then((d) => {
      setForm((prev) => ({
        ...prev,
        hostname: d.hostname,
        port: d.port,
        username: d.username,
      }));
    });
  }, []);

  const clearForm = () => {
    getSshDefaults().then((d) => {
      setForm({
        hostname: d.hostname,
        port: d.port,
        username: d.username,
        authMethod: 'password',
        password: '',
        privateKeyPath: '',
        keyPassphrase: '',
      });
    });
  };
  const [connecting, setConnecting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const { hosts: h, keys: k } = await fetchHostsAndKeys();
      setHosts(h);
      setKeys(k);
    } catch (e) {
      notifyError(e);
    }
  }, [notifyError]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleConnect = async () => {
    if (!form.hostname || !form.username) return;
    setConnecting(true);
    try {
      const config = buildSshConfig({
        authMethod: form.authMethod,
        hostname: form.hostname,
        port: form.port,
        username: form.username,
        password: form.password || null,
        keyPassphrase: form.keyPassphrase || null,
        privateKeyPath: form.privateKeyPath || null,
      });
      await sshTestConnect({
        hostname: config.hostname,
        port: config.port,
        username: config.username,
        password: config.password,
        privateKeyPath: config.private_key_path,
      });
      if (activeTabId) {
        convertTabToTerminal(activeTabId, config);
      }
    } catch (e) {
      notifyError(e);
    } finally {
      setConnecting(false);
    }
  };

  const handleDoubleClick = async (host: HostConfig) => {
    setConnecting(true);
    try {
      const privateKeyPath = await resolvePrivateKeyPath(host, keys);
      const config = buildSshConfig({
        authMethod: host.auth_method as AuthMethod,
        hostname: host.hostname,
        port: host.port,
        username: host.username,
        password: host.auth_method === 'password' ? host.password || null : null,
        keyPassphrase: host.auth_method === 'key' ? host.password || null : null,
        privateKeyPath,
      });
      await sshTestConnect({
        hostname: config.hostname,
        port: config.port,
        username: config.username,
        password: config.password,
        privateKeyPath: config.private_key_path,
      });
      if (activeTabId) {
        convertTabToTerminal(activeTabId, config, host);
      }
    } catch (e) {
      notifyError(e);
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 p-5 gap-4">
      <div className="flex items-center gap-3">
        <h2 className="text-sm font-semibold text-foreground">{t('quickConnect.title')}</h2>
        <Button variant="outline" size="sm" className="gap-1 ml-auto" onClick={clearForm}>
          <Trash2 size={12} />
          {t('quickConnect.clear')}
        </Button>
      </div>

      <div className="flex items-end gap-2 justify-center">
        <HostForm value={form} onChange={setForm} keys={keys} compact />

        <div className="flex flex-col gap-1 h-[52px] justify-end">
          <Button size="sm" className="h-8 gap-1" onClick={handleConnect} disabled={connecting}>
            <Terminal size={12} />
            {connecting ? t('connection.connecting') : t('quickConnect.connect')}
          </Button>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        {hosts.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-xs">
            {t('quickConnect.empty')}
          </div>
        ) : (
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-secondary/10 border-b border-border text-muted-foreground">
                <th className="text-left font-medium px-3 py-1.5">{t('quickConnect.tableName')}</th>
                <th className="text-left font-medium px-3 py-1.5">{t('quickConnect.tableAccount')}</th>
              </tr>
            </thead>
            <tbody>
              {hosts.map((host) => (
                <tr
                  key={host.id}
                  onDoubleClick={() => handleDoubleClick(host)}
                  className="hover:bg-muted cursor-pointer transition-colors h-8"
                >
                  <td className="px-3 text-foreground truncate max-w-0">
                    <span className="flex items-center gap-2">
                      <Terminal size={12} className="text-primary flex-shrink-0" />
                      {host.name}
                    </span>
                  </td>
                  <td className="px-3 text-muted-foreground">
                    {host.username}@{host.hostname}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
