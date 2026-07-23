import { useCallback, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { info, error as logError } from '@/utils/log';

export function useNotify() {
  const { toast } = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const notify = useCallback((message: string, feedback?: boolean) => {
    info(message);
    if (feedback !== false) {
      toastRef.current(message, { type: 'success' });
    }
  }, []);

  const notifyError = useCallback((message: unknown, feedback?: boolean) => {
    const msg = typeof message === 'string' ? message : message instanceof Error ? message.message : String(message);
    logError(msg);
    if (feedback !== false) {
      toastRef.current(msg, { type: 'error' });
    }
  }, []);

  return { notify, notifyError };
}
