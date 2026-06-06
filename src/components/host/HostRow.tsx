import { Pencil, Terminal, Trash2, MoreHorizontal } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { HostConfig } from '@/apis/types/hosts';

interface HostRowProps {
  host: HostConfig;
  menuOpen: boolean;
  onMenuToggle: () => void;
  onOpenTerminal: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export default function HostRow({ host, menuOpen, onMenuToggle, onOpenTerminal, onEdit, onDelete }: HostRowProps) {
  const { t } = useTranslation();

  return (
    <div
      className="group flex items-center gap-3 h-10 px-3 rounded-lg hover:bg-muted transition-colors cursor-pointer relative"
      onDoubleClick={onOpenTerminal}
    >
      <div className="w-2.5 h-2.5 rounded-full bg-primary flex-shrink-0" />
      <span className="text-sm text-foreground flex-1 truncate">{host.name}</span>
      <span className="text-xs text-muted-foreground">{host.hostname}</span>

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
            className="absolute right-0 top-full z-50 mt-1 w-32 rounded-lg border border-border bg-popover shadow-lg py-1"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => {
                onMenuToggle();
                onOpenTerminal();
              }}
              className="flex items-center gap-2 w-full h-8 px-3 text-sm text-left hover:bg-muted transition-colors cursor-pointer"
            >
              <Terminal size={13} />
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
