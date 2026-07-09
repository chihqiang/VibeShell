import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowRight,
  Loader2,
  Terminal,
  Server,
  Clock,
  KeyRound,
  Zap,
  Lock,
  User,
  Globe,
  ChevronRight,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTerminalTabs } from '@/contexts/TerminalTabsContext';
import type { HostConfig } from '@/apis/types/hosts';
import type { KeyEntry } from '@/apis/types/keys';
import { hostToConnectConfig, cn, parseSshCommand } from '@/lib/utils';
import { fetchHostsAndKeys } from '@/apis/utils/hosts';
import { saveHost } from '@/apis/api/hosts';
import { sshTestConnect } from '@/apis/api/ssh';
import { useNotify } from '@/hooks/use-notify';
import { getSshDefaults } from '@/storage/config';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

function formatRelativeTime(
  ts: number | null | undefined,
  t: (k: string, o?: Record<string, unknown>) => string,
): string {
  if (!ts) return '';
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t('dashboard.justNow', { defaultValue: '刚刚' });
  if (mins < 60) return t('dashboard.minutesAgo', { count: mins, defaultValue: `${mins} 分钟前` });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t('dashboard.hoursAgo', { count: hours, defaultValue: `${hours} 小时前` });
  const days = Math.floor(hours / 24);
  return t('dashboard.daysAgo', { count: days, defaultValue: `${days} 天前` });
}

