import { invoke } from '@tauri-apps/api/core';

export interface KeyEntry {
  id: string;
  name: string;
  file_name: string;
  key_type: string;
  fingerprint: string;
  imported_at: number;
  password?: string | null;
}

export type ImportKeyParams = Record<string, unknown> & {
  sourcePath: string;
  name: string | null;
  password: string | null;
};

export type ImportKeyContentParams = Record<string, unknown> & {
  content: string;
  name: string;
  password: string | null;
};

export function listKeys(): Promise<KeyEntry[]> {
  return invoke('list_keys');
}

export function importKey(params: ImportKeyParams): Promise<KeyEntry> {
  return invoke('import_key', params);
}

export function importKeyContent(params: ImportKeyContentParams): Promise<KeyEntry> {
  return invoke('import_key_content', params);
}

export function deleteKey(params: { id: string }): Promise<void> {
  return invoke('delete_key', params);
}
