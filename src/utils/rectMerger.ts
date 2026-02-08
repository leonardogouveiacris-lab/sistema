/**
 * Utility for merging text selection rectangles into continuous line-based highlights
 *
 * This creates Acrobat-style linear highlights without gaps between words
 */

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Merges multiple rectangles from the same line into a single continuous rectangle
 *
 * @param rects - Array of rectangles from range.getClientRects()
 * @param yTolerance - Tolerance in pixels to consider rectangles on the same line (default: 3)
 * @returns Array of merged rectangles, one per line
 */
export function mergeRectsIntoLines(rects: Rect[], yTolerance: number = 3): Rect[] {
  if (rects.length === 0) {
    return [];
  }

  if (rects.length === 1) {
    return [...rects];
  }

  // Sort by Y first, then by X
  const sortedRects = [...rects].sort((a, b) => {
    const yDiff = a.y - b.y;
    if (Math.abs(yDiff) < yTolerance) {
      return a.x - b.x;
    }
    return yDiff;
  });

  const lines: Rect[][] = [];
  let currentLine: Rect[] = [sortedRects[0]];

  // Group rectangles into lines based on Y coordinate
  for (let i = 1; i < sortedRects.length; i++) {
    const rect = sortedRects[i];
    const lastRectInLine = currentLine[currentLine.length - 1];

    // Check if this rect is on the same line (Y within tolerance)
    if (Math.abs(rect.y - lastRectInLine.y) < yTolerance) {
      currentLine.push(rect);
    } else {
      // New line
      lines.push(currentLine);
      currentLine = [rect];
    }
  }

  // Don't forget the last line
  lines.push(currentLine);

  // Merge each line into a single continuous rectangle
  const mergedRects: Rect[] = lines.map(lineRects => {
    // Find the bounds of this line
    const minX = Math.min(...lineRects.map(r => r.x));
    const maxX = Math.max(...lineRects.map(r => r.x + r.width));
    const minY = Math.min(...lineRects.map(r => r.y));
    const maxHeight = Math.max(...lineRects.map(r => r.height));

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxHeight
    };
  });

  return mergedRects;
}
