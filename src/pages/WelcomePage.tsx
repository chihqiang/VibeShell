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
  Cpu,
  Monitor,
  HardDrive,
  Info,
} from 'lucide-react';
import { getVersion } from '@tauri-apps/api/app';
import * as os from '@tauri-apps/plugin-os';
import { useTerminalTabs } from '@/contexts/TerminalTabsContext';
import { useLayout } from '@/contexts/LayoutContext';
import type { HostConfig } from '@/types/host';
import type { KeyEntry } from '@/types/key';
import { hostToConnectConfig, cn, parseSshCommand } from '@/utils';
import { fetchHostsAndKeys, saveHost } from '@/services/hostService';
import { sshTestConnect } from '@/services/sshService';
import { useNotify } from '@/hooks/use-notify';
import { getSshDefaults } from '@/services/configService';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { APP_NAME, DEFAULT_SSH_PORT, DOM_EVENTS } from '@/constants';

function formatRelativeTime(
  ts: number | null | undefined,
  t: (k: string, o?: Record<string, unknown>) => string,
): string {
  if (!ts) return '';
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t('dashboard.justNow');
  if (mins < 60) return t('dashboard.minutesAgo', { count: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t('dashboard.hoursAgo', { count: hours });
  const days = Math.floor(hours / 24);
  return t('dashboard.daysAgo', { count: days });
}

/** 欢迎主页 — 快速连接 + 最近连接 + 系统信息 */
export function WelcomePage() {
  const { t } = useTranslation();
  const { convertTabToTerminal, activeTabId, tabs } = useTerminalTabs();
  const { setActiveView } = useLayout();
  const { notifyError } = useNotify();
  const [hosts, setHosts] = useState<HostConfig[]>([]);
  const [keys, setKeys] = useState<KeyEntry[]>([]);

  const [quickInput, setQuickInput] = useState('');
  const [connecting, setConnecting] = useState(false);

  const [sysInfo, setSysInfo] = useState({
    platform: '',
    version: '',
    arch: '',
    hostname: '',
    appVersion: '',
  });

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
    getVersion().then((v) => setSysInfo((prev) => ({ ...prev, appVersion: v })));
    setSysInfo((prev) => ({
      ...prev,
      platform: os.platform(),
      version: os.version(),
      arch: os.arch(),
    }));
    os.hostname().then((h) => setSysInfo((prev) => ({ ...prev, hostname: h || '' })));
    const reload = () => loadData();
    window.addEventListener(DOM_EVENTS.HOSTS_CHANGED, reload);
    return () => window.removeEventListener(DOM_EVENTS.HOSTS_CHANGED, reload);
  }, [loadData]);

  const recentHosts = useMemo(
    () =>
      hosts
        .filter((h) => h.last_connected_at)
        .sort((a, b) => (b.last_connected_at ?? 0) - (a.last_connected_at ?? 0))
        .slice(0, 6),
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
      notifyError(new Error(t('dashboard.usernameRequired')));
      return;
    }

    setConnecting(true);
    try {
      const config = {
        hostname: parsed.hostname,
        port: parsed.port || DEFAULT_SSH_PORT,
        username,
        password: parsed.password,
        privateKeyPath: parsed.privateKeyPath,
      };
      await sshTestConnect(config);
      if (activeTabId) {
        convertTabToTerminal(activeTabId, config);
      }
      setQuickInput('');
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
      window.dispatchEvent(new CustomEvent(DOM_EVENTS.HOSTS_CHANGED));
    } catch (e) {
      notifyError(e);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto bg-background">
      <div className="flex-1 flex flex-col px-6 py-6">
        <div className="w-full max-w-4xl mx-auto space-y-4">
          {/* 快速连接 — 全宽 */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-3 shadow-sm ring-1 ring-border/50">
            <div className="flex items-center gap-2">
              <Input
                value={quickInput}
                onChange={(e) => setQuickInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && canConnect && handleQuickConnect()}
                placeholder={t('dashboard.placeholder')}
                className="flex-1 h-10 text-sm font-mono"
                autoFocus
              />
              <Button className="h-10 gap-1.5 px-5" disabled={!canConnect} onClick={handleQuickConnect}>
                {connecting ? <Loader2 size={15} className="animate-spin" /> : <ArrowRight size={15} />}
                {connecting ? t('connection.connecting') : t('connection.connect')}
              </Button>
            </div>

            {showPreview && parsed && (
              <div className="flex flex-wrap items-center gap-1.5 px-1 animate-fade-in">
                <ParsedChip icon={<User size={10} />} label={parsed.username || t('dashboard.defaultUser')} />
                <ChevronRight size={10} className="text-muted-foreground/40" />
                <ParsedChip icon={<Globe size={10} />} label={`${parsed.hostname}:${parsed.port}`} />
                {parsed.password && <ParsedChip icon={<Lock size={10} />} label="••••••" highlight />}
                {parsed.privateKeyPath && (
                  <ParsedChip icon={<KeyRound size={10} />} label={parsed.privateKeyPath} highlight />
                )}
              </div>
            )}

            {!showPreview && (
              <div className="space-y-1 px-1">
                <p className="text-[11px] text-muted-foreground/70">{t('dashboard.formatHint1')}</p>
                <p className="text-[11px] text-muted-foreground/70">{t('dashboard.formatHint2')}</p>
                <p className="text-[11px] text-muted-foreground/70">{t('dashboard.formatHint3')}</p>
              </div>
            )}
          </div>

          {/* 下方左右布局：左 = 最近连接，右 = 系统信息 */}
          <div className="flex gap-4 min-h-0">
            {/* 左侧：最近连接 */}
            <div className="flex-1 min-w-0">
              {recentHosts.length > 0 ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <Clock size={13} />
                      {t('quickConnect.recent')}
                    </h3>
                    <button
                      onClick={() => setActiveView('hosts')}
                      className="text-[11px] text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                    >
                      {t('sidebar.hostManagement')} →
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    {recentHosts.map((host) => {
                      const isConnected = connectedHostIds.has(host.id);
                      return (
                        <div
                          key={host.id}
                          onClick={() => handleConnectSaved(host)}
                          className={cn(
                            'group flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all duration-200 cursor-pointer',
                            'border-border hover:border-primary/30 hover:bg-muted/50 hover:shadow-md',
                          )}
                        >
                          <div
                            className={cn(
                              'flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0 transition-colors',
                              isConnected ? 'bg-green-500/15' : 'bg-muted group-hover:bg-primary/10',
                            )}
                          >
                            <Server
                              size={14}
                              className={cn(
                                isConnected ? 'text-green-500' : 'text-muted-foreground group-hover:text-primary',
                              )}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-medium text-foreground truncate">{host.name}</span>
                              {isConnected && <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />}
                            </div>
                            <span className="text-[10px] text-muted-foreground/70 truncate block font-mono">
                              {host.username}@{host.hostname}:{host.port}
                            </span>
                          </div>
                          <span className="text-[10px] text-muted-foreground/50 flex-shrink-0">
                            {formatRelativeTime(host.last_connected_at, t)}
                          </span>
                          <div className="flex items-center justify-center w-7 h-7 rounded-lg text-primary bg-primary/10 opacity-50 group-hover:opacity-100 group-hover:bg-primary/15 transition-all flex-shrink-0">
                            <Terminal size={13} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 pt-8">
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-muted/50">
                    <Server size={24} className="text-muted-foreground/30" />
                  </div>
                  <p className="text-center text-xs text-muted-foreground max-w-xs">{t('dashboard.emptyHint')}</p>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="xs" className="gap-1.5" onClick={() => setActiveView('hosts')}>
                      <Server size={13} />
                      {t('sidebar.hostManagement')}
                    </Button>
                    <Button variant="ghost" size="xs" className="gap-1.5" onClick={() => setActiveView('keys')}>
                      <KeyRound size={13} />
                      {t('sidebar.keyManagement')}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* 右侧：系统信息 */}
            <div className="w-64 flex-shrink-0 space-y-3">
              <div className="rounded-xl border border-border bg-card p-4 space-y-3 shadow-sm">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Info size={13} />
                  {APP_NAME}
                </h3>
                <div className="flex items-center gap-3">
                  <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10">
                    <Zap size={18} className="text-primary" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-foreground">{APP_NAME}</div>
                    <div className="text-[11px] text-muted-foreground">v{sysInfo.appVersion || '...'}</div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card p-4 space-y-2.5 shadow-sm">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Monitor size={13} />
                  {t('settings.aboutSysInfo')}
                </h3>
                <InfoRow icon={<Cpu size={12} />} label={t('settings.aboutPlatform')} value={sysInfo.platform} />
                <InfoRow icon={<HardDrive size={12} />} label={t('settings.aboutVersion')} value={sysInfo.version} />
                <InfoRow icon={<Cpu size={12} />} label={t('settings.aboutArch')} value={sysInfo.arch} />
                {sysInfo.hostname && (
                  <InfoRow icon={<Server size={12} />} label={t('settings.aboutHostname')} value={sysInfo.hostname} />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ParsedChip({ icon, label, highlight }: { icon: React.ReactNode; label: string; highlight?: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 h-6 px-2.5 rounded text-xs font-mono',
        highlight ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-muted text-muted-foreground',
      )}
    >
      {icon}
      <span className="truncate max-w-32">{label}</span>
    </span>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-muted-foreground flex-shrink-0">{icon}</span>
      <span className="text-muted-foreground flex-1">{label}</span>
      <span className="font-medium text-foreground text-right truncate">{value || '...'}</span>
    </div>
  );
}
