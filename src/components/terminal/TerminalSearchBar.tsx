import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, X, ChevronUp, ChevronDown, CaseSensitive } from 'lucide-react';
import type { SearchAddon } from '@xterm/addon-search';

interface TerminalSearchBarProps {
  searchAddon: SearchAddon | null;
  onClose: () => void;
}

export function TerminalSearchBar({ searchAddon, onClose }: TerminalSearchBarProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const doSearch = useCallback(
    (direction: 'next' | 'prev') => {
      if (!searchAddon || !query) return;
      const opts = { caseSensitive, wholeWord: false, regex: false };
      if (direction === 'prev') {
        searchAddon.findPrevious(query, opts);
      } else {
        searchAddon.findNext(query, opts);
      }
    },
    [searchAddon, query, caseSensitive],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      doSearch(e.shiftKey ? 'prev' : 'next');
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div className="absolute top-2 right-3 z-20 flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-popover/90 backdrop-blur-md border border-border shadow-xl">
      <Search size={13} className="text-muted-foreground flex-shrink-0" />
      <input
        ref={inputRef}
        value={query}
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        autoComplete="off"
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={t('terminal.searchPlaceholder')}
        className="w-40 text-xs bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground"
      />
      <button
        onClick={() => setCaseSensitive(!caseSensitive)}
        className={`flex items-center justify-center w-5 h-5 rounded text-xs transition-all duration-150 cursor-pointer ${
          caseSensitive ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted/80'
        }`}
        title={t('terminal.searchCaseSensitive')}
      >
        <CaseSensitive size={13} />
      </button>
      <div className="w-px h-4 bg-border" />
      <button
        onClick={() => doSearch('prev')}
        disabled={!query}
        className="flex items-center justify-center w-5 h-5 rounded text-muted-foreground hover:text-foreground hover:bg-muted/80 disabled:opacity-30 transition-all duration-150 cursor-pointer"
        title={t('terminal.searchPrevious')}
      >
        <ChevronUp size={13} />
      </button>
      <button
        onClick={() => doSearch('next')}
        disabled={!query}
        className="flex items-center justify-center w-5 h-5 rounded text-muted-foreground hover:text-foreground hover:bg-muted/80 disabled:opacity-30 transition-all duration-150 cursor-pointer"
        title={t('terminal.searchNext')}
      >
        <ChevronDown size={13} />
      </button>
      <button
        onClick={onClose}
        className="flex items-center justify-center w-5 h-5 rounded text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-all duration-150 cursor-pointer"
        title={t('common.close')}
      >
        <X size={13} />
      </button>
    </div>
  );
}
