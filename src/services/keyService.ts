import { invoke } from '@/utils/invoke';
import type { KeyEntry, ImportKeyParams, ImportKeyContentParams } from '@/types/key';

/** 获取所有密钥列表 */
export function listKeys(): Promise<KeyEntry[]> {
  return invoke('list_keys');
}

/** 通过文件路径导入密钥 */
export function importKey(params: ImportKeyParams): Promise<KeyEntry> {
  return invoke('import_key', params);
}

/** 通过内容导入密钥 */
export function importKeyContent(params: ImportKeyContentParams): Promise<KeyEntry> {
  return invoke('import_key_content', params);
}

/** 查看哪些主机引用了该密钥 */
export function getKeyReferrers(params: { keyId: string }): Promise<string[]> {
  return invoke('get_key_referrers', params);
}

/** 删除密钥 */
export function deleteKey(params: { id: string }): Promise<void> {
  return invoke('delete_key', params);
}
