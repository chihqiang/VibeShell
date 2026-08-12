import { basename } from '@tauri-apps/api/path';
import { invoke } from '@/utils/invoke';
import { mapConcurrently } from '@/utils/async';
import type { SftpListFilesResult, SftpChmodParams, ExpandedFile, ExpandResult, LocalFileInfo } from '@/types/sftp';

const EXPAND_CONCURRENCY = 4; // 并发展开的文件数

// ── SFTP 文件操作 ──

/** 列出远程目录文件 */
export function sftpListFiles(params: { tabId: string; path: string }): Promise<SftpListFilesResult> {
  return invoke('sftp_list_files', params);
}

/** 递归列出远程目录文件 */
export function sftpListFilesRecursive(params: { tabId: string; path: string }): Promise<string[]> {
  return invoke('sftp_list_files_recursive', params);
}

/** 创建远程目录 */
export function sftpCreateDir(params: { tabId: string; path: string }): Promise<void> {
  return invoke('sftp_create_dir', params);
}

/** 创建远程文件 */
export function sftpCreateFile(params: { tabId: string; path: string }): Promise<void> {
  return invoke('sftp_create_file', params);
}

/** 重命名远程文件/目录 */
export function sftpRename(params: { tabId: string; oldPath: string; newPath: string }): Promise<void> {
  return invoke('sftp_rename', params);
}

/** 删除远程文件/目录 */
export function sftpDeleteFile(params: { tabId: string; path: string; isDirectory: boolean }): Promise<void> {
  return invoke('sftp_delete_file', params);
}

/** 修改远程文件权限 */
export function sftpChmod(params: SftpChmodParams): Promise<void> {
  return invoke('sftp_chmod', params);
}

/** 读取远程文件内容 */
export function sftpReadFile(params: { tabId: string; path: string }): Promise<number[]> {
  return invoke('sftp_read_file', params);
}

/** 写入远程文件内容 */
export function sftpWriteFile(params: { tabId: string; path: string; content: string }): Promise<void> {
  return invoke('sftp_write_file', params);
}

/** 获取远程用户和组列表 */
export function sftpGetUsersGroups(params: { tabId: string }): Promise<{ users: string[]; groups: string[] }> {
  return invoke('sftp_get_users_groups', params);
}

// ── 本地文件操作（plugin-fs，Rust 不再接触本地文件系统） ──

/** 判断本地路径是否为目录（plugin-fs） */
export async function sftpIsDirectory(params: { path: string }): Promise<boolean> {
  const { stat } = await import('@tauri-apps/plugin-fs');
  try {
    const info = await stat(params.path);
    return info.isDirectory;
  } catch {
    return false;
  }
}

/** 递归列出本地文件（plugin-fs） */
export async function sftpListLocalFiles(params: { path: string }): Promise<LocalFileInfo[]> {
  const { readDir, stat } = await import('@tauri-apps/plugin-fs');
  const root = params.path;
  const result: LocalFileInfo[] = [];

  const rootInfo = await stat(root).catch(() => null);
  if (!rootInfo) return [];
  // 单文件：直接返回
  if (rootInfo.isFile) {
    result.push({ name: root.split(/[\\/]/).pop() || root, path: root, size: rootInfo.size });
    return result;
  }
  if (!rootInfo.isDirectory) return [];

  const sep = root.includes('\\') ? '\\' : '/';
  const join = (dir: string, name: string) => (dir.endsWith(sep) || dir.endsWith('/') ? dir + name : dir + sep + name);

  async function walk(dir: string): Promise<void> {
    let entries;
    try {
      entries = await readDir(dir);
    } catch {
      return; // 无权限读取时跳过目录内容
    }
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory) {
        await walk(full);
      } else if (entry.isFile) {
        const info = await stat(full).catch(() => null);
        const rel = full.startsWith(root) ? full.slice(root.length).replace(/^[\\/]/, '') : entry.name;
        result.push({ name: rel, path: full, size: info?.size ?? 0 });
      }
    }
  }

  await walk(root);
  return result;
}

// ── 传输分块原语（Rust 只操作远端，本地文件由前端 plugin-fs 读写） ──

const CHUNK_SIZE = 256 * 1024;

/** 获取远端文件大小 */
export function sftpStatRemote(params: { tabId: string; path: string }): Promise<number> {
  return invoke('sftp_stat_remote', params);
}

/** 向远端文件指定偏移写入一块 */
export function sftpWriteChunk(params: {
  tabId: string;
  remotePath: string;
  offset: number;
  data: number[];
  resume: boolean;
}): Promise<number> {
  return invoke('sftp_write_chunk', params);
}

/** 从远端文件指定偏移读取一块 */
export function sftpReadChunk(params: {
  tabId: string;
  remotePath: string;
  offset: number;
  length: number;
}): Promise<number[]> {
  return invoke('sftp_read_chunk', params);
}

// ── 传输进度事件（前端内部派发，替代原 Rust 的 sftp://transfer-progress） ──

export interface SftpTransferProgress {
  transferId: string;
  current: number;
  total: number;
  phase: 'uploading' | 'downloading';
}

type ProgressListener = (p: SftpTransferProgress) => void;
const progressListeners = new Set<ProgressListener>();

