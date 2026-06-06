export enum FileType {
  File = 'file',
  Directory = 'directory',
}

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
export type TransferStatus = 'pending' | 'uploading' | 'downloading' | 'paused' | 'completed' | 'failed';

export interface TransferItem {
  id: string;
  name: string;
  localPath: string;
  remotePath: string;
  current: number;
  total: number;
  status: TransferStatus;
  direction: 'upload' | 'download';
  error?: string;
}
