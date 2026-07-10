import { FileKey, Lock, Trash2, Copy, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import type { KeyEntry } from '@/types/key';

interface KeyRowProps {
  keyEntry: KeyEntry;
  onDelete: () => void;
}

export function KeyRow({ keyEntry: k, onDelete }: KeyRowProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const copyFingerprint = () => {
    navigator.clipboard.writeText(k.fingerprint).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="group flex items-center gap-3 h-14 px-3 rounded-lg hover:bg-muted transition-colors relative">
      <FileKey size={18} className="text-muted-foreground flex-shrink-0" />
      <div className="flex flex-col min-w-0 flex-1">
        <span className="text-sm text-foreground truncate">{k.name}</span>
        <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
          {k.password && <Lock size={10} className="flex-shrink-0" />}
          <span className="uppercase">{k.key_type}</span>
          <span className="truncate">{k.fingerprint}</span>
        </div>
      </div>

      <span className="text-xs text-muted-foreground hidden sm:block">{k.file_name}</span>

      <button
        onClick={copyFingerprint}
        className="p-1.5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer rounded-md hover:bg-muted"
        title={t('common.copyFingerprint')}
      >
        {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
      </button>

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
