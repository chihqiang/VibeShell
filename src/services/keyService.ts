import { invoke } from '@/utils/invoke';
import type { KeyEntry, ImportKeyParams, ImportKeyContentParams } from '@/types/key';
import {
  addKey,
  deleteKey as storeDeleteKey,
  getKeyReferrers as storeGetKeyReferrers,
  listKeys as storeListKeys,
} from './dataStore';

/** 获取所有密钥列表 */
export function listKeys(): Promise<KeyEntry[]> {
  return storeListKeys();
}

/** 通过文件路径导入密钥（后端仅做 passphrase 校验，前端持久化） */
export async function importKey(params: ImportKeyParams): Promise<KeyEntry> {
  const entry = await invoke<KeyEntry>('import_key', params);
  await addKey(entry);
  return entry;
}

/** 通过内容导入密钥 */
export async function importKeyContent(params: ImportKeyContentParams): Promise<KeyEntry> {
  const entry = await invoke<KeyEntry>('import_key_content', params);
  await addKey(entry);
  return entry;
}

/** 查看哪些主机引用了该密钥 */
export function getKeyReferrers(params: { keyId: string }): Promise<string[]> {
  return storeGetKeyReferrers(params.keyId);
}

/** 删除密钥 */
export function deleteKey(params: { id: string }): Promise<void> {
  return storeDeleteKey(params.id);
}
