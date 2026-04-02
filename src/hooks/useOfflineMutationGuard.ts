import { useCallback } from 'react';
import { useConnectionStatus } from './useConnectionStatus';
import { useToast } from '../contexts/ToastContext';

const OFFLINE_MESSAGE = 'Sem conexao — tente novamente quando reconectar.';

export const useOfflineMutationGuard = () => {
  const { isConnected } = useConnectionStatus();
  const { warning } = useToast();

  const checkOnline = useCallback((): boolean => {
    if (!isConnected) {
      warning(OFFLINE_MESSAGE);
      return false;
    }
    return true;
  }, [isConnected, warning]);

  return { checkOnline, OFFLINE_MESSAGE };
};

export { OFFLINE_MESSAGE };