/** 订阅传输进度（返回取消订阅函数） */
export function onSftpTransferProgress(fn: ProgressListener): () => void {
  progressListeners.add(fn);
  return () => progressListeners.delete(fn);
}

function emitProgress(p: SftpTransferProgress): void {
  for (const fn of progressListeners) fn(p);
}

// ── 取消注册表（前端置标志，传输循环检查后停止） ──

const cancelledTransfers = new Set<string>();

/** 取消传输 */
export function sftpCancelTransfer(params: { transferId: string }): Promise<void> {
  cancelledTransfers.add(params.transferId);
  return Promise.resolve();
}

function isCancelled(transferId: string): boolean {
  return cancelledTransfers.has(transferId);
}

async function ensureLocalParentDir(filePath: string): Promise<void> {
  const { mkdir } = await import('@tauri-apps/plugin-fs');
  const sep = filePath.includes('\\') ? '\\' : '/';
  const idx = filePath.lastIndexOf(sep);
  const parent = idx > 0 ? filePath.slice(0, idx) : undefined;
  if (!parent) return;
  try {
    await mkdir(parent, { recursive: true });
  } catch {
    // 父目录已存在或创建失败都忽略
  }
}

/** 上传文件（前端 plugin-fs 读本地 + 分块写远端），resume=true 断点续传 */
export async function sftpUploadFileProgress(params: {
  tabId: string;
  localPath: string;
  remotePath: string;
  transferId: string;
  resume?: boolean;
}): Promise<void> {
  const { tabId, localPath, remotePath, transferId, resume = false } = params;
  const { open, stat, SeekMode } = await import('@tauri-apps/plugin-fs');

  const info = await stat(localPath);
  if (info.isDirectory) throw new Error('Cannot upload a directory');
  const total = info.size;

  let offset = 0;
  if (resume) {
    try {
      offset = await sftpStatRemote({ tabId, path: remotePath });
    } catch {
      offset = 0;
    }
  }

  const file = await open(localPath, { read: true });
  try {
    if (offset > 0) await file.seek(offset, SeekMode.Start);
    const buf = new Uint8Array(CHUNK_SIZE);
    for (;;) {
      if (isCancelled(transferId)) {
        cancelledTransfers.delete(transferId);
        return;
      }
      const read = await file.read(buf);
      if (!read || read === 0) break;
      const chunk = buf.slice(0, read);
      await sftpWriteChunk({ tabId, remotePath, offset, data: Array.from(chunk), resume });
      offset += read;
      emitProgress({ transferId, current: offset, total, phase: 'uploading' });
    }
  } finally {
    await file.close();
    cancelledTransfers.delete(transferId);
  }
}

/** 下载文件（前端分块读远端 + plugin-fs 写本地） */
export async function sftpDownloadFileProgress(params: {
  tabId: string;
  remotePath: string;
  localPath: string;
  transferId: string;
}): Promise<void> {
  const { tabId, remotePath, localPath, transferId } = params;
  const { create } = await import('@tauri-apps/plugin-fs');

  const total = await sftpStatRemote({ tabId, path: remotePath });
  await ensureLocalParentDir(localPath);
  const file = await create(localPath);

  let offset = 0;
  try {
    for (;;) {
      if (isCancelled(transferId)) {
        cancelledTransfers.delete(transferId);
        return;
      }
      if (offset >= total) break;
      const chunk = await sftpReadChunk({ tabId, remotePath, offset, length: CHUNK_SIZE });
      if (!chunk.length) break;
      const bytes = Uint8Array.from(chunk);
      await file.write(bytes);
      offset += bytes.length;
      emitProgress({ transferId, current: offset, total, phase: 'downloading' });
    }
  } finally {
    await file.close();
    cancelledTransfers.delete(transferId);
  }
}

// ── 文件展开工具 ──

/** 展开本地文件路径列表 */
export async function expandLocalFiles(
  paths: string[],
  baseRemotePath: string,
  options?: { fallbackName?: string },
): Promise<ExpandResult> {
  const fallbackName = options?.fallbackName ?? 'file';
  const files: ExpandedFile[] = [];
  const failures: ExpandResult['failures'] = [];

  await mapConcurrently(
    paths,
    async (p) => {
      const name = await basename(p).catch(() => fallbackName);
      const baseRc = baseRemotePath.replace(/\/?$/, '/') + name;
      try {
        const filesList = await sftpListLocalFiles({ path: p });
        if (filesList.length === 0) {
          failures.push({ name, localPath: p, remotePath: baseRc, error: 'sftp.empty' });
        } else if (filesList.length === 1 && filesList[0].path === p) {
          const isDir = await sftpIsDirectory({ path: p }).catch(() => false);
          if (isDir) {
            failures.push({ name, localPath: p, remotePath: baseRc, error: 'sftp.cantReadDir' });
          } else {
            const { size: fileSize } = filesList[0];
            files.push({ localPath: p, remotePath: baseRc, name, fileSize });
          }
        } else {
          for (const { name: relName, path: fullPath, size: fileSize } of filesList) {
            files.push({ localPath: fullPath, remotePath: baseRc + '/' + relName, name: relName, fileSize });
          }
        }
      } catch (e) {
        failures.push({ name, localPath: p, remotePath: baseRc, error: String(e) });
      }
    },
    EXPAND_CONCURRENCY,
  );

  return { files, failures };
}
