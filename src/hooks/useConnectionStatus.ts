import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export type ConnectionState = 'connected' | 'disconnected' | 'reconnecting';

export interface ConnectionStatus {
  connectionState: ConnectionState;
  isConnected: boolean;
  isReconnecting: boolean;
}

const CHANNEL_NAME = '__connection_health__';
const RECONNECT_DELAY_MS = 4000;
const SHOW_BANNER_DELAY_MS = 6000;

export const useConnectionStatus = (): ConnectionStatus => {
  const [connectionState, setConnectionState] = useState<ConnectionState>(
    typeof navigator !== 'undefined' && !navigator.onLine ? 'disconnected' : 'connected'
  );
  const [displayState, setDisplayState] = useState<ConnectionState>(
    typeof navigator !== 'undefined' && !navigator.onLine ? 'disconnected' : 'connected'
  );

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bannerDelayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasEverConnectedRef = useRef(false);
  const mountedRef = useRef(true);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const clearBannerDelayTimer = useCallback(() => {
    if (bannerDelayTimerRef.current) {
      clearTimeout(bannerDelayTimerRef.current);
      bannerDelayTimerRef.current = null;
    }
  }, []);

  const removeChannel = useCallback(() => {
    if (channelRef.current) {
      try { supabase.removeChannel(channelRef.current); } catch {}
      channelRef.current = null;
    }
  }, []);

  const setupChannel = useCallback(() => {
    if (!mountedRef.current) return;

    removeChannel();
    clearReconnectTimer();

    const channel = supabase.channel(CHANNEL_NAME);
    channelRef.current = channel;

    channel.subscribe((status) => {
      if (!mountedRef.current) return;

      if (status === 'SUBSCRIBED') {
        hasEverConnectedRef.current = true;
        setConnectionState('connected');
        clearReconnectTimer();
        clearBannerDelayTimer();
        setDisplayState('connected');
      } else if (
        status === 'CHANNEL_ERROR' ||
        status === 'TIMED_OUT' ||
        status === 'CLOSED'
      ) {
        if (!hasEverConnectedRef.current) return;

        if (navigator.onLine) {
          setConnectionState('reconnecting');
          clearReconnectTimer();
          reconnectTimerRef.current = setTimeout(() => {
            if (mountedRef.current) setupChannel();
          }, RECONNECT_DELAY_MS);

          clearBannerDelayTimer();
          bannerDelayTimerRef.current = setTimeout(() => {
            if (mountedRef.current) setDisplayState('reconnecting');
          }, SHOW_BANNER_DELAY_MS);
        } else {
          setConnectionState('disconnected');
          clearBannerDelayTimer();
          bannerDelayTimerRef.current = setTimeout(() => {
            if (mountedRef.current) setDisplayState('disconnected');
          }, SHOW_BANNER_DELAY_MS);
        }
      }
    });
  }, [clearReconnectTimer, clearBannerDelayTimer, removeChannel]);

  useEffect(() => {
    mountedRef.current = true;

    const handleOnline = () => {
      if (!mountedRef.current) return;
      setupChannel();
    };

    const handleOffline = () => {
      if (!mountedRef.current) return;
      clearReconnectTimer();
      setConnectionState('disconnected');
      clearBannerDelayTimer();
      bannerDelayTimerRef.current = setTimeout(() => {
        if (mountedRef.current) setDisplayState('disconnected');
      }, SHOW_BANNER_DELAY_MS);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    setupChannel();

    return () => {
      mountedRef.current = false;
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearReconnectTimer();
      clearBannerDelayTimer();
      removeChannel();
    };
  }, [setupChannel, clearReconnectTimer, clearBannerDelayTimer, removeChannel]);

  return {
    connectionState: displayState,
    isConnected: displayState === 'connected',
    isReconnecting: displayState === 'reconnecting',
  };
};

export default useConnectionStatus;
