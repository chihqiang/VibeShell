import { useState, memo, useRef } from 'react';
import { X, Plus } from 'lucide-react';
import { useTerminalTabs, type TerminalTab } from '@/contexts/TerminalTabsContext';
import TabContextMenu from './TabContextMenu';

export default function TabBar({ onReconnect }: { onReconnect?: (tabId: string) => void }) {
  const { tabs, activeTabId, setActiveTab, closeTab, addQuickTab, reorderTabs } = useTerminalTabs();
  const [ctxTabId, setCtxTabId] = useState<string | null>(null);
  const [ctxPos, setCtxPos] = useState({ top: 0, left: 0 });
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  return (
    <>
      <div className="flex-shrink-0 flex items-center h-9 bg-secondary/50 border-b border-border overflow-x-auto scrollbar-none">
        {tabs.map((tab) => (
          <TabBarItem
            key={tab.id}
            tab={tab}
            active={tab.id === activeTabId}
            dragOver={dragOverId === tab.id}
            onSelect={() => setActiveTab(tab.id)}
            onClose={() => closeTab(tab.id)}
            onContextMenu={(e) => {
              e.preventDefault();
              setCtxTabId(tab.id);
              setCtxPos({ top: e.clientY, left: e.clientX });
            }}
            onDragStart={() => setDragOverId(null)}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOverId(tab.id);
            }}
            onDrop={() => {
              setDragOverId(null);
            }}
            onReorder={(fromId) => reorderTabs(fromId, tab.id)}
          />
        ))}

        <button
          onClick={addQuickTab}
          className="flex items-center justify-center w-8 h-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0 cursor-pointer"
        >
          <Plus size={14} />
        </button>
      </div>

      <TabContextMenu tabId={ctxTabId} position={ctxPos} onClose={() => setCtxTabId(null)} onReconnect={onReconnect} />
    </>
  );
}

const TabBarItem = memo(
  function TabBarItem({
    tab,
    active,
    dragOver,
    onSelect,
    onClose,
    onContextMenu,
    onDragStart,
    onDragOver,
    onDrop,
    onReorder,
  }: {
    tab: TerminalTab;
    active: boolean;
    dragOver: boolean;
    onSelect: () => void;
    onClose: () => void;
    onContextMenu: (e: React.MouseEvent) => void;
    onDragStart: () => void;
    onDragOver: (e: React.DragEvent) => void;
    onDrop: () => void;
    onReorder: (fromId: string) => void;
  }) {
    const dragIdRef = useRef<string | null>(null);

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
        draggable
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', tab.id);
          dragIdRef.current = tab.id;
          onDragStart();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          onDragOver(e);
        }}
        onDrop={(e) => {
          e.preventDefault();
          const fromId = e.dataTransfer.getData('text/plain') || dragIdRef.current;
          if (fromId && fromId !== tab.id) {
            onReorder(fromId);
          }
          dragIdRef.current = null;
          onDrop();
        }}
        className={`group flex items-center gap-1.5 h-full px-4 text-xs border-r border-border cursor-pointer select-none shrink-0 transition-colors relative ${
          active ? 'bg-background text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
        } ${dragOver ? 'border-l-2 border-l-primary' : ''}`}
        style={active ? { boxShadow: 'inset 0 -1.5px 0 hsl(var(--primary))' } : undefined}
        onClick={onSelect}
        onContextMenu={onContextMenu}
        onMouseDown={(e) => {
          if (e.button === 1) {
            e.preventDefault();
            onClose();
          }
        }}
      >
        {tab.type === 'terminal' && <span className={`w-2 h-2 rounded-full ${statusColor}`} />}
        <span className="truncate max-w-40">{tab.title}</span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className={`p-1 rounded transition-colors cursor-pointer ml-0.5 ${active ? 'opacity-100 hover:bg-red-500/20 hover:text-red-500' : 'opacity-0 group-hover:opacity-100 hover:bg-red-500/20 hover:text-red-500'}`}
        >
          <X size={13} />
        </button>
      </div>
    );
  },
  (prev, next) => prev.tab === next.tab && prev.active === next.active,
);
