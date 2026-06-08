import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock } from 'lucide-react';
import { useTerminalTabs } from '@/contexts/TerminalTabsContext';
import type { HostConfig } from '@/apis/types/hosts';
import type { KeyEntry } from '@/apis/types/keys';
import { buildSshConfig } from '@/lib/utils';
import { fetchHostsAndKeys } from '@/apis/utils/hosts';
import { saveHost } from '@/apis/api/hosts';
import { sshTestConnect } from '@/apis/api/ssh';
import { resolvePrivateKeyPath } from '@/apis/utils/keys';
import { useNotify } from '@/hooks/use-notify';

export default function QuickConnect() {
  const { t } = useTranslation();
  const { convertTabToTerminal, activeTabId } = useTerminalTabs();
  const { notifyError } = useNotify();
  const [hosts, setHosts] = useState<HostConfig[]>([]);
  const [keys, setKeys] = useState<KeyEntry[]>([]);
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

  const recentHosts = useMemo(
    () =>
      hosts.filter((h) => h.last_connected_at).sort((a, b) => (b.last_connected_at ?? 0) - (a.last_connected_at ?? 0)),
    [hosts],
  );

  const handleDoubleClick = async (host: HostConfig) => {
    try {
      const privateKeyPath = await resolvePrivateKeyPath(host, keys);
      const config = buildSshConfig({
        authMethod: host.auth_method,
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
      const now = Date.now();
      await saveHost({ host: { ...host, last_connected_at: now } });
      setHosts((prev) => prev.map((h) => (h.id === host.id ? { ...h, last_connected_at: now } : h)));
    } catch (e) {
      notifyError(e);
    }
  };

  const handleClear = async () => {
    try {
      for (const h of recentHosts) {
        await saveHost({ host: { ...h, last_connected_at: null } });
      }
      setHosts((prev) => prev.map((h) => ({ ...h, last_connected_at: null })));
    } catch (e) {
      notifyError(e);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-0 p-8">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-foreground">{t('quickConnect.title')}</h2>
          {recentHosts.length > 0 && (
            <button
              onClick={handleClear}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              {t('quickConnect.clear')}
            </button>
          )}
        </div>

        {recentHosts.length === 0 ? (
          <p className="text-center text-muted-foreground text-xs py-12">{t('quickConnect.empty')}</p>
        ) : (
          <div className="space-y-1">
            {recentHosts.map((host) => (
              <div
                key={host.id}
                onDoubleClick={() => handleDoubleClick(host)}
                className="flex items-center gap-3 h-10 px-4 rounded-lg border border-border hover:bg-muted transition-colors cursor-pointer"
              >
                <Clock size={14} className="text-muted-foreground flex-shrink-0" />
                <span className="text-sm text-foreground flex-1 truncate">{host.name}</span>
                <span className="text-xs text-muted-foreground">
                  {host.username}@{host.hostname}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
