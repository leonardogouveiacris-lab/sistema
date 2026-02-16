import React, { useState, useRef, useEffect } from 'react';

interface TooltipProps {
  content: string;
  children: React.ReactNode;
  delay?: number;
  position?: 'top' | 'bottom' | 'left' | 'right';
  maxWidth?: number;
  className?: string;
  tooltipClassName?: string;
}

const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  delay = 300,
  position = 'top',
  maxWidth = 560,
  className = 'inline-block',
  tooltipClassName = ''
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const calculatePosition = () => {
    if (!triggerRef.current || !tooltipRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    let top = 0;
    let left = 0;

    switch (position) {
      case 'top':
        top = triggerRect.top - tooltipRect.height - 8;
        left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
        break;
      case 'bottom':
        top = triggerRect.bottom + 8;
        left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
        break;
      case 'left':
        top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
        left = triggerRect.left - tooltipRect.width - 8;
        break;
      case 'right':
        top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
        left = triggerRect.right + 8;
        break;
    }

    if (position === 'top' && top < 8) {
      top = triggerRect.bottom + 8;
    }

    if (position === 'bottom' && top + tooltipRect.height > window.innerHeight - 8) {
      top = triggerRect.top - tooltipRect.height - 8;
    }

    left = Math.max(8, Math.min(left, window.innerWidth - tooltipRect.width - 8));
    top = Math.max(8, Math.min(top, window.innerHeight - tooltipRect.height - 8));

    setCoords({ top, left });
  };

  useEffect(() => {
    if (isVisible) {
      calculatePosition();

      const recalculate = () => calculatePosition();
      window.addEventListener('resize', recalculate);
      window.addEventListener('scroll', recalculate, true);

      return () => {
        window.removeEventListener('resize', recalculate);
        window.removeEventListener('scroll', recalculate, true);
      };
    }
  }, [isVisible, content, position]);

  const handleMouseEnter = () => {
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, delay);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  if (!content) {
    return <>{children}</>;
  }

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={className}
      >
        {children}
      </div>
      {isVisible && (
        <div
          ref={tooltipRef}
          className={`fixed z-[9999] px-3 py-1.5 text-xs text-gray-800 bg-gray-200 border border-gray-300 rounded-md shadow-md pointer-events-none animate-fade-in whitespace-nowrap ${tooltipClassName}`}
          style={{
            top: coords.top,
            left: coords.left,
            maxWidth: maxWidth,
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}
        >
          {content}
          <div
            className={`absolute w-2 h-2 bg-gray-200 border border-gray-300 transform rotate-45 ${
              position === 'top' ? 'bottom-[-4px] left-1/2 -translate-x-1/2' :
              position === 'bottom' ? 'top-[-4px] left-1/2 -translate-x-1/2' :
              position === 'left' ? 'right-[-4px] top-1/2 -translate-y-1/2' :
              'left-[-4px] top-1/2 -translate-y-1/2'
            }`}
          />
        </div>
      )}
    </>
  );
};

export default Tooltip;
