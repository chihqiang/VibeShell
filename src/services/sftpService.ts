import { invoke } from '@/utils/invoke';
import type { SftpListFilesResult, SftpChmodParams, ExpandedFile, ExpandResult } from '@/types/sftp';

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

// ── 本地文件操作 ──

/** 判断本地路径是否为目录 */
export function sftpIsDirectory(params: { path: string }): Promise<boolean> {
  return invoke('sftp_is_directory', params);
}

/** 列出本地目录文件 */
export function sftpListLocalFiles(params: { path: string }): Promise<[string, string, number][]> {
  return invoke('sftp_list_local_files', params);
}

// ── 传输操作 ──

/** 上传文件（带进度） */
export function sftpUploadFileProgress(params: {
  tabId: string;
  localPath: string;
  remotePath: string;
  transferId: string;
}): Promise<void> {
  return invoke('sftp_upload_file_progress', params);
}

/** 下载文件（带进度） */
export function sftpDownloadFileProgress(params: {
  tabId: string;
  remotePath: string;
  localPath: string;
  transferId: string;
}): Promise<void> {
  return invoke('sftp_download_file_progress', params);
}

/** 取消传输 */
export function sftpCancelTransfer(params: { transferId: string }): Promise<void> {
  return invoke('sftp_cancel_transfer', params);
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

  await Promise.all(
    paths.map(async (p) => {
      const name = p.split('/').pop() || p.split('\\').pop() || fallbackName;
      const baseRc = baseRemotePath.replace(/\/?$/, '/') + name;
      try {
        const filesList = await sftpListLocalFiles({ path: p });
        if (filesList.length === 0) {
          failures.push({ name, localPath: p, remotePath: baseRc, error: 'sftp.empty' });
        } else if (filesList.length === 1 && filesList[0][1] === p) {
          const isDir = await sftpIsDirectory({ path: p }).catch(() => false);
          if (isDir) {
            failures.push({ name, localPath: p, remotePath: baseRc, error: 'sftp.cantReadDir' });
          } else {
            const [, , fileSize] = filesList[0];
            files.push({ localPath: p, remotePath: baseRc, name, fileSize });
          }
        } else {
          for (const [relName, fullPath, fileSize] of filesList) {
            files.push({ localPath: fullPath, remotePath: baseRc + '/' + relName, name: relName, fileSize });
          }
        }
      } catch (e) {
        failures.push({ name, localPath: p, remotePath: baseRc, error: String(e) });
      }
    }),
  );

  return { files, failures };
}
