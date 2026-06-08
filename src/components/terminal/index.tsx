import { memo, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { sshWrite } from '@/apis/api/ssh';
import { listen } from '@tauri-apps/api/event';
import type { Terminal as XtermTerminal } from '@xterm/xterm';
import type { FitAddon } from '@xterm/addon-fit';
import type { ConnectionStatus } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useNotify } from '@/hooks/use-notify';

interface TerminalProps {
  terminalId: string;
  tabId?: string;
  status?: ConnectionStatus;
  className?: string;
}

interface SshOutputEvent {
  tab_id: string;
  data: string;
}

const Terminal = memo(function Terminal({ terminalId, tabId, status, className }: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);
  const termRef = useRef<XtermTerminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const tabIdRef = useRef(tabId);
  tabIdRef.current = tabId;
  const prevStatusRef = useRef(status);
  const hadConnectionRef = useRef(false);
  const pendingRef = useRef<string[]>([]);
  const { notifyError } = useNotify();
  const { t } = useTranslation();

  // Initialize xterm — runs once per terminalId, independent of visibility
  useEffect(() => {
    if (initializedRef.current || !containerRef.current) return;
    initializedRef.current = true;

    const init = async () => {
      const { Terminal } = await import('@xterm/xterm');
      const { FitAddon } = await import('@xterm/addon-fit');

      const term = new Terminal({
        cursorBlink: true,
        cursorStyle: 'bar',
        fontSize: 13,
        fontFamily: "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace",
        theme: {
          background: '#02040a',
          foreground: '#e6edf3',
          cursor: '#58a6ff',
          cursorAccent: '#02040a',
          selectionBackground: '#58a6ff40',
          black: '#484f58',
          red: '#ff7b72',
          green: '#3fb950',
          yellow: '#d29922',
          blue: '#58a6ff',
          magenta: '#bc8cff',
          cyan: '#39c5cf',
          white: '#b1bac4',
          brightBlack: '#6e7681',
          brightRed: '#ffa198',
          brightGreen: '#56d364',
          brightYellow: '#e3b341',
          brightBlue: '#79c0ff',
          brightMagenta: '#d2a8ff',
          brightCyan: '#56d4dd',
          brightWhite: '#f0f6fc',
        },
        allowProposedApi: true,
        convertEol: true,
      });

      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      fitAddonRef.current = fitAddon;

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

      return () => {
        term.dispose();
      };
    };

    init();
  }, [terminalId, notifyError]);

  // ResizeObserver — reflow terminal when container resizes
  useEffect(() => {
    if (!fitAddonRef.current || !containerRef.current) return;

    const fitAddon = fitAddonRef.current;
    const resizeObserver = new ResizeObserver(() => {
      try {
        fitAddon.fit();
      } catch (e) {
        notifyError(e);
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
      resizeObserver.disconnect();
    };
  }, [terminalId, notifyError]);

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

  return (
    <div
      ref={containerRef}
      className={cn('bg-[#02040a] h-full w-full overflow-hidden', className)}
    />
  );
});

export default Terminal;
