import { invoke } from '@/lib/api';
import type { KeyEntry, ImportKeyParams, ImportKeyContentParams } from '@/apis/types/keys';

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
