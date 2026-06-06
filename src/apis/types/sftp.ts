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

export interface SftpListFilesResult {
  path: string;
  files: FileEntry[];
}

export interface SftpChmodParams {
  tabId: string;
  path: string;
  mode: string;
  user: string | null;
  group: string | null;
  recursive: boolean;
  isDirectory: boolean;
}

export interface ExpandedFile {
  localPath: string;
  remotePath: string;
  name: string;
  fileSize: number;
}

export interface ExpandResult {
  files: ExpandedFile[];
  failures: { name: string; localPath: string; remotePath: string; error: string }[];
}
