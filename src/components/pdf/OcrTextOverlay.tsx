import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { OcrWordBox } from '../../services/pdfOcr.service';

const OCR_RENDER_SCALE = 2.0;

interface OcrTextOverlayProps {
  documentId: string;
  localPageNumber: number;
  scale: number;
  pageWidth: number;
  pageHeight: number;
  rotation?: number;
}

interface OcrPageData {
  wordBoxes: OcrWordBox[];
  canvasWidth: number | null;
  canvasHeight: number | null;
}

const ocrDataCache = new Map<string, OcrPageData | null>();

type RefreshListener = () => void;
const refreshListeners = new Map<string, Set<RefreshListener>>();

function subscribeToRefresh(documentId: string, listener: RefreshListener): () => void {
  if (!refreshListeners.has(documentId)) {
    refreshListeners.set(documentId, new Set());
  }
  refreshListeners.get(documentId)!.add(listener);
  return () => {
    refreshListeners.get(documentId)?.delete(listener);
  };
}

async function fetchOcrData(documentId: string, pageNumber: number, bust = false): Promise<OcrPageData | null> {
  const cacheKey = `${documentId}:${pageNumber}`;
  if (!bust && ocrDataCache.has(cacheKey)) {
    return ocrDataCache.get(cacheKey) ?? null;
  }

  const { data } = await supabase
    .from('pdf_text_pages')
    .select('word_boxes, ocr_status, canvas_width, canvas_height')
    .eq('process_document_id', documentId)
    .eq('page_number', pageNumber)
    .eq('ocr_status', 'ocr')
    .maybeSingle();

  if (!data || !data.word_boxes || !Array.isArray(data.word_boxes) || data.word_boxes.length === 0) {
    ocrDataCache.set(cacheKey, null);
    return null;
  }

  const row = data as Record<string, unknown>;
  const result: OcrPageData = {
    wordBoxes: data.word_boxes as OcrWordBox[],
    canvasWidth: typeof row.canvas_width === 'number' ? row.canvas_width : null,
    canvasHeight: typeof row.canvas_height === 'number' ? row.canvas_height : null,
  };
  ocrDataCache.set(cacheKey, result);
  return result;
}

function buildRotationTransform(rotation: number, pageWidth: number, pageHeight: number): React.CSSProperties {
  const r = ((rotation % 360) + 360) % 360;
  if (r === 0) return {};
  if (r === 90) return {
    transform: `rotate(90deg) translateX(0%) translateY(-100%)`,
    transformOrigin: 'top left',
    width: pageHeight,
    height: pageWidth,
  };
  if (r === 180) return {
    transform: `rotate(180deg)`,
    transformOrigin: 'center center',
  };
  if (r === 270) return {
    transform: `rotate(270deg) translateY(100%) translateX(-100%)`,
    transformOrigin: 'top left',
    width: pageHeight,
    height: pageWidth,
  };
  return {};
}

const OcrTextOverlay: React.FC<OcrTextOverlayProps> = ({
  documentId,
  localPageNumber,
  scale,
  pageWidth,
  pageHeight,
  rotation = 0,
}) => {
  const [data, setData] = useState<OcrPageData | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchOcrData(documentId, localPageNumber).then((result) => {
      if (!cancelled) setData(result);
    });

    const unsubscribe = subscribeToRefresh(documentId, () => {
      if (!mountedRef.current) return;
      fetchOcrData(documentId, localPageNumber, true).then((result) => {
        if (mountedRef.current) setData(result);
      });
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [documentId, localPageNumber]);

  if (!data || data.wordBoxes.length === 0) return null;

  const displayWidth = pageWidth * scale;
  const displayHeight = pageHeight * scale;

  const r = ((rotation % 360) + 360) % 360;
  const isSwapped = r === 90 || r === 270;

  const ocrCanvasWidth = data.canvasWidth
    ? data.canvasWidth
    : (isSwapped ? pageHeight * OCR_RENDER_SCALE : pageWidth * OCR_RENDER_SCALE);
  const ocrCanvasHeight = data.canvasHeight
    ? data.canvasHeight
    : (isSwapped ? pageWidth * OCR_RENDER_SCALE : pageHeight * OCR_RENDER_SCALE);

  const scaleX = displayWidth / ocrCanvasWidth;
  const scaleY = displayHeight / ocrCanvasHeight;

  const rotationStyle = buildRotationTransform(r, displayWidth, displayHeight);

  return (
    <div
      className="absolute inset-0 overflow-hidden pointer-events-none select-text"
      style={{
        width: displayWidth,
        height: displayHeight,
        zIndex: 2,
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: displayWidth,
          height: displayHeight,
          ...rotationStyle,
        }}
      >
        {data.wordBoxes.map((word, idx) => (
          <span
            key={idx}
            style={{
              position: 'absolute',
              left: word.x * scaleX,
              top: word.y * scaleY,
              width: word.w * scaleX,
              height: word.h * scaleY,
              color: 'transparent',
              backgroundColor: 'transparent',
              userSelect: 'text',
              WebkitUserSelect: 'text',
              cursor: 'text',
              pointerEvents: 'auto',
              whiteSpace: 'pre',
              overflow: 'visible',
              fontSize: `${word.h * scaleY * 0.85}px`,
              lineHeight: 1,
              display: 'inline-block',
            }}
          >
            {word.text}
          </span>
        ))}
      </div>
    </div>
  );
};

export function invalidateOcrTextCache(documentId: string): void {
  for (const key of Array.from(ocrDataCache.keys())) {
    if (key.startsWith(`${documentId}:`)) {
      ocrDataCache.delete(key);
    }
  }
  refreshListeners.get(documentId)?.forEach((listener) => listener());
}

export default OcrTextOverlay;
