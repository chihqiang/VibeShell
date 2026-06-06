import { memo, useEffect, useRef } from 'react';
import { sshWrite, sshRead } from '@/apis/api/ssh';
import { listen } from '@tauri-apps/api/event';
import type { Terminal as XtermTerminal } from '@xterm/xterm';
import type { FitAddon } from '@xterm/addon-fit';
import { cn } from '@/lib/utils';
import { useNotify } from '@/hooks/use-notify';

interface TerminalProps {
  terminalId: string;
  tabId?: string;
  className?: string;
  visible?: boolean;
}

interface SshOutputEvent {
  tab_id: string;
  data: string;
}

const Terminal = memo(function Terminal({ terminalId, tabId, className, visible = true }: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);
  const termRef = useRef<XtermTerminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const tabIdRef = useRef(tabId);
  tabIdRef.current = tabId;
  const pendingRef = useRef<string[]>([]);
  const { notifyError } = useNotify();

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

  // ResizeObserver — only active when terminal is visible
  useEffect(() => {
    if (!visible || !fitAddonRef.current || !containerRef.current) return;

    const fitAddon = fitAddonRef.current;
    const resizeObserver = new ResizeObserver(() => {
      try {
        fitAddon.fit();
      } catch (e) {
        notifyError(e);
      }
    });
    resizeObserver.observe(containerRef.current);

    // Re-fit immediately when becoming visible
    const raf = requestAnimationFrame(() => {
      fitAddon.fit();
      const t = termRef.current;
      if (t) t.refresh(0, t.rows);
    });

    return () => {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
    };
  }, [visible, terminalId, notifyError]);

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
        return unlisten;
      }

      // Drain initial output — also starts the background reader thread
      try {
        const buf = await sshRead({ tabId });
        if (!cancelled && buf) {
          if (termRef.current) {
            termRef.current.write(buf);
          } else {
            pendingRef.current.push(buf);
          }
        }
      } catch (e) {
        notifyError(e);
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
      className={cn(
        'bg-[#02040a] h-full w-full overflow-hidden',
        !visible && 'absolute inset-0 invisible pointer-events-none',
        className,
      )}
    />
  );
});

export default Terminal;
