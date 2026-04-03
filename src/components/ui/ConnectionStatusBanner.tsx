import React, { useEffect, useRef, useState } from 'react';
import { WifiOff, Wifi, RefreshCw } from 'lucide-react';
import { useConnectionStatus } from '../../hooks/useConnectionStatus';

const AUTO_DISMISS_MS = 3000;
const FADE_MS = 400;

const ConnectionStatusBanner: React.FC = () => {
  const { connectionState } = useConnectionStatus();
  const prevStateRef = useRef(connectionState);
  const [showReconnected, setShowReconnected] = useState(false);
  const [visible, setVisible] = useState(false);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeOutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const prev = prevStateRef.current;
    prevStateRef.current = connectionState;

    if (connectionState === 'connected' && (prev === 'reconnecting' || prev === 'disconnected')) {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
      if (fadeOutTimerRef.current) clearTimeout(fadeOutTimerRef.current);
      setShowReconnected(true);
      setVisible(true);
      dismissTimerRef.current = setTimeout(() => {
        setVisible(false);
        fadeOutTimerRef.current = setTimeout(() => setShowReconnected(false), FADE_MS);
      }, AUTO_DISMISS_MS);
    }

    if (connectionState !== 'connected') {
      setShowReconnected(false);
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
      if (fadeOutTimerRef.current) clearTimeout(fadeOutTimerRef.current);
      setVisible(true);
    }

    if (connectionState === 'connected' && prev === 'connected') {
      setVisible(false);
    }

    return () => {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
      if (fadeOutTimerRef.current) clearTimeout(fadeOutTimerRef.current);
    };
  }, [connectionState]);

  const isShowing = connectionState !== 'connected' || showReconnected;
  if (!isShowing) return null;

  const baseClasses = 'border-b px-6 py-2 transition-all duration-[400ms] ease-in-out';
  const opacityClass = visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1';

  if (showReconnected) {
    return (
      <div className={`${baseClasses} bg-green-50 border-green-200 ${opacityClass}`}>
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
      <div className={`${baseClasses} bg-amber-50 border-amber-300 ${opacityClass}`}>
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
    <div className={`${baseClasses} bg-red-50 border-red-300 ${opacityClass}`}>
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
