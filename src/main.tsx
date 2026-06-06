/* eslint-disable react-refresh/only-export-components */
import React, { Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter, Routes, Route } from 'react-router-dom';
import Layout from '@/App';
import { TerminalTabsProvider } from '@/contexts/TerminalTabsContext';
import { ToastProvider } from '@/contexts/ToastContext';
import ErrorBoundary from '@/components/ErrorBoundary';
import '@/i18n';
import { initAppConfig } from '@/storage/config';
import '@/index.css';
import '@xterm/xterm/css/xterm.css';
import 'nprogress/nprogress.css';

const HomePage = lazy(() => import('@/pages/HomePage'));
const HostsPage = lazy(() => import('@/pages/HostsPage'));
const KeysPage = lazy(() => import('@/pages/KeysPage'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));
const SftpPage = lazy(() => import('@/pages/SftpPage'));

initAppConfig();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <HashRouter>
      <TerminalTabsProvider>
        <ToastProvider>
          <ErrorBoundary>
            <Suspense
              fallback={
                <div className="flex items-center justify-center h-screen text-muted-foreground text-sm">
                  Loading...
                </div>
              }
            >
              <Routes>
                <Route element={<Layout />}>
                  <Route index element={<HomePage />} />
                  <Route path="hosts" element={<HostsPage />} />
                  <Route path="keys" element={<KeysPage />} />
                  <Route path="settings" element={<SettingsPage />} />
                  <Route path="sftp" element={<SftpPage />} />
                </Route>
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </ToastProvider>
      </TerminalTabsProvider>
    </HashRouter>
  </React.StrictMode>,
);
