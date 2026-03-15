import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

interface OcrTextOverlayProps {
  documentId: string;
  localPageNumber: number;
  scale: number;
  pageWidth: number;
  pageHeight: number;
}

const ocrTextCache = new Map<string, string | null>();

async function fetchOcrText(documentId: string, pageNumber: number): Promise<string | null> {
  const cacheKey = `${documentId}:${pageNumber}`;
  if (ocrTextCache.has(cacheKey)) {
    return ocrTextCache.get(cacheKey) ?? null;
  }

  const { data } = await supabase
    .from('pdf_text_pages')
    .select('text_content, ocr_status')
    .eq('process_document_id', documentId)
    .eq('page_number', pageNumber)
    .eq('ocr_status', 'ocr')
    .maybeSingle();

  const text = data?.text_content ?? null;
  ocrTextCache.set(cacheKey, text);
  return text;
}

const OcrTextOverlay: React.FC<OcrTextOverlayProps> = ({
  documentId,
  localPageNumber,
  scale,
  pageWidth,
  pageHeight,
}) => {
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchOcrText(documentId, localPageNumber).then((result) => {
      if (!cancelled) setText(result);
    });
    return () => { cancelled = true; };
  }, [documentId, localPageNumber]);

  if (!text) return null;

  return (
    <div
      className="absolute inset-0 overflow-hidden pointer-events-none select-text"
      style={{
        width: pageWidth * scale,
        height: pageHeight * scale,
        zIndex: 2,
      }}
    >
      <pre
        className="absolute inset-0 m-0 p-2 text-transparent bg-transparent select-text pointer-events-auto"
        style={{
          fontSize: `${Math.max(8, 10 * scale)}px`,
          lineHeight: '1.5',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          fontFamily: 'inherit',
          cursor: 'text',
          userSelect: 'text',
          WebkitUserSelect: 'text',
          overflow: 'hidden',
        }}
      >
        {text}
      </pre>
    </div>
  );
};

export function invalidateOcrTextCache(documentId: string): void {
  for (const key of Array.from(ocrTextCache.keys())) {
    if (key.startsWith(`${documentId}:`)) {
      ocrTextCache.delete(key);
    }
  }
}

export default OcrTextOverlay;
