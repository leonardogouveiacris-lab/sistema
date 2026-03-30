import React, { useEffect, useRef, useState } from 'react';
import { WifiOff, Wifi, RefreshCw } from 'lucide-react';
import { useConnectionStatus } from '../../hooks/useConnectionStatus';

const AUTO_DISMISS_MS = 3500;

const ConnectionStatusBanner: React.FC = () => {
  const { connectionState } = useConnectionStatus();
  const prevStateRef = useRef(connectionState);
  const [showReconnected, setShowReconnected] = useState(false);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const prev = prevStateRef.current;
    prevStateRef.current = connectionState;

    if (connectionState === 'connected' && (prev === 'reconnecting' || prev === 'disconnected')) {
      setShowReconnected(true);
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = setTimeout(() => setShowReconnected(false), AUTO_DISMISS_MS);
    }

    if (connectionState !== 'connected') {
      setShowReconnected(false);
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
        dismissTimerRef.current = null;
      }
    }

    return () => {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    };
  }, [connectionState]);

  if (connectionState === 'connected' && !showReconnected) return null;

  if (showReconnected) {
    return (
      <div className="bg-green-50 border-b border-green-200 px-6 py-2 transition-all duration-300">
        <div className="container mx-auto max-w-4xl flex items-center justify-center">
          <div className="flex items-center space-x-2 text-sm text-green-700">
            <Wifi size={14} />
            <span>Conexão restabelecida.</span>
          </div>
        </div>
      </div>
    );
  }

  if (connectionState === 'reconnecting') {
    return (
      <div className="bg-amber-50 border-b border-amber-300 px-6 py-2">
        <div className="container mx-auto max-w-4xl flex items-center justify-center">
          <div className="flex items-center space-x-2 text-sm text-amber-800">
            <RefreshCw size={14} className="animate-spin" />
            <span>Reconectando ao servidor — salvamentos podem falhar. Aguarde.</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-red-50 border-b border-red-300 px-6 py-2">
      <div className="container mx-auto max-w-4xl flex items-center justify-center">
        <div className="flex items-center space-x-2 text-sm text-red-800">
          <WifiOff size={14} />
          <span>Sem conexão — salvamentos não serão confirmados até reconectar.</span>
        </div>
      </div>
    </div>
  );
};

export default ConnectionStatusBanner;
