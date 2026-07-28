/**
 * 并发执行异步任务 — 通用版。
 *
 * 与 `pMap` 不同（返回结果数组），`runWithConcurrency` 不关心返回值。
 * 需要返回值的场景直接用 `Promise.all` + 切片即可。
 */
export async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  if (items.length === 0) return;
  let idx = 0;
  const worker = async () => {
    while (idx < items.length) {
      const i = idx;
      idx += 1;
      await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
}

/**
 * 带返回值的并发执行器。
 * 等效于 sftpService.ts 中内联的 `pMap`，统一收敛到此处。
 */
export async function mapConcurrently<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  concurrency: number,
): Promise<R[]> {
  const results: R[] = [];
  const queue = items.entries();
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    for (const [i, item] of queue) {
      results[i] = await fn(item);
    }
  });
  await Promise.all(workers);
  return results;
}
