import { memo, useEffect, useRef, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { sshWrite } from '@/apis/api/ssh';
import { listen } from '@tauri-apps/api/event';
import type { Terminal as XtermTerminal } from '@xterm/xterm';
import type { ITheme } from '@xterm/xterm';
import type { FitAddon } from '@xterm/addon-fit';
import type { SearchAddon } from '@xterm/addon-search';
import type { ConnectionStatus } from '@/lib/types';
import { Loader2, WifiOff, RotateCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNotify } from '@/hooks/use-notify';
import { getStoredThemeId, getTerminalTheme } from '@/lib/terminal-themes';
import TerminalSearchBar from './TerminalSearchBar';

/** Build an xterm ITheme object from the stored terminal theme. */
function buildXtermTheme(): ITheme {
  const tc = getTerminalTheme(getStoredThemeId()).colors;
  return {
    background: tc.background,
    foreground: tc.foreground,
    cursor: tc.cursor,
    cursorAccent: tc.cursorAccent,
    selectionBackground: tc.selectionBackground,
    black: tc.black,
    red: tc.red,
    green: tc.green,
    yellow: tc.yellow,
    blue: tc.blue,
    magenta: tc.magenta,
    cyan: tc.cyan,
    white: tc.white,
    brightBlack: tc.brightBlack,
    brightRed: tc.brightRed,
    brightGreen: tc.brightGreen,
    brightYellow: tc.brightYellow,
    brightBlue: tc.brightBlue,
    brightMagenta: tc.brightMagenta,
    brightCyan: tc.brightCyan,
    brightWhite: tc.brightWhite,
  };
}

interface TerminalProps {
  terminalId: string;
  tabId?: string;
  status?: ConnectionStatus;
  active?: boolean;
  className?: string;
  onReconnect?: () => void;
}

interface SshOutputEvent {
  tab_id: string;
  data: string;
}

const TERM_FONT_SIZE_KEY = 'vibeshell-term-font-size';
const DEFAULT_FONT_SIZE = 13;
const MIN_FONT_SIZE = 8;
const MAX_FONT_SIZE = 32;

function getStoredFontSize(): number {
  try {
    const v = localStorage.getItem(TERM_FONT_SIZE_KEY);
    const n = v ? parseInt(v, 10) : DEFAULT_FONT_SIZE;
    return isNaN(n) ? DEFAULT_FONT_SIZE : Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, n));
  } catch {
    return DEFAULT_FONT_SIZE;
  }
}

