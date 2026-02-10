let _cachedBrowser: string | null = null;

export function getBrowser(): string {
  if (_cachedBrowser !== null) return _cachedBrowser;

  const userAgent = navigator.userAgent;

  if (userAgent.indexOf('Firefox') > -1) {
    _cachedBrowser = 'Firefox';
  } else if (userAgent.indexOf('SamsungBrowser') > -1) {
    _cachedBrowser = 'Samsung';
  } else if (userAgent.indexOf('Opera') > -1 || userAgent.indexOf('OPR') > -1) {
    _cachedBrowser = 'Opera';
  } else if (userAgent.indexOf('Trident') > -1) {
    _cachedBrowser = 'IE';
  } else if (userAgent.indexOf('Edg') > -1) {
    _cachedBrowser = 'Edge';
  } else if (userAgent.indexOf('Chrome') > -1) {
    _cachedBrowser = 'Chrome';
  } else if (userAgent.indexOf('Safari') > -1) {
    _cachedBrowser = 'Safari';
  } else {
    _cachedBrowser = 'Unknown';
  }

  return _cachedBrowser;
}

export function resetTextLayer(endDiv: HTMLElement, textLayer: HTMLElement): void {
  if (getBrowser() === 'Firefox') {
    textLayer.append(endDiv);
    endDiv.style.width = '';
    endDiv.style.height = '';
  }
  endDiv.classList.remove('active');
}

export function moveEndElementToSelectionEnd(
  textLayers: Map<HTMLElement, HTMLElement>,
  prevRange?: Range
): Range | undefined {
  const selection = document.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return undefined;
  }

  const activeTextLayers = new Set<HTMLElement>();

  for (let i = 0; i < selection.rangeCount; i++) {
    const range = selection.getRangeAt(i);
    for (const textLayerDiv of textLayers.keys()) {
      if (!activeTextLayers.has(textLayerDiv) && range.intersectsNode(textLayerDiv)) {
        activeTextLayers.add(textLayerDiv);
      }
    }
  }

  for (const [textLayerDiv, endDiv] of textLayers) {
    if (activeTextLayers.has(textLayerDiv)) {
      endDiv.classList.add('active');
    } else {
      resetTextLayer(endDiv, textLayerDiv);
    }
  }

  if (getBrowser() === 'Firefox') {
    return undefined;
  }

  const range = selection.getRangeAt(0);

  const modifyStart =
    prevRange &&
    (range.compareBoundaryPoints(Range.END_TO_END, prevRange) === 0 ||
      range.compareBoundaryPoints(Range.START_TO_END, prevRange) === 0);

  let anchor: Node | null = modifyStart ? range.startContainer : range.endContainer;

  if (anchor && anchor.nodeType === Node.TEXT_NODE) {
    anchor = anchor.parentNode;
  }

  if (!anchor || !(anchor instanceof Element)) {
    return range.cloneRange();
  }

  const parentTextLayer = anchor.parentElement?.closest('.textLayer') as HTMLDivElement | null;

  if (!parentTextLayer) {
    return range.cloneRange();
  }

  const endDiv = textLayers.get(parentTextLayer);

  if (endDiv && parentTextLayer) {
    endDiv.style.width = parentTextLayer.style.width || `${parentTextLayer.offsetWidth}px`;
    endDiv.style.height = parentTextLayer.style.height || `${parentTextLayer.offsetHeight}px`;

    const anchorElement = anchor as Element;
    const nextSibling = modifyStart ? anchorElement : anchorElement.nextSibling;

    if (anchorElement.parentElement) {
      anchorElement.parentElement.insertBefore(endDiv, nextSibling);
    }
  }

  return range.cloneRange();
}
