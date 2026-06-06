import { invoke } from '@/lib/api';
import type { SftpListFilesResult, SftpChmodParams } from '@/apis/types/sftp';

export function sftpListFiles(params: { tabId: string; path: string }): Promise<SftpListFilesResult> {
  return invoke('sftp_list_files', params);
}

export function sftpListFilesRecursive(params: { tabId: string; path: string }): Promise<string[]> {
  return invoke('sftp_list_files_recursive', params);
}

export function sftpCreateDir(params: { tabId: string; path: string }): Promise<void> {
  return invoke('sftp_create_dir', params);
}

export function sftpCreateFile(params: { tabId: string; path: string }): Promise<void> {
  return invoke('sftp_create_file', params);
}

export function sftpRename(params: { tabId: string; oldPath: string; newPath: string }): Promise<void> {
  return invoke('sftp_rename', params);
}

export function sftpDeleteFile(params: { tabId: string; path: string; isDirectory: boolean }): Promise<void> {
  return invoke('sftp_delete_file', params);
}

export function sftpChmod(params: SftpChmodParams): Promise<void> {
  return invoke('sftp_chmod', params);
}

export function sftpReadFile(params: { tabId: string; path: string }): Promise<number[]> {
  return invoke('sftp_read_file', params);
}

export function sftpWriteFile(params: { tabId: string; path: string; content: string }): Promise<void> {
  return invoke('sftp_write_file', params);
}

export function sftpGetUsersGroups(params: { tabId: string }): Promise<{ users: string[]; groups: string[] }> {
  return invoke('sftp_get_users_groups', params);
}

export function sftpIsDirectory(params: { path: string }): Promise<boolean> {
  return invoke('sftp_is_directory', params);
}

export function sftpListLocalFiles(params: { path: string }): Promise<[string, string, number][]> {
  return invoke('sftp_list_local_files', params);
}

export function sftpUploadFileProgress(params: {
  tabId: string;
  localPath: string;
  remotePath: string;
  transferId: string;
}): Promise<void> {
  return invoke('sftp_upload_file_progress', params);
}

export function sftpDownloadFileProgress(params: {
  tabId: string;
  remotePath: string;
  localPath: string;
  transferId: string;
}): Promise<void> {
  return invoke('sftp_download_file_progress', params);
}

export function sftpCancelTransfer(params: { transferId: string }): Promise<void> {
  return invoke('sftp_cancel_transfer', params);
}
