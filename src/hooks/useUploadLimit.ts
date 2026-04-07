import { useState, useEffect, useCallback } from 'react';
import {
  getUploadLimitMb,
  updateUploadLimitMb,
  DEFAULT_UPLOAD_LIMIT_MB,
} from '../services/appSettings.service';

export interface UseUploadLimitReturn {
  limitMb: number;
  limitBytes: number;
  loading: boolean;
  updating: boolean;
  updateLimit: (mb: number) => Promise<void>;
}

export function useUploadLimit(): UseUploadLimitReturn {
  const [limitMb, setLimitMb] = useState<number>(DEFAULT_UPLOAD_LIMIT_MB);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getUploadLimitMb().then((mb) => {
      if (!cancelled) {
        setLimitMb(mb);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, []);

  const updateLimit = useCallback(async (mb: number) => {
    setUpdating(true);
    try {
      await updateUploadLimitMb(mb);
      setLimitMb(mb);
    } finally {
      setUpdating(false);
    }
  }, []);

  return {
    limitMb,
    limitBytes: limitMb * 1024 * 1024,
    loading,
    updating,
    updateLimit,
  };
}
