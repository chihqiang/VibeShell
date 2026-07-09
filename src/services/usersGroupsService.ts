import { getStorage, setStorage } from '@/utils/storage';
import { STORAGE_KEYS } from '@/constants/storage-keys';

/** 生成用户组缓存键 */
function cacheKey(hostname: string, port: number, username: string) {
  return `${STORAGE_KEYS.USERS_GROUPS_CACHE_PREFIX}${hostname}:${port}:${username}`;
}

/** 获取缓存的用户和组 */
export function getCachedUsersGroups(
  hostname: string,
  port: number,
  username: string,
): { users: string[]; groups: string[] } | null {
  return getStorage<{ users: string[]; groups: string[] } | null>(cacheKey(hostname, port, username), null);
}

/** 设置缓存的用户和组 */
export function setCachedUsersGroups(
  hostname: string,
  port: number,
  username: string,
  data: { users: string[]; groups: string[] },
): void {
  setStorage(cacheKey(hostname, port, username), data);
}
