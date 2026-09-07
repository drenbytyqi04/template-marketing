import { FitText } from "./FitText";
import type { BrandProfile, PostTextItem, TextSize } from "@/lib/rafty/types";

/** Container relative sizes, so preview and export are identical. */
const SIZE: Record<TextSize, number> = { small: 3.4, medium: 5, large: 7.2 };

const JUSTIFY = { left: "flex-start", center: "center", right: "flex-end" } as const;

/** Safe insets keep user text inside the template's clean margin. */
const BAND = {
  top: { top: "8%", alignItems: "flex-start" },
  middle: { top: "38%", alignItems: "center" },
  bottom: { top: "66%", alignItems: "flex-end" },
} as const;

/**
 * User placed extra lines. Rendered above the template in a constrained band
 * with a soft scrim, so the text always reads and the template's own design
 * can never be broken or overlapped illegibly.
 */
export function ExtraTextLayer({
  items,
  brand,
}: {
  items: PostTextItem[] | undefined;
  brand: BrandProfile;
}) {
  const visible = (items ?? []).filter((item) => item.text.trim());
  if (!visible.length) return null;

  return (
    <div className="pointer-events-none absolute inset-0">
      {visible.map((item) => {
        const band = BAND[item.band];
        return (
          <div
            key={item.id}
            style={{
              position: "absolute",
              left: "8%",
              right: "8%",
              top: band.top,
              height: "26%",
              display: "flex",
              flexDirection: "column",
              justifyContent: band.alignItems,
              alignItems: JUSTIFY[item.align],
            }}
          >
            <div
              style={{
                maxWidth: "100%",
                padding: "1.4cqw 2.2cqw",
                borderRadius: "2.4cqw",
                background: "rgba(9, 9, 14, 0.42)",
                backdropFilter: "blur(6px)",
                textAlign: item.align,
              }}
            >
              <FitText
                as="p"
                text={item.text}
                maxSize={SIZE[item.size]}
                minSize={SIZE[item.size] * 0.6}
                maxLines={3}
                lineHeight={1.25}
                style={{
                  color: "#ffffff",
                  fontFamily: brand.fontSecondary ?? brand.fontFamily,
                  fontWeight: 600,
                  textAlign: item.align,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
