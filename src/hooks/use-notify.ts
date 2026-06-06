import { useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { info, error as logError } from '@/lib/log';

export function useNotify() {
  const { toast } = useToast();

  const notify = useCallback(
    (message: string, feedback?: boolean) => {
      info(message);
      if (feedback !== false) {
        toast(message);
      }
    },
    [toast],
  );

  const notifyError = useCallback(
    (message: unknown, feedback?: boolean) => {
      const msg = typeof message === 'string' ? message : message instanceof Error ? message.message : String(message);
      logError(msg);
      if (feedback !== false) {
        toast(msg);
      }
    },
    [toast],
  );

  return { notify, notifyError };
}
