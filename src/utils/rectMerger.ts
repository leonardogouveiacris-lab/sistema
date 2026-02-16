interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function mergeRectsIntoLines(rects: Rect[], yTolerance: number = 3): Rect[] {
  if (rects.length === 0) {
    return [];
  }

  if (rects.length === 1) {
    return [...rects];
  }

  const sortedRects = [...rects].sort((a, b) => {
    const yDiff = a.y - b.y;
    if (Math.abs(yDiff) < yTolerance) {
      return a.x - b.x;
    }
    return yDiff;
  });

  const lines: Rect[][] = [];
  let currentLine: Rect[] = [sortedRects[0]];

  for (let i = 1; i < sortedRects.length; i++) {
    const rect = sortedRects[i];
    const lastRectInLine = currentLine[currentLine.length - 1];

    if (Math.abs(rect.y - lastRectInLine.y) < yTolerance) {
      currentLine.push(rect);
    } else {
      lines.push(currentLine);
      currentLine = [rect];
    }
  }

  lines.push(currentLine);

  const mergedRects: Rect[] = new Array(lines.length);

  for (let i = 0; i < lines.length; i++) {
    const lineRects = lines[i];
    let minX = lineRects[0].x;
    let maxX = lineRects[0].x + lineRects[0].width;
    let minY = lineRects[0].y;
    let maxHeight = lineRects[0].height;

    for (let j = 1; j < lineRects.length; j++) {
      const r = lineRects[j];
      if (r.x < minX) minX = r.x;
      const right = r.x + r.width;
      if (right > maxX) maxX = right;
      if (r.y < minY) minY = r.y;
      if (r.height > maxHeight) maxHeight = r.height;
    }

    mergedRects[i] = {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxHeight
    };
  }

  return mergedRects;
}
