import { useEffect, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { TAURI_EVENTS } from '@/constants';
import type { MonitorEvent } from '@/types/monitor';

// ── Module-level data store ──
// 一个全局 listen() 把所有 tab 的监控数据存入 Map，组件只读不管理 listener。

const store = new Map<string, MonitorEvent>();
const subscribers = new Map<string, Set<(event: MonitorEvent) => void>>();
let initialized = false;

function ensureListener() {
  if (initialized) return;
  initialized = true;
  listen<MonitorEvent>(TAURI_EVENTS.SSH_MONITOR, (event) => {
    const { tab_id } = event.payload;
    store.set(tab_id, event.payload);
    const subs = subscribers.get(tab_id);
    if (subs) {
      for (const fn of subs) fn(event.payload);
    }
  });
}

/**
 * 监听服务器监控数据。
 *
 * 设计：单个全局 `listen()` 在首次调用时注册，将所有 tab 的监控数据
 * 存入模块级 Map。组件通过 tabId 从 Map 中读取自己关心的数据。
 *
 * 没有 listener 创建/销毁的生命周期竞争 —— 全局 listener 只初始化一次，
 * 组件切换 tab 时只切换读取的 key，不影响任何 Tauri IPC。
 */
export function useMonitorListener(tabId: string | null): MonitorEvent | null {
  const [data, setData] = useState<MonitorEvent | null>(() => {
    return tabId ? (store.get(tabId) ?? null) : null;
  });

  useEffect(() => {
    if (!tabId) {
      setData(null);
      return;
    }

    // 确保全局 listener 已启动
    ensureListener();

    // 同步已有数据
    const existing = store.get(tabId);
    if (existing) setData(existing);

    // 订阅新数据推送
    let subs = subscribers.get(tabId);
    if (!subs) {
      subs = new Set();
      subscribers.set(tabId, subs);
    }

    const listener = (event: MonitorEvent) => setData(event);
    subs.add(listener);

    return () => {
      subs.delete(listener);
      if (subs.size === 0) subscribers.delete(tabId);
    };
  }, [tabId]);

  return data;
}
