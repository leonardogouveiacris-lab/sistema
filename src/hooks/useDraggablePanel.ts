import { useState, useRef, useCallback, useEffect } from 'react';

interface Position {
  x: number;
  y: number;
}

export function useDraggablePanel() {
  const [position, setPosition] = useState<Position | null>(null);
  const isDragging = useRef(false);
  const dragOffset = useRef<Position>({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();

    let currentPos: Position;
    if (position) {
      currentPos = position;
    } else if (panelRef.current) {
      const rect = panelRef.current.getBoundingClientRect();
      currentPos = { x: rect.left, y: rect.top };
    } else {
      return;
    }

    isDragging.current = true;
    dragOffset.current = {
      x: e.clientX - currentPos.x,
      y: e.clientY - currentPos.y,
    };

    const onMouseMove = (ev: MouseEvent) => {
      if (!isDragging.current) return;
      const panelWidth = panelRef.current?.offsetWidth ?? 560;
      const panelHeight = panelRef.current?.offsetHeight ?? 400;
      const newX = Math.max(0, Math.min(window.innerWidth - panelWidth, ev.clientX - dragOffset.current.x));
      const newY = Math.max(0, Math.min(window.innerHeight - panelHeight, ev.clientY - dragOffset.current.y));
      setPosition({ x: newX, y: newY });
    };

    const onMouseUp = () => {
      isDragging.current = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [position]);

  useEffect(() => {
    return () => {
      isDragging.current = false;
    };
  }, []);

  const style: React.CSSProperties = position
    ? { position: 'fixed', left: position.x, top: position.y, right: 'auto', bottom: 'auto' }
    : {};

  return { panelRef, style, onMouseDown };
}
