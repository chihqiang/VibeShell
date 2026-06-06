import { getStorage, setStorage } from '@/lib/storage';

const CACHE_PREFIX = 'vibeshell-ug-cache-';

function cacheKey(hostname: string, port: number, username: string) {
  return `${CACHE_PREFIX}${hostname}:${port}:${username}`;
}

export function getCachedUsersGroups(
  hostname: string,
  port: number,
  username: string,
): { users: string[]; groups: string[] } | null {
  return getStorage<{ users: string[]; groups: string[] } | null>(cacheKey(hostname, port, username), null);
}

export function setCachedUsersGroups(
  hostname: string,
  port: number,
  username: string,
  data: { users: string[]; groups: string[] },
): void {
  setStorage(cacheKey(hostname, port, username), data);
}
