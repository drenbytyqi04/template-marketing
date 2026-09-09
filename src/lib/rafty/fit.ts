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

  /**
   * Width of the widest laid-out line of the text itself.
   *
   * `scrollWidth` cannot answer this: on a block element it is never smaller
   * than the element's own content box, so comparing it against the container
   * always reports a fit. That left the width constraint dead - a single-line
   * headline a fraction too wide was never shrunk, it was silently cut off by
   * the box's overflow:hidden. A Range over the contents measures the real
   * glyph runs instead, one rect per line.
   */
  /**
   * The laid-out text itself: how wide its widest line runs, and how many lines
   * it takes.
   *
   * Both come from one Range over the contents, which reports a rectangle per
   * line box. `scrollWidth` cannot answer the first - on a block element it is
   * never smaller than the element's own content box, so it always reports a
   * fit, which left the width constraint dead and a headline a fraction too
   * wide was silently cut off by overflow:hidden.
   *
   * Counting those rectangles answers the second, and answers it the same at
   * any size. Measuring height instead - scrollHeight against line-height plus
   * a pixel - looked equivalent and was not: a one pixel tolerance is generous
   * in a 250px preview and nothing in a 1080px export, so text that fit on
   * screen was shrunk in the file. Accented capitals, which overflow their line
   * box, tipped it every time. Lines are lines at both sizes.
   */
  const measure = (): { widest: number; lines: number } => {
    const range = document.createRange();
    range.selectNodeContents(text);
    let widest = 0;
    const tops: number[] = [];
    for (const rect of range.getClientRects()) {
      if (rect.width > widest) widest = rect.width;
      // One line can produce several rectangles when the run is split; they
      // share a top edge, so near-equal tops are the same line.
      if (!tops.some((top) => Math.abs(top - rect.top) < rect.height * 0.5)) tops.push(rect.top);
    }
    range.detach();
    return { widest, lines: Math.max(1, tops.length) };
  };

  const fits = () => {
    const { widest, lines } = measure();
    if (lines > maxLines) return false;
    // Sub-pixel tolerance only. Anything larger reappears multiplied when the
    // design is exported at 1080px.
    return widest <= container.clientWidth + 0.5;
  };

  // Try the intended size first, at full line-height. Template sizes are
  // already written on the quarter, so this needs no rounding.
  setSize(maxSize, lineHeight);
  if (fits()) return;

  // Still try the intended size but with the tightened line-height, in case
  // only the vertical rhythm (not the width) was the problem.
  const tight = tightLineHeight ?? lineHeight;
  setSize(maxSize, tight);
  if (fits()) return;

  // Binary search the font size at the tight line-height, on a fixed ladder.
  //
  // The search used to converge on whatever exact number the measurements led
  // to, and those measurements are not identical at two sizes: glyph advances
  // do not scale perfectly linearly, so the same headline settled at, say,
  // 5.41cqw in a 250px preview and 5.36cqw in the 1080px export. A hundredth of
  // a unit is invisible - until it lands either side of a line break, and then
  // the export wraps onto two lines where the preview held one, and the whole
  // design shifts under it.
  //
  // Snapping every candidate to a quarter unit makes both passes land on the
  // same rung of the same ladder, so they break the same way. A quarter of a
  // cqw is about 2.7px at export size: below the threshold of noticing, and far
  // below the gap between one line and two.
  const step = 0.25;
  const rung = (value: number) => Math.max(minSize, Math.floor(value / step) * step);
  let lo = rung(minSize);
  let hi = maxSize;
  for (let i = 0; i < iterations; i++) {
    const mid = rung((lo + hi) / 2);
    if (mid <= lo) break;
    setSize(mid, tight);
    if (fits()) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  setSize(lo, tight);
}
