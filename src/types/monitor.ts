/** 监控相关类型定义 */

/** 进程信息 */
export interface ProcessInfo {
  mem: string;
  cpu: string;
  command: string;
  pid: string;
}

/** 磁盘信息 */
export interface DiskInfo {
  path: string;
  size: string;
  avail: string;
}

/** 监控事件（完整数据） */
export interface MonitorEvent {
  tab_id: string;
  ip: string;
  uptime: string;
  load: string;
  cpu: string;
  memory: string;
  swap: string;
  net_io?: string;
  processes: ProcessInfo[];
  disks: DiskInfo[];
}

/** 监控数据显示子集（不含 tab_id、processes、disks） */
export type MonitorData = Omit<MonitorEvent, 'tab_id' | 'processes' | 'disks'>;
