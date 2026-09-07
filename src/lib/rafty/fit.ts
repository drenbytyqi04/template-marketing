/**
 * Deterministic auto-fit text sizing.
 *
 * Given a bounded box and a text element, this shrinks the font size (via a
 * bounded binary search over a fixed number of iterations) until the text
 * fits within the box height and the max line count, tightening line-height
 * once it approaches the minimum size. It never grows the font size back up
 * mid-run, is not driven by animation frames or timers, and produces the
 * same output every time for the same input, so it is safe to run in a
 * layout effect (before paint) and safe to reuse for export snapshots since
 * export reads the already laid out DOM.
 */

export type FitTextOptions = {
  /** Starting font size in cqw, the template's intended max. */
  maxSize: number;
  /** Never shrink below this size in cqw. */
  minSize: number;
  /** Hard cap on the number of wrapped lines. */
  maxLines: number;
  /** Line-height used at the max size. */
  lineHeight: number;
  /** Tighter line-height applied once the text needs to shrink. */
  tightLineHeight?: number;
  /** Binary search iterations. 8 is enough to converge to sub-pixel sizes. */
  iterations?: number;
};

/**
 * Mutates `text`'s inline font-size/line-height so it fits inside `container`.
 * Both elements must already be attached to the document with layout resolved
 * (cqw units require a sized ancestor with containerType set).
 */
export function fitTextToBox(
  container: HTMLElement,
  text: HTMLElement,
  opts: FitTextOptions,
): void {
  const { maxSize, minSize, maxLines, lineHeight, tightLineHeight, iterations = 8 } = opts;

  const setSize = (size: number, lh: number) => {
    text.style.fontSize = `${size}cqw`;
    text.style.lineHeight = String(lh);
  };

  const fits = () => {
    const computedLineHeight = parseFloat(getComputedStyle(text).lineHeight || "0") || 1;
    const maxHeight = computedLineHeight * maxLines + 1;
    return text.scrollHeight <= maxHeight + 1 && text.scrollWidth <= container.clientWidth + 1;
  };

  // Try the intended size first, at full line-height.
  setSize(maxSize, lineHeight);
  if (fits()) return;

  // Still try the intended size but with the tightened line-height, in case
  // only the vertical rhythm (not the width) was the problem.
  const tight = tightLineHeight ?? lineHeight;
  setSize(maxSize, tight);
  if (fits()) return;

  // Binary search the font size at the tight line-height.
  let lo = minSize;
  let hi = maxSize;
  for (let i = 0; i < iterations; i++) {
    const mid = (lo + hi) / 2;
    setSize(mid, tight);
    if (fits()) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  setSize(lo, tight);
}