export default function QuickConnect() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { convertTabToTerminal, activeTabId, tabs } = useTerminalTabs();
  const { notify, notifyError } = useNotify();
  const [hosts, setHosts] = useState<HostConfig[]>([]);
  const [keys, setKeys] = useState<KeyEntry[]>([]);

  const [quickInput, setQuickInput] = useState('');
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

  const recentHosts = useMemo(
    () =>
      hosts
        .filter((h) => h.last_connected_at)
        .sort((a, b) => (b.last_connected_at ?? 0) - (a.last_connected_at ?? 0))
        .slice(0, 8),
    [hosts],
  );

  const connectedHostIds = useMemo(() => {
    const ids = new Set<string>();
    for (const tab of tabs) {
      if (tab.type === 'terminal' && tab.host?.id) ids.add(tab.host.id);
    }
    return ids;
  }, [tabs]);

  const parsed = useMemo(() => parseSshCommand(quickInput), [quickInput]);
  const canConnect = !!parsed?.hostname && !connecting;
  const showPreview = quickInput.trim().length > 0 && parsed?.hostname;

  const handleQuickConnect = async () => {
    if (!parsed?.hostname || connecting) return;

    let username = parsed.username;
    if (!username) {
      const defaults = await getSshDefaults();
      username = defaults.username;
    }
    if (!username) {
      notifyError(new Error(t('dashboard.usernameRequired', { defaultValue: '请输入用户名，格式: user@host' })));
      return;
    }

    setConnecting(true);
    try {
      const config = {
        hostname: parsed.hostname,
        port: parsed.port || 22,
        username,
        password: parsed.password,
        privateKeyPath: parsed.privateKeyPath,
      };
      await sshTestConnect(config);
      if (activeTabId) {
        convertTabToTerminal(activeTabId, config);
      }
    } catch (e) {
      notifyError(e);
    } finally {
      setConnecting(false);
    }
  };

  const handleConnectSaved = async (host: HostConfig) => {
    try {
      const config = await hostToConnectConfig(host, keys);
      await sshTestConnect(config);
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

  const handleClearRecent = async () => {
    try {
      for (const h of recentHosts) {
        await saveHost({ host: { ...h, last_connected_at: null } });
      }
      setHosts((prev) => prev.map((h) => ({ ...h, last_connected_at: null })));
      notify(t('dashboard.recentCleared', { defaultValue: '已清空最近连接' }));
    } catch (e) {
      notifyError(e);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
      <div className="flex-1 flex flex-col items-center px-6 py-8">
        <div className="w-full max-w-2xl space-y-8">
          {/* Hero */}
          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-1">
              <Zap size={26} className="text-primary" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">
              {t('dashboard.welcome', { defaultValue: '快速连接' })}
            </h2>
            <p className="text-xs text-muted-foreground">
              {t('dashboard.subtitleNew', { defaultValue: '输入 SSH 命令直接连接，支持密码或密钥' })}
            </p>
          </div>

          {/* Quick Connect Input */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Input
                value={quickInput}
                onChange={(e) => setQuickInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && canConnect && handleQuickConnect()}
                placeholder={t('dashboard.placeholder', {
                  defaultValue: 'ssh root@192.168.1.1  或  root:密码@192.168.1.1:22',
                })}
                className="flex-1 h-10 text-sm font-mono"
                autoFocus
              />
              <Button className="h-10 gap-1.5 px-5" disabled={!canConnect} onClick={handleQuickConnect}>
                {connecting ? <Loader2 size={15} className="animate-spin" /> : <ArrowRight size={15} />}
                {connecting ? t('connection.connecting') : t('connection.connect')}
              </Button>
            </div>

            {/* Live parsed preview */}
            {showPreview && parsed && (
              <div className="flex flex-wrap items-center gap-1.5 px-1 animate-fade-in">
                <ParsedChip
                  icon={<User size={10} />}
                  label={parsed.username || t('dashboard.defaultUser', { defaultValue: '默认' })}
                />
                <ChevronRight size={10} className="text-muted-foreground/40" />
                <ParsedChip icon={<Globe size={10} />} label={`${parsed.hostname}:${parsed.port}`} />
                {parsed.password && <ParsedChip icon={<Lock size={10} />} label="••••••" highlight />}
                {parsed.privateKeyPath && (
                  <ParsedChip icon={<KeyRound size={10} />} label={parsed.privateKeyPath} highlight />
                )}
              </div>
            )}

            {/* Format hints */}
            {!showPreview && (
              <div className="space-y-1 px-1">
                <p className="text-[11px] text-muted-foreground/70">
                  {t('dashboard.formatHint1', { defaultValue: '密码连接：root:password@192.168.1.1:22' })}
                </p>
                <p className="text-[11px] text-muted-foreground/70">
                  {t('dashboard.formatHint2', { defaultValue: '密钥连接：ssh -i ~/.ssh/id_rsa root@192.168.1.1' })}
                </p>
                <p className="text-[11px] text-muted-foreground/70">
                  {t('dashboard.formatHint3', { defaultValue: '带端口：ssh -p 2222 root@192.168.1.1' })}
                </p>
              </div>
            )}
          </div>

          {/* Recent Connections */}
          {recentHosts.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Clock size={13} />
                  {t('quickConnect.recent')}
                </h3>
                <button
                  onClick={handleClearRecent}
                  className="text-[11px] text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
                >
                  {t('quickConnect.clear')}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {recentHosts.map((host) => {
                  const isConnected = connectedHostIds.has(host.id);
                  return (
                    <div
                      key={host.id}
                      onClick={() => handleConnectSaved(host)}
                      className={cn(
                        'group flex items-center gap-3 px-4 py-3 rounded-xl border transition-all cursor-pointer',
                        'border-border hover:border-primary/40 hover:bg-muted/50 hover:shadow-sm',
                      )}
                    >
                      <div
                        className={cn(
                          'flex items-center justify-center w-9 h-9 rounded-lg flex-shrink-0 transition-colors',
                          isConnected ? 'bg-green-500/15' : 'bg-muted group-hover:bg-primary/10',
                        )}
                      >
                        <Server
                          size={16}
                          className={cn(
                            isConnected ? 'text-green-500' : 'text-muted-foreground group-hover:text-primary',
                          )}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium text-foreground truncate">{host.name}</span>
                          {isConnected && <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />}
                        </div>
                        <span className="text-[11px] text-muted-foreground/70 truncate block font-mono">
                          {host.username}@{host.hostname}:{host.port}
                        </span>
                        <span className="text-[10px] text-muted-foreground/50">
                          {formatRelativeTime(host.last_connected_at, t)}
                        </span>
                      </div>
                      <div className="flex items-center justify-center w-8 h-8 rounded-lg text-primary bg-primary/10 opacity-50 group-hover:opacity-100 group-hover:bg-primary/15 transition-all flex-shrink-0">
                        <Terminal size={15} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Empty state */
            <div className="flex flex-col items-center gap-4 pt-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-muted/50">
                <Server size={28} className="text-muted-foreground/30" />
              </div>
              <p className="text-center text-xs text-muted-foreground max-w-xs">
                {t('dashboard.emptyHint', {
                  defaultValue: '还没有最近连接。在左侧主机列表中添加主机，或在上方直接输入地址快速连接。',
                })}
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="xs" className="gap-1.5" onClick={() => navigate('/hosts')}>
                  <Server size={13} />
                  {t('sidebar.hostManagement')}
                </Button>
                <Button variant="ghost" size="xs" className="gap-1.5" onClick={() => navigate('/keys')}>
                  <KeyRound size={13} />
                  {t('sidebar.keyManagement')}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Small chip for parsed preview ---

function ParsedChip({ icon, label, highlight }: { icon: React.ReactNode; label: string; highlight?: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 h-5 px-2 rounded text-[11px] font-mono',
        highlight ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-muted text-muted-foreground',
      )}
    >
      {icon}
      <span className="truncate max-w-32">{label}</span>
    </span>
  );
}
