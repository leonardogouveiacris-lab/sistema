import { useEffect, useRef, useCallback } from 'react';
import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { logRealtimeEvent } from '../utils/domainLogger';

type PostgresChangeEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

interface UseRealtimeSubscriptionOptions<T> {
  table: string;
  schema?: string;
  event?: PostgresChangeEvent;
  filter?: string;
  onInsert?: (payload: T) => void;
  onUpdate?: (payload: T) => void;
  onDelete?: (payload: { id: string }) => void;
  onAnyChange?: () => void;
  enabled?: boolean;
}

const MAX_RETRY_ATTEMPTS = 6;
const BASE_RETRY_DELAY_MS = 1000;

export const useRealtimeSubscription = <T extends { id: string }>({
  table,
  schema = 'public',
  event = '*',
  filter,
  onInsert,
  onUpdate,
  onDelete,
  onAnyChange,
  enabled = true
}: UseRealtimeSubscriptionOptions<T>) => {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const callbacksRef = useRef({ onInsert, onUpdate, onDelete, onAnyChange });
  const retryCountRef = useRef(0);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    callbacksRef.current = { onInsert, onUpdate, onDelete, onAnyChange };
  }, [onInsert, onUpdate, onDelete, onAnyChange]);

  const handleChange = useCallback((payload: RealtimePostgresChangesPayload<T>) => {
    if (!payload || !payload.eventType) return;

    const { onInsert, onUpdate, onDelete, onAnyChange } = callbacksRef.current;

    logRealtimeEvent(
      'Realtime event received',
      'useRealtimeSubscription',
      'change_received',
      { eventType: payload.eventType, table }
    );

    switch (payload.eventType) {
      case 'INSERT':
        if (onInsert && payload.new) {
          onInsert(payload.new as T);
        }
        break;
      case 'UPDATE':
        if (onUpdate && payload.new) {
          onUpdate(payload.new as T);
        }
        break;
      case 'DELETE':
        if (onDelete && payload.old && 'id' in payload.old) {
          onDelete({ id: (payload.old as { id: string }).id });
        }
        break;
    }

    if (onAnyChange) {
      onAnyChange();
    }
  }, [table]);

  const subscribeRef = useRef<(() => void) | null>(null);

  const subscribe = useCallback(() => {
    if (!supabase || !mountedRef.current) return;

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    const channelName = filter
      ? `rt-${table}-${schema}-${filter}`
      : `rt-${table}-${schema}`;

    const channelConfig: {
      event: PostgresChangeEvent;
      schema: string;
      table: string;
      filter?: string;
    } = { event, schema, table };

    if (filter) {
      channelConfig.filter = filter;
    }

    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', channelConfig, handleChange)
      .subscribe((status) => {
        if (!mountedRef.current) return;

        if (status === 'SUBSCRIBED') {
          retryCountRef.current = 0;
          logRealtimeEvent(
            'Realtime subscription active',
            'useRealtimeSubscription',
            'subscription_active',
            { table, schema, event, filter },
            'info'
          );
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          logRealtimeEvent(
            'Realtime subscription error',
            'useRealtimeSubscription',
            'subscription_error',
            { table, schema, event, filter, status, attempt: retryCountRef.current },
            'error'
          );

          if (retryCountRef.current < MAX_RETRY_ATTEMPTS && mountedRef.current) {
            const delay = Math.min(BASE_RETRY_DELAY_MS * Math.pow(2, retryCountRef.current), 30000);
            retryCountRef.current += 1;

            if (retryTimeoutRef.current) {
              clearTimeout(retryTimeoutRef.current);
            }

            retryTimeoutRef.current = setTimeout(() => {
              if (mountedRef.current) {
                subscribeRef.current?.();
              }
            }, delay);
          }
        }
      });

    channelRef.current = channel;
  }, [table, schema, event, filter, handleChange]);

  subscribeRef.current = subscribe;

  useEffect(() => {
    mountedRef.current = true;

    if (!enabled) {
      if (channelRef.current && supabase) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      return;
    }

    if (!supabase) return;

    retryCountRef.current = 0;
    subscribe();

    return () => {
      mountedRef.current = false;
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
      if (channelRef.current && supabase) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [table, schema, event, filter, enabled, subscribe]);

  const unsubscribe = useCallback(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    if (channelRef.current && supabase) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  }, []);

  return { unsubscribe };
};

export default useRealtimeSubscription;
