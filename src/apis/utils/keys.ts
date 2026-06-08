import type { HostConfig } from '@/apis/types/hosts';
import type { KeyEntry } from '@/apis/types/keys';

export async function resolvePrivateKeyPath(host: HostConfig, keys: KeyEntry[]): Promise<string | null> {
  let privateKeyPath = host.private_key_path || null;
  if (host.auth_method === 'key' && !privateKeyPath && keys.length > 0) {
    const { getKeysPath } = await import('@/storage/config');
    const keysPath = await getKeysPath();
    privateKeyPath = `${keysPath}/${keys[0].file_name}`;
  }
  return privateKeyPath;
}
