import { createElement, useLayoutEffect, useRef } from "react";
import { fitTextToBox } from "@/lib/rafty/fit";

type Props = {
  text: string;
  as?: "div" | "h2" | "h3" | "p" | "span";
  maxSize: number;
  minSize: number;
  maxLines: number;
  lineHeight?: number;
  tightLineHeight?: number;
  style?: React.CSSProperties;
  /** Style for the measuring box. A design that hands the text a share of a
   * fixed frame sets its height here, and the text is fitted to it. */
  boxStyle?: React.CSSProperties;
  className?: string;
};

/**
 * Auto-fit text block used by both preview and export (same DOM, so export
 * inherits whatever size the layout effect already converged to). Never
 * clips or overlaps: the outer box hides overflow while the inner element is
 * shrunk to fit, and very long single words are allowed to break.
 */

/**
 * How far outside its box a line is allowed to paint, as a share of its type
 * size.
 *
 * A box is laid out from advance widths and line heights, and a glyph's ink
 * does not stay inside either of them. An `f` in most faces hangs its terminal
 * past the width it advances; a `g` drops its tail below the line box, and a
 * headline set at a line-height of 0.96 has a line box shorter than the face's
 * own ascent and descent to begin with. The fit sizes the text so the advances
 * fit, then a box that clips at exactly its edges shaves the ink that was never
 * in the advances - which is what put a flat vertical slice through the `f` and
 * a flat cut under the `g` of a customer's headline, in the preview, in every
 * PNG and in every clip.
 *
 * An eighth of the type size clears a descender at the tight line-heights these
 * templates use. It is room to paint, not room to lay out: the box keeps its
 * size, so nothing below it moves, and text that genuinely does not fit is
 * still cut - an eighth of a line later than before.
 */
const INK = 0.16;
export function FitText({
  text,
  as = "div",
  maxSize,
  minSize,
  maxLines,
  lineHeight = 1.2,
  tightLineHeight,
  style,
  boxStyle,
  className,
}: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const box = boxRef.current;
    const el = textRef.current;
    if (!box || !el) return;

    const fit = () => {
      const node = boxRef.current;
      const el = textRef.current;
      if (!node || !el) return;
      // The ceiling the design set on this box, read from CSS rather than from
      // the laid out box, so it does not move as the text is resized.
      const cap = parseFloat(getComputedStyle(node).maxHeight);
      fitTextToBox(node, el, {
        maxSize,
        minSize,
        maxLines,
        lineHeight,
        ...(tightLineHeight !== undefined ? { tightLineHeight } : {}),
        ...(Number.isFinite(cap) ? { maxHeight: cap } : {}),
      });
    };

    // Fit now so the first paint is already close.
    fit();

    // Then fit again once the brand webfonts are actually in use. Measuring
    // against a fallback face and then exporting with the real one is what made
    // a title fit in the preview and lose its last glyph in the PNG.
    let cancelled = false;
    void document.fonts.ready.then(() => {
      if (!cancelled) fit();
    });

    // The preview box is responsive, and scrollWidth rounds to whole pixels, so
    // the converged size is only correct for the width it was measured at.
    const observer = new ResizeObserver(() => fit());
    observer.observe(box);

    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [text, maxSize, minSize, maxLines, lineHeight, tightLineHeight]);

  if (!text) return null;

  return (
    <div
      ref={boxRef}
      style={{
        // `clip` rather than `hidden` because only `clip` takes a margin, and
        // because the box is not scrollable in any case. It leaves the box's
        // own geometry alone - the width the text wraps at, the height cap the
        // fit measures against, `clientWidth` - and moves only where the
        // clipping happens.
        overflow: "clip",
        overflowClipMargin: `${(maxSize * INK).toFixed(2)}cqw`,
        maxWidth: "100%",
        ...boxStyle,
      }}
    >
      {createElement(
        as,
        {
          ref: textRef,
          className,
          style: {
            margin: 0,
            fontSize: `${maxSize}cqw`,
            lineHeight,
            wordBreak: "break-word",
            overflowWrap: "anywhere",
            ...style,
          },
        },
        text,
      )}
    </div>
  );
}
