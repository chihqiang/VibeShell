import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight, Pencil } from 'lucide-react';
import { cn } from '@/utils';

interface PathBreadcrumbProps {
  path: string;
  onNavigate: (path: string) => void;
  className?: string;
}

export function PathBreadcrumb({ path, onNavigate, className }: PathBreadcrumbProps) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(path);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setEditValue(path);
  }, [path, editing]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const segments = path === '/' || path === '.' ? [] : path.split('/').filter(Boolean);

  const buildPath = (index: number) => {
    if (index < 0) return '/';
    return '/' + segments.slice(0, index + 1).join('/');
  };

  const commitEdit = () => {
    setEditing(false);
    const v = editValue.trim() || '/';
    onNavigate(v);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={commitEdit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commitEdit();
          if (e.key === 'Escape') setEditing(false);
        }}
        className={cn(
          'flex-1 ml-1 h-5 px-1 text-xs font-mono bg-transparent border border-border rounded outline-none text-foreground',
          className,
        )}
      />
    );
  }

  return (
    <div className={cn('flex-1 ml-1 flex items-center min-w-0 group', className)}>
      <button
        onClick={() => onNavigate('/')}
        className="text-xs font-mono text-muted-foreground hover:text-primary transition-colors cursor-pointer px-0.5 flex-shrink-0"
        title="/"
      >
        /
      </button>
      {segments.map((seg, i) => (
        <div key={i} className="flex items-center min-w-0">
          <ChevronRight size={11} className="text-muted-foreground/50 flex-shrink-0" />
          <button
            onClick={() => onNavigate(buildPath(i))}
            className="text-xs font-mono text-muted-foreground hover:text-primary transition-colors cursor-pointer px-0.5 truncate"
            title={seg}
          >
            {seg}
          </button>
        </div>
      ))}
      <button
        onClick={() => setEditing(true)}
        className="ml-1 p-0.5 text-muted-foreground/0 group-hover:text-muted-foreground hover:text-foreground transition-colors cursor-pointer rounded flex-shrink-0"
        title={t('sftp.editPath')}
      >
        <Pencil size={10} />
      </button>
    </div>
  );
}
