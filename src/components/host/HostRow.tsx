import { Pencil, Terminal, Trash2, MoreHorizontal, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { HostConfig } from '@/apis/types/hosts';

interface HostRowProps {
  host: HostConfig;
  connecting?: boolean;
  connected?: boolean;
  menuOpen: boolean;
  onMenuToggle: () => void;
  onMenuToggleAt?: (x: number, y: number) => void;
  onOpenTerminal: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export default function HostRow({
  host,
  connecting = false,
  connected = false,
  menuOpen,
  onMenuToggle,
  onMenuToggleAt,
  onOpenTerminal,
  onEdit,
  onDelete,
}: HostRowProps) {
  const { t } = useTranslation();

  function handleOpenTerminal() {
    if (connecting) return;
    onOpenTerminal();
  }

  return (
    <div
      className={`group flex items-center gap-3 h-10 px-3 rounded-lg transition-colors relative ${connecting ? 'opacity-60 pointer-events-none' : 'hover:bg-muted cursor-pointer'} ${menuOpen ? 'bg-muted' : ''}`}
      onClick={handleOpenTerminal}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (onMenuToggleAt) {
          onMenuToggleAt(e.clientX, e.clientY);
        } else {
          onMenuToggle();
        }
      }}
    >
      {connecting ? (
        <Loader2 size={14} className="animate-spin text-primary flex-shrink-0" />
      ) : (
        <div
          className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${connected ? 'bg-green-500' : 'bg-muted-foreground/30'}`}
          title={connected ? t('connection.connected') : t('connection.disconnected')}
        />
      )}
      <span className="text-sm text-foreground flex-1 truncate">{host.name}</span>
      <span className="text-xs text-muted-foreground font-mono hidden sm:block">
        {host.username}@{host.hostname}
      </span>

      <div className="relative">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onMenuToggle();
          }}
          className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-foreground transition-all cursor-pointer"
        >
          <MoreHorizontal size={14} />
        </button>

        {menuOpen && (
          <div
            className="absolute right-0 top-full z-50 mt-1 w-36 rounded-lg border border-border bg-popover shadow-lg py-1"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => {
                if (connecting) return;
                onMenuToggle();
                onOpenTerminal();
              }}
              className={`flex items-center gap-2 w-full h-8 px-3 text-sm text-left transition-colors ${connecting ? 'opacity-50 cursor-not-allowed' : 'hover:bg-muted cursor-pointer'}`}
            >
              {connecting ? <Loader2 size={13} className="animate-spin" /> : <Terminal size={13} />}
              {t('connection.openTerminal')}
            </button>
            <button
              onClick={() => {
                onMenuToggle();
                onEdit();
              }}
              className="flex items-center gap-2 w-full h-8 px-3 text-sm text-left hover:bg-muted transition-colors cursor-pointer"
            >
              <Pencil size={13} />
              {t('connection.edit')}
            </button>
            <button
              onClick={() => {
                onMenuToggle();
                onDelete();
              }}
              className="flex items-center gap-2 w-full h-8 px-3 text-sm text-left text-destructive hover:bg-muted transition-colors cursor-pointer"
            >
              <Trash2 size={13} />
              {t('connection.delete')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
