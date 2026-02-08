import { useEffect, useRef, useCallback } from 'react';
import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import logger from '../utils/logger';

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

  useEffect(() => {
    callbacksRef.current = { onInsert, onUpdate, onDelete, onAnyChange };
  }, [onInsert, onUpdate, onDelete, onAnyChange]);

  const handleChange = useCallback((payload: RealtimePostgresChangesPayload<T>) => {
    const { onInsert, onUpdate, onDelete, onAnyChange } = callbacksRef.current;

    logger.info(
      `Realtime event: ${payload.eventType} on ${table}`,
      'useRealtimeSubscription',
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

  useEffect(() => {
    if (!enabled) {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      return;
    }

    const channelName = `realtime-${table}-${Date.now()}`;

    const channelConfig: {
      event: PostgresChangeEvent;
      schema: string;
      table: string;
      filter?: string;
    } = {
      event,
      schema,
      table
    };

    if (filter) {
      channelConfig.filter = filter;
    }

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        channelConfig,
        handleChange
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          logger.success(
            `Realtime subscription active for ${table}`,
            'useRealtimeSubscription'
          );
        } else if (status === 'CHANNEL_ERROR') {
          logger.error(
            `Realtime subscription error for ${table}`,
            'useRealtimeSubscription'
          );
        }
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [table, schema, event, filter, enabled, handleChange]);

  const unsubscribe = useCallback(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  }, []);

  return { unsubscribe };
};

export default useRealtimeSubscription;