const Terminal = memo(function Terminal({ terminalId, tabId, status, active = true, className, onReconnect }: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);
  const termRef = useRef<XtermTerminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const tabIdRef = useRef(tabId);
  tabIdRef.current = tabId;
  const prevStatusRef = useRef(status);
  const hadConnectionRef = useRef(false);
  const pendingRef = useRef<string[]>([]);
  const fontSizeRef = useRef(getStoredFontSize());
  const searchAddonRef = useRef<SearchAddon | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  // Background colour synced with the terminal theme — ensures the container
  // background matches xterm's own background even if a small gap exists.
  const [termBg, setTermBg] = useState(() => getTerminalTheme(getStoredThemeId()).colors.background);
  const { notifyError } = useNotify();
  const { t } = useTranslation();

  // Listen for terminal theme changes dispatched from settings — updates both
  // the container background and the live xterm instance's theme.
  useEffect(() => {
    const handler = () => {
      const theme = buildXtermTheme();
      setTermBg(theme.background as string);
      const term = termRef.current;
      if (term) {
        term.options.theme = theme;
        term.refresh(0, term.rows - 1);
      }
    };
    window.addEventListener('vibeshell:term-theme-change', handler);
    return () => window.removeEventListener('vibeshell:term-theme-change', handler);
  }, []);

  // Ctrl+wheel (or Cmd+wheel on macOS) to zoom font size
  const handleWheel = useCallback((e: WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const term = termRef.current;
    const fitAddon = fitAddonRef.current;
    if (!term || !fitAddon) return;
    const delta = e.deltaY < 0 ? 1 : -1;
    const next = Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, fontSizeRef.current + delta));
    if (next === fontSizeRef.current) return;
    fontSizeRef.current = next;
    localStorage.setItem(TERM_FONT_SIZE_KEY, String(next));
    term.options.fontSize = next;
    fitAddon.fit();
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  // Ctrl+F to toggle search bar, Ctrl+Shift+C to copy selection
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
      e.preventDefault();
      setShowSearch((v) => !v);
    }
    // Ctrl+Shift+C copies terminal selection to clipboard
    if (e.ctrlKey && e.shiftKey && (e.key === 'C' || e.key === 'c')) {
      const term = termRef.current;
      if (term && term.hasSelection()) {
        e.preventDefault();
        const text = term.getSelection();
        navigator.clipboard.writeText(text).catch(() => {});
      }
    }
  }, []);

  // Right-click: copy selection if any, otherwise paste clipboard
  const handleContextMenu = useCallback(async (e: MouseEvent) => {
    e.preventDefault();
    const term = termRef.current;
    // If there's a selection, copy it to clipboard and clear selection
    if (term && term.hasSelection()) {
      const text = term.getSelection();
      navigator.clipboard.writeText(text).catch(() => {});
      term.clearSelection();
      return;
    }
    // No selection — paste from clipboard
    try {
      const text = await navigator.clipboard.readText();
      if (text && tabIdRef.current) {
        sshWrite({ tabId: tabIdRef.current, data: text }).catch((err) => notifyError(err));
      }
    } catch {
      // Clipboard API might not be available
    }
  }, [notifyError]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('keydown', handleKeyDown);
    el.addEventListener('contextmenu', handleContextMenu);
    return () => {
      el.removeEventListener('keydown', handleKeyDown);
      el.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [handleKeyDown, handleContextMenu]);

  // Initialize xterm — runs once per terminalId, independent of visibility
  useEffect(() => {
    if (initializedRef.current || !containerRef.current) return;
    initializedRef.current = true;

    let disposed = false;

    const init = async () => {
      const { Terminal } = await import('@xterm/xterm');
      const { FitAddon } = await import('@xterm/addon-fit');
      const { SearchAddon } = await import('@xterm/addon-search');

      // If cleanup ran while awaiting dynamic imports, bail out
      if (disposed || !containerRef.current) return;

      const term = new Terminal({
        cursorBlink: true,
        cursorStyle: 'bar',
        fontSize: fontSizeRef.current,
        fontFamily: "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace",
        theme: buildXtermTheme(),
        allowProposedApi: true,
        convertEol: true,
      });

      // If cleanup ran while constructing the terminal, dispose immediately
      if (disposed) {
        term.dispose();
        return;
      }

      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      fitAddonRef.current = fitAddon;

      const searchAddon = new SearchAddon();
      term.loadAddon(searchAddon);
      searchAddonRef.current = searchAddon;

      if (containerRef.current) {
        term.open(containerRef.current);
        fitAddon.fit();
      }

      termRef.current = term;

      // Flush any output queued before the terminal was ready
      for (const data of pendingRef.current) {
        term.write(data);
      }
      pendingRef.current = [];

      term.onData((data) => {
        const tid = tabIdRef.current;
        if (tid) {
          sshWrite({ tabId: tid, data }).catch((e) => notifyError(e));
        }
      });
    };

    init();

    // Cleanup: dispose xterm instance when component unmounts or terminalId changes
    return () => {
      disposed = true;
      const term = termRef.current;
      if (term) {
        term.dispose();
        termRef.current = null;
      }
      fitAddonRef.current = null;
      searchAddonRef.current = null;
      initializedRef.current = false;
    };
  }, [terminalId, notifyError]);

  // Listen for external terminal write events (e.g. reconnect messages)
  useEffect(() => {
    if (!tabId) return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { tabId: string; text: string };
      if (detail.tabId !== tabId) return;
      if (termRef.current) {
        termRef.current.write(detail.text);
      } else {
        pendingRef.current.push(detail.text);
      }
    };
    window.addEventListener('vibeshell:term-write', handler);
    return () => window.removeEventListener('vibeshell:term-write', handler);
  }, [tabId]);

  // ResizeObserver — reflow terminal when container resizes (RAF debounced)
  useEffect(() => {
    if (!fitAddonRef.current || !containerRef.current) return;

    const fitAddon = fitAddonRef.current;
    let rafId: number | null = null;
    const resizeObserver = new ResizeObserver(() => {
      // Skip when container is hidden (display:none) — dimensions are 0×0
      const el = containerRef.current;
      if (!el || el.clientWidth === 0 || el.clientHeight === 0) return;
      // Debounce fit() calls to one per frame — fit() is expensive (DOM measurement)
      if (rafId === null) {
        rafId = requestAnimationFrame(() => {
          rafId = null;
          try {
            fitAddon.fit();
          } catch {
            // ignore fit errors during teardown
          }
        });
      }
    });
    resizeObserver.observe(containerRef.current);

    const raf = requestAnimationFrame(() => {
      fitAddon.fit();
      const t = termRef.current;
      if (t) t.refresh(0, t.rows);
    });

    return () => {
      cancelAnimationFrame(raf);
      if (rafId !== null) cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
    };
  }, [terminalId]);

  // Re-fit terminal when it becomes visible (e.g. switching tabs from hidden to active)
  useEffect(() => {
    if (!active) return;
    const raf = requestAnimationFrame(() => {
      try {
        fitAddonRef.current?.fit();
        const t = termRef.current;
        if (t) t.refresh(0, t.rows - 1);
      } catch {
        // ignore
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [active]);

  // Connection status messages — show connecting/connected/disconnected feedback
  useEffect(() => {
    if (!tabId) return;

    const prev = prevStatusRef.current;
    prevStatusRef.current = status;

    if (status === 'connecting' && prev !== 'connecting') {
      const isReconnect = hadConnectionRef.current;
      const text = isReconnect ? t('terminal.reconnecting') : t('terminal.connectingToHost');
      const msg = `\x1b[33m${text}\x1b[0m\r\n`;
      if (termRef.current) {
        termRef.current.write(msg);
      } else {
        pendingRef.current.push(msg);
      }
    } else if (status === 'connected' && prev !== 'connected') {
      hadConnectionRef.current = true;
      const msg = `\x1b[32m${t('terminal.connectedSuccess')}\x1b[0m\r\n`;
      if (termRef.current) {
        termRef.current.write(msg);
      } else {
        pendingRef.current.push(msg);
      }
    } else if (status === 'disconnected' && prev === 'connected') {
      // SSH prompt doesn't end with newline, so break to a new line first
      const msg = `\r\n\x1b[31m${t('terminal.disconnected')}\x1b[0m\r\n`;
      if (termRef.current) {
        termRef.current.write(msg);
      } else {
        pendingRef.current.push(msg);
      }
    } else if (status === 'disconnected' && prev === 'connecting') {
      const msg = `\x1b[31m${t('terminal.connectFailed')}\x1b[0m\r\n`;
      if (termRef.current) {
        termRef.current.write(msg);
      } else {
        pendingRef.current.push(msg);
      }
    }
  }, [tabId, status, t]);

  // SSH output listener — requestAnimationFrame-batched writes to avoid jank
  useEffect(() => {
    if (!tabId) return;

    let cancelled = false;

    const setup = async () => {
      let rafId: number | null = null;
      let pending = '';

      const flush = () => {
        rafId = null;
        if (termRef.current) {
          termRef.current.write(pending);
        } else {
          pendingRef.current.push(pending);
        }
        pending = '';
      };

      const unlisten = await listen<SshOutputEvent>('ssh://output', (event) => {
        if (cancelled) return;
        if (event.payload.tab_id === tabIdRef.current) {
          pending += event.payload.data;
          if (rafId === null) {
            rafId = requestAnimationFrame(flush);
          }
        }
      });

      if (cancelled) {
        unlisten();
        return;
      }

      return unlisten;
    };

    const unlistenPromise = setup();

    return () => {
      cancelled = true;
      unlistenPromise.then((fn) => fn?.());
    };
  }, [tabId, notifyError]);

  const isConnecting = status === 'connecting';
  const isDisconnected = status === 'disconnected' && hadConnectionRef.current;

  return (
    <div className={cn('relative h-full w-full overflow-hidden', className)} style={{ backgroundColor: termBg }}>
      <div ref={containerRef} className="h-full w-full overflow-hidden" />

      {/* Connecting overlay */}
      {isConnecting && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 animate-overlay-in" style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)' }}>
          <Loader2 size={28} className="animate-spin text-yellow-400" />
          <span className="text-xs text-yellow-400/90 font-medium">{hadConnectionRef.current ? t('terminal.reconnecting') : t('terminal.connectingToHost')}</span>
        </div>
      )}

      {/* Disconnected overlay (only when previously connected) */}
      {isDisconnected && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 animate-overlay-in" style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)' }}>
          <WifiOff size={28} className="text-red-400/80" />
          <span className="text-xs text-red-400/80 font-medium">{t('terminal.disconnected')}</span>
          {onReconnect && (
            <button
              onClick={onReconnect}
              className="flex items-center gap-1.5 mt-1 px-4 py-1.5 rounded-lg bg-primary/90 hover:bg-primary text-primary-foreground text-xs font-medium transition-colors cursor-pointer"
            >
              <RotateCw size={13} />
              {t('tab.reconnect')}
            </button>
          )}
        </div>
      )}

      {showSearch && (
        <TerminalSearchBar
          searchAddon={searchAddonRef.current}
          onClose={() => setShowSearch(false)}
        />
      )}
    </div>
  );
});

export default Terminal;
