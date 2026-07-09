/** SFTP 相关类型定义 */

import type { TransferDirection, TransferStatus, SftpProgressPhase } from './common';

/** 文件类型枚举 */
export enum FileType {
  File = 'file',
  Directory = 'directory',
}

/** 文件条目 */
export interface FileEntry {
  name: string;
  path: string;
  file_type: FileType;
  size: number;
  mode: string;
  perm: number;
  modified: string;
  uid: number;
  gid: number;
  user: string;
  group: string;
}

/** SFTP 列表结果 */
export interface SftpListFilesResult {
  path: string;
  files: FileEntry[];
}

/** SFTP Chmod 参数 */
export interface SftpChmodParams {
  tabId: string;
  path: string;
  mode: string;
  user: string | null;
  group: string | null;
  recursive: boolean;
  isDirectory: boolean;
}

/** 展开的文件 */
export interface ExpandedFile {
  localPath: string;
  remotePath: string;
  name: string;
  fileSize: number;
}

/** 文件展开结果 */
export interface ExpandResult {
  files: ExpandedFile[];
  failures: { name: string; localPath: string; remotePath: string; error: string }[];
}

/** 传输项 */
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

/** Chmod 表单数据 */
export interface ChmodFormData {
  mode: string;
  uid: string;
  gid: string;
  recursive: boolean;
}

/** SFTP 传输进度事件 */
export interface SftpProgressPayload {
  transferId: string;
  current: number;
  total: number;
  phase: SftpProgressPhase;
}

/** 权限标志 */
export interface PermFlags {
  ur: boolean;
  uw: boolean;
  ux: boolean;
  gr: boolean;
  gw: boolean;
  gx: boolean;
  or: boolean;
  ow: boolean;
  ox: boolean;
}

/** 权限标志键名 */
export type FlagKey = keyof PermFlags;
