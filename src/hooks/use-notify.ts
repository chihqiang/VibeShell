import { useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { info, error as logError } from '@/utils/log';

export function useNotify() {
  const { toast } = useToast();

  const notify = useCallback(
    (message: string, feedback?: boolean) => {
      info(message);
      if (feedback !== false) {
        toast(message, { type: 'success' });
      }
    },
    [toast],
  );

  const notifyError = useCallback(
    (message: unknown, feedback?: boolean) => {
      const msg = typeof message === 'string' ? message : message instanceof Error ? message.message : String(message);
      logError(msg);
      if (feedback !== false) {
        toast(msg, { type: 'error' });
      }
    },
    [toast],
  );

  return { notify, notifyError };
}
