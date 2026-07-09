import React from 'react';
import ReactDOM from 'react-dom/client';
import { TerminalTabsProvider } from '@/contexts/TerminalTabsContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { LayoutProvider } from '@/contexts/LayoutContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AppRouter } from '@/router';
import '@/hooks/use-lang';
import { initAppConfig } from '@/services/configService';
import '@/index.css';
import '@xterm/xterm/css/xterm.css';
import 'nprogress/nprogress.css';

initAppConfig();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <TerminalTabsProvider>
      <ToastProvider>
        <LayoutProvider>
          <ErrorBoundary>
            <AppRouter />
          </ErrorBoundary>
        </LayoutProvider>
      </ToastProvider>
    </TerminalTabsProvider>
  </React.StrictMode>,
);
