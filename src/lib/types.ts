// -- core enums / union types --

export type AuthMethod = 'password' | 'key';
export type TabType = 'quick' | 'terminal';
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';
export type ImportMode = 'file' | 'paste';
export type TransferDirection = 'upload' | 'download';
export type TransferStatus = 'pending' | 'uploading' | 'downloading' | 'paused' | 'completed' | 'failed';
export type SftpProgressPhase = 'uploading' | 'downloading';

// -- host / connection --

export interface HostFormData {
  hostname: string;
  port: number;
  username: string;
  authMethod: AuthMethod;
  password: string;
  privateKeyPath: string;
  keyPassphrase: string;
}

export interface ConnectionConfig extends HostFormData {
  name: string;
}

export interface HostFormState extends HostFormData {
  name: string;
  group: string | null;
}

// -- sftp / transfer --

export interface TransferItem {
  id: string;
  name: string;
  localPath: string;
  remotePath: string;
  current: number;
  total: number;
  status: TransferStatus;
  direction: TransferDirection;
  error?: string;
}

export interface ChmodFormData {
  mode: string;
  uid: string;
  gid: string;
  recursive: boolean;
}

export const TRANSFER_STORAGE_KEY = 'sftp-transfers-latest';

export interface SftpProgressPayload {
  transferId: string;
  current: number;
  total: number;
  phase: SftpProgressPhase;
}

// -- sidebar / monitor --

export const BOTTOM_PANEL_MIN = 80;
export const BOTTOM_PANEL_DEFAULT = 260;

export const MIN_WIDTH = 180;
export const MAX_WIDTH = 500;
export const COLLAPSED_WIDTH = 28;
export const STORAGE_KEY_COLLAPSED = 'vibeshell-sidebar-collapsed';
export const STORAGE_KEY_WIDTH = 'vibeshell-sidebar-width';

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
