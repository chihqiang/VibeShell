import { useState, useRef, useEffect } from 'react';
import { cn } from '@/utils';

interface AutocompleteProps {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  className?: string;
}

export default function Autocomplete({ value, onChange, options, placeholder, className }: AutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [focusIdx, setFocusIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = value ? options.filter((o) => o.toLowerCase().includes(value.toLowerCase())) : options;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        inputRef.current &&
        !inputRef.current.contains(e.target as Node) &&
        listRef.current &&
        !listRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const select = (option: string) => {
    onChange(option);
    setOpen(false);
    setFocusIdx(-1);
    inputRef.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') setOpen(true);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusIdx((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && focusIdx >= 0 && filtered[focusIdx]) {
      e.preventDefault();
      select(filtered[focusIdx]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={value}
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        autoComplete="off"
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setFocusIdx(-1);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className={cn(
          'w-full h-8 px-2.5 rounded-lg border border-border bg-transparent text-sm outline-none transition-colors focus:border-primary font-mono',
          className,
        )}
      />
      {open && filtered.length > 0 && (
        <div
          ref={listRef}
          className="absolute left-0 right-0 top-full mt-1 z-50 max-h-48 overflow-y-auto rounded-lg border border-border bg-popover shadow-lg"
        >
          {filtered.map((opt, i) => (
            <button
              key={opt}
              type="button"
              onMouseDown={() => select(opt)}
              onMouseEnter={() => setFocusIdx(i)}
              className={cn(
                'w-full px-2.5 py-1.5 text-sm text-left transition-colors cursor-pointer',
                i === focusIdx ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted',
              )}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
