import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { OcrWordBox } from '../../services/pdfOcr.service';


interface OcrTextOverlayProps {
  documentId: string;
  localPageNumber: number;
  scale: number;
  naturalPageWidth: number;
  naturalPageHeight: number;
  userRotation?: number;
  internalRotation?: number;
}

interface OcrPageData {
  wordBoxes: OcrWordBox[];
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
    .select('word_boxes, ocr_status')
    .eq('process_document_id', documentId)
    .eq('page_number', pageNumber)
    .eq('ocr_status', 'ocr')
    .maybeSingle();

  if (!data || !data.word_boxes || !Array.isArray(data.word_boxes) || data.word_boxes.length === 0) {
    ocrDataCache.set(cacheKey, null);
    return null;
  }

  const result: OcrPageData = { wordBoxes: data.word_boxes as OcrWordBox[] };
  ocrDataCache.set(cacheKey, result);
  return result;
}

function normalizeRotation(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

function isSwapped(rotation: number): boolean {
  const r = normalizeRotation(rotation);
  return r === 90 || r === 270;
}

function buildUserRotationTransform(userRot: number, ocrW: number, ocrH: number): React.CSSProperties {
  const r = normalizeRotation(userRot);
  if (r === 0) return {};
  if (r === 90) return {
    transform: `rotate(90deg) translateX(0%) translateY(-100%)`,
    transformOrigin: 'top left',
    width: ocrW,
    height: ocrH,
  };
  if (r === 180) return {
    transform: `rotate(180deg)`,
    transformOrigin: 'center center',
    width: ocrW,
    height: ocrH,
  };
  if (r === 270) return {
    transform: `rotate(270deg) translateY(100%) translateX(-100%)`,
    transformOrigin: 'top left',
    width: ocrW,
    height: ocrH,
  };
  return {};
}

const OcrTextOverlay: React.FC<OcrTextOverlayProps> = ({
  documentId,
  localPageNumber,
  scale,
  naturalPageWidth,
  naturalPageHeight,
  userRotation = 0,
  internalRotation = 0,
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

  const internalSwap = isSwapped(internalRotation);
  const ocrNaturalW = internalSwap ? naturalPageHeight : naturalPageWidth;
  const ocrNaturalH = internalSwap ? naturalPageWidth : naturalPageHeight;

  const ocrW = ocrNaturalW * scale;
  const ocrH = ocrNaturalH * scale;

  const totalRotation = normalizeRotation(internalRotation + userRotation);
  const totalSwap = isSwapped(totalRotation);
  const displayW = totalSwap ? naturalPageHeight * scale : naturalPageWidth * scale;
  const displayH = totalSwap ? naturalPageWidth * scale : naturalPageHeight * scale;

  const userRot = normalizeRotation(userRotation);
  const rotationStyle = buildUserRotationTransform(userRot, ocrW, ocrH);

  return (
    <div
      className="absolute inset-0 overflow-hidden pointer-events-none select-text ocr-text-overlay"
      style={{
        width: displayW,
        height: displayH,
        zIndex: 2,
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: ocrW,
          height: ocrH,
          ...rotationStyle,
        }}
      >
        {data.wordBoxes.map((word, idx) => (
          <span
            key={idx}
            style={{
              position: 'absolute',
              left: word.x * scale,
              top: word.y * scale,
              width: word.w * scale,
              height: word.h * scale,
              color: 'transparent',
              backgroundColor: 'transparent',
              userSelect: 'text',
              WebkitUserSelect: 'text',
              cursor: 'text',
              pointerEvents: 'auto',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              fontSize: `${Math.max(1, word.h * scale * 0.85)}px`,
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
