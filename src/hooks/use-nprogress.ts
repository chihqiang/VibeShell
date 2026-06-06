import { useCallback } from 'react';
import NProgress from 'nprogress';

export function useNProgress() {
  const start = useCallback(() => NProgress.start(), []);
  const done = useCallback(() => NProgress.done(), []);
  return { start, done };
}
