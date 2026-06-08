import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Plus, Menu, Server, Key } from 'lucide-react';
import { useTerminalTabs, type TerminalTab } from '@/contexts/TerminalTabsContext';
import HostManagementDialog from '@/components/host/dialogs/HostManagementDialog';
import KeyManagementDialog from '@/components/keys/dialogs/KeyManagementDialog';
import TabContextMenu from './TabContextMenu';

export default function TabBar({ onReconnect }: { onReconnect?: (tabId: string) => void }) {
  const { t } = useTranslation();
  const { tabs, activeTabId, setActiveTab, closeTab, addQuickTab } = useTerminalTabs();
  const [menuOpen, setMenuOpen] = useState(false);
  const [hostMgmtOpen, setHostMgmtOpen] = useState(false);
  const [keyMgmtOpen, setKeyMgmtOpen] = useState(false);
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });

  const [ctxTabId, setCtxTabId] = useState<string | null>(null);
  const [ctxPos, setCtxPos] = useState({ top: 0, left: 0 });

  const handleMenuClick = () => {
    if (!menuOpen && menuBtnRef.current) {
      const r = menuBtnRef.current.getBoundingClientRect();
      setMenuPos({ top: r.bottom + 4, left: r.left });
    }
    setMenuOpen(!menuOpen);
  };

  return (
    <>
      <div className="flex-shrink-0 flex items-center h-9 bg-secondary/50 border-b border-border overflow-x-auto">
        <button
          ref={menuBtnRef}
          onClick={handleMenuClick}
          className="flex items-center justify-center w-8 h-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0 cursor-pointer"
        >
          <Menu size={14} />
        </button>

        {tabs.map((tab) => (
          <TabBarItem
            key={tab.id}
            tab={tab}
            active={tab.id === activeTabId}
            onSelect={() => setActiveTab(tab.id)}
            onClose={() => closeTab(tab.id)}
            onContextMenu={(e) => {
              e.preventDefault();
              setCtxTabId(tab.id);
              setCtxPos({ top: e.clientY, left: e.clientX });
            }}
          />
        ))}

        <button
          onClick={addQuickTab}
          className="flex items-center justify-center w-8 h-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0 cursor-pointer"
        >
          <Plus size={14} />
        </button>
      </div>

      {menuOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
          <div
            className="fixed z-50 w-44 rounded-lg border border-border bg-popover shadow-lg py-1"
            style={{ top: menuPos.top, left: menuPos.left }}
          >
            <button
              onClick={() => {
                setMenuOpen(false);
                setHostMgmtOpen(true);
              }}
              className="flex items-center gap-2 w-full h-8 px-3 text-sm text-left hover:bg-muted transition-colors cursor-pointer"
            >
              <Server size={13} />
              {t('sidebar.hostManagement')}
            </button>
            <button
              onClick={() => {
                setMenuOpen(false);
                setKeyMgmtOpen(true);
              }}
              className="flex items-center gap-2 w-full h-8 px-3 text-sm text-left hover:bg-muted transition-colors cursor-pointer"
            >
              <Key size={13} />
              {t('sidebar.keyManagement')}
            </button>
          </div>
        </>
      )}

      <TabContextMenu tabId={ctxTabId} position={ctxPos} onClose={() => setCtxTabId(null)} onReconnect={onReconnect} />

      <HostManagementDialog open={hostMgmtOpen} onClose={() => setHostMgmtOpen(false)} />
      <KeyManagementDialog open={keyMgmtOpen} onClose={() => setKeyMgmtOpen(false)} />
    </>
  );
}

function TabBarItem({
  tab,
  active,
  onSelect,
  onClose,
  onContextMenu,
}: {
  tab: TerminalTab;
  active: boolean;
  onSelect: () => void;
  onClose: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}) {
  const statusColor =
    tab.type === 'terminal'
      ? tab.status === 'connected'
        ? 'bg-green-500'
        : tab.status === 'connecting'
          ? 'bg-yellow-500'
          : 'bg-red-500'
      : 'bg-transparent';

  return (
    <div
      className={`group flex items-center gap-1.5 h-full px-3 text-xs border-r border-border cursor-pointer select-none shrink-0 transition-colors ${
        active ? 'bg-background text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
      }`}
      onClick={onSelect}
      onContextMenu={onContextMenu}
    >
      {tab.type === 'terminal' && <span className={`w-2 h-2 rounded-full ${statusColor}`} />}
      <span className="truncate max-w-28">{tab.title}</span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="p-0.5 rounded hover:bg-muted-foreground/20 transition-colors cursor-pointer ml-0.5 opacity-0 group-hover:opacity-100"
      >
        <X size={12} />
      </button>
    </div>
  );
}
