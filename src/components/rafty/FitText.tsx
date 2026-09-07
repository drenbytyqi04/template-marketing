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
  className?: string;
};

/**
 * Auto-fit text block used by both preview and export (same DOM, so export
 * inherits whatever size the layout effect already converged to). Never
 * clips or overlaps: the outer box hides overflow while the inner element is
 * shrunk to fit, and very long single words are allowed to break.
 */
export function FitText({
  text,
  as = "div",
  maxSize,
  minSize,
  maxLines,
  lineHeight = 1.2,
  tightLineHeight,
  style,
  className,
}: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const box = boxRef.current;
    const el = textRef.current;
    if (!box || !el) return;

    const opts = {
      maxSize,
      minSize,
      maxLines,
      lineHeight,
      ...(tightLineHeight !== undefined ? { tightLineHeight } : {}),
    };
    const fit = () => {
      if (boxRef.current && textRef.current) fitTextToBox(boxRef.current, textRef.current, opts);
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
    <div ref={boxRef} style={{ overflow: "hidden", maxWidth: "100%" }}>
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
