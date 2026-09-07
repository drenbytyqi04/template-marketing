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
    fitTextToBox(box, el, {
      maxSize,
      minSize,
      maxLines,
      lineHeight,
      ...(tightLineHeight !== undefined ? { tightLineHeight } : {}),
    });
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
