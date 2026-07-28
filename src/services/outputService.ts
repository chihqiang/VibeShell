import { listen } from '@tauri-apps/api/event';
import { TAURI_EVENTS } from '@/constants';

// ── Module-level output dispatcher ──
// 解决异步 listen() 的竞态问题：全局只注册一次 listener，
// 各组件通过 registerOutputHandler / unregisterOutputHandler 接收自己 tab 的数据。

interface OutputHandler {
  tabId: string;
  onData: (data: string) => void;
}

const handlers = new Set<OutputHandler>();
let initialized = false;

function ensureOutputListener() {
  if (initialized) return;
  initialized = true;
  listen<{ tab_id: string; data: string }>(TAURI_EVENTS.SSH_OUTPUT, (event) => {
    const { tab_id, data } = event.payload;
    for (const h of handlers) {
      if (h.tabId === tab_id) {
        h.onData(data);
      }
    }
  });
}

export function registerOutputHandler(tabId: string, onData: (data: string) => void): () => void {
  ensureOutputListener();
  const handler: OutputHandler = { tabId, onData };
  handlers.add(handler);
  return () => {
    handlers.delete(handler);
  };
}
