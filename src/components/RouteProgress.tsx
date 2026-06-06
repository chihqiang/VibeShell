import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useNProgress } from '@/hooks/use-nprogress';

export function RouteProgress() {
  const { pathname } = useLocation();
  const { start, done } = useNProgress();

  useEffect(() => {
    start();
    const id = setTimeout(() => done(), 150);
    return () => {
      clearTimeout(id);
      done();
    };
  }, [pathname, start, done]);

  return null;
}
