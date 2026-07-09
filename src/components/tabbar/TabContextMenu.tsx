import { useTranslation } from 'react-i18next';
import { Copy } from 'lucide-react';
import { useTerminalTabs } from '@/contexts/TerminalTabsContext';
import { useNotify } from '@/hooks/use-notify';
import { buildSshCommand } from '@/utils';

interface TabContextMenuProps {
  tabId: string | null;
  position: { top: number; left: number };
  onClose: () => void;
  onReconnect?: (tabId: string) => void;
}

export function TabContextMenu({ tabId, position, onClose, onReconnect }: TabContextMenuProps) {
  const { t } = useTranslation();
  const { tabs, closeTab, closeAllOtherTabs, closeAllTabs, addQuickTab, addTerminalTab } = useTerminalTabs();
  const { notify } = useNotify();

  if (!tabId) return null;

  const tab = tabs.find((t) => t.id === tabId);
  const canReconnect = tab?.type === 'terminal' && tab.status === 'disconnected' && onReconnect;

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="fixed z-50 w-36 rounded-lg border border-border bg-popover shadow-lg py-1"
        style={{ top: position.top, left: position.left }}
      >
        <button
          onClick={() => {
            if (tab) {
              if (tab.type === 'quick') {
                addQuickTab();
              } else {
                addTerminalTab(tab.connectConfig, tab.host);
              }
            }
            onClose();
          }}
          className="flex items-center gap-2 w-full h-8 px-3 text-sm text-left hover:bg-muted transition-colors cursor-pointer"
        >
          {t('tab.duplicateTab')}
        </button>
        {tab?.type === 'terminal' && (
          <>
            <button
              onClick={() => {
                const cmd = buildSshCommand(tab.connectConfig);
                navigator.clipboard.writeText(cmd).then(() => notify(t('common.copied')));
                onClose();
              }}
              className="flex items-center gap-2 w-full h-8 px-3 text-sm text-left hover:bg-muted transition-colors cursor-pointer"
            >
              <Copy size={13} />
              {t('tab.copyHostInfo', '复制主机信息')}
            </button>
            <div className="border-t border-border my-1" />
            <button
              disabled={!canReconnect}
              onClick={() => {
                if (canReconnect) {
                  onReconnect(tabId);
                  onClose();
                }
              }}
              className={`flex items-center gap-2 w-full h-8 px-3 text-sm text-left transition-colors cursor-pointer ${
                canReconnect ? 'hover:bg-muted' : 'text-muted-foreground/50 cursor-not-allowed'
              }`}
            >
              {t('tab.reconnect')}
            </button>
          </>
        )}
        <div className="border-t border-border my-1" />
        <button
          onClick={() => {
            closeTab(tabId);
            onClose();
          }}
          className="flex items-center gap-2 w-full h-8 px-3 text-sm text-left hover:bg-muted transition-colors cursor-pointer"
        >
          {t('tab.closeTab')}
        </button>
        <button
          onClick={() => {
            closeAllOtherTabs(tabId);
            onClose();
          }}
          className="flex items-center gap-2 w-full h-8 px-3 text-sm text-left hover:bg-muted transition-colors cursor-pointer"
        >
          {t('tab.closeOtherTabs')}
        </button>
        <button
          onClick={() => {
            closeAllTabs();
            onClose();
          }}
          className="flex items-center gap-2 w-full h-8 px-3 text-sm text-left hover:bg-muted transition-colors cursor-pointer"
        >
          {t('tab.closeAllTabs')}
        </button>
      </div>
    </>
  );
}
