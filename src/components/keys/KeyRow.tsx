import { FileKey, Lock, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { KeyEntry } from '@/apis/types/keys';

interface KeyRowProps {
  keyEntry: KeyEntry;
  onDelete: () => void;
}

export default function KeyRow({ keyEntry: k, onDelete }: KeyRowProps) {
  const { t } = useTranslation();

  return (
    <div className="group flex items-center gap-3 h-14 px-3 rounded-lg hover:bg-muted transition-colors relative">
      <FileKey size={18} className="text-muted-foreground flex-shrink-0" />
      <div className="flex flex-col min-w-0 flex-1">
        <span className="text-sm text-foreground truncate">{k.name}</span>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-mono">
          {k.password && <Lock size={10} className="flex-shrink-0" />}
          <span className="uppercase">{k.key_type}</span>
          <span className="truncate">{k.fingerprint}</span>
        </div>
      </div>

      <span className="text-[11px] text-muted-foreground hidden sm:block">{k.file_name}</span>

      <button
        onClick={onDelete}
        className="p-1.5 text-muted-foreground hover:text-destructive transition-colors cursor-pointer rounded-md hover:bg-destructive/5"
        title={t('connection.delete')}
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}
