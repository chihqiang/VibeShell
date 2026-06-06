import type { UnlistenFn } from '@tauri-apps/api/event';

export interface MonitorData {
  ip: string;
  uptime: string;
  load: string;
  cpu: string;
  memory: string;
  swap: string;
}

export interface ProcessInfo {
  mem: string;
  cpu: string;
  command: string;
  pid: string;
}

export interface DiskInfo {
  path: string;
  size: string;
  avail: string;
}

export interface MonitorEvent {
  tab_id: string;
  ip: string;
  uptime: string;
  load: string;
  cpu: string;
  memory: string;
  swap: string;
  processes: ProcessInfo[];
  disks: DiskInfo[];
}

export type { UnlistenFn };
