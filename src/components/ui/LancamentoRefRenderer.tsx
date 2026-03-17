import React, { useCallback, useRef, useEffect } from 'react';
import { LancamentoReferenceItem } from '../../hooks/useLancamentosForReference';

interface LancamentoRefRendererProps {
  html: string;
  referenceItems: LancamentoReferenceItem[];
  onNavigate: (item: LancamentoReferenceItem) => void;
  className?: string;
}

const LancamentoRefRenderer: React.FC<LancamentoRefRendererProps> = ({
  html,
  referenceItems,
  onNavigate,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleClick = useCallback((e: MouseEvent) => {
    const target = e.target as HTMLElement;
    const chip = target.closest('[data-ref="lancamento"]') as HTMLElement | null;
    if (!chip) return;

    const id = chip.getAttribute('data-id');
    if (!id) return;

    const item = referenceItems.find(r => r.id === id);
    if (item) {
      e.preventDefault();
      e.stopPropagation();
      onNavigate(item);
    }
  }, [referenceItems, onNavigate]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('click', handleClick);
    return () => el.removeEventListener('click', handleClick);
  }, [handleClick]);

  return (
    <div
      ref={containerRef}
      className={`prose prose-sm max-w-none text-justify ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

export default LancamentoRefRenderer;
