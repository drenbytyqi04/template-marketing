/**
 * Draws the brand mark, in its own colours or in one the post chose.
 *
 * A recolour has to leave the stored logo alone - it belongs to one post, and
 * the next post, and the brand page, still want the real thing - so nothing
 * here writes a file. The mark is used as a mask over a block of colour, which
 * means the shape is still the uploaded logo at the uploaded resolution: its
 * alpha, including every antialiased edge, is exactly what decides where the
 * colour lands. Nothing is rasterised and nothing is resampled, so a recoloured
 * mark exports as sharply as the original at any size.
 *
 * The hidden `img` is what sizes the box. A masked element has no intrinsic
 * size of its own, so without it a caller asking for "this tall, width to
 * match" would get a mark of no width at all. The image still loads, still
 * reports its aspect ratio to the layout, and simply does not paint.
 */

type Props = {
  src: string;
  /** A css colour, or null/absent to paint the logo as it was uploaded. */
  tint?: string | null | undefined;
  /** Sizing, from whichever design is placing the mark. */
  style: React.CSSProperties;
};

export function BrandMark({ src, tint, style }: Props) {
  if (!tint) return <img src={src} alt="" crossOrigin="anonymous" style={style} />;

  const mask = `url("${src}")`;
  return (
    <span style={{ ...style, position: "relative", display: "inline-block", lineHeight: 0 }}>
      <img
        src={src}
        alt=""
        crossOrigin="anonymous"
        style={{
          display: "block",
          height: "100%",
          width: "auto",
          maxWidth: "100%",
          objectFit: "contain",
          visibility: "hidden",
        }}
      />
      {/* `contain` on both the image and the mask is what keeps the colour on
          the mark when the box is clamped by a maxWidth: the two letterbox the
          same way, so the painted shape sits exactly where the logo would. */}
      <span
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: tint,
          maskImage: mask,
          maskSize: "contain",
          maskRepeat: "no-repeat",
          maskPosition: "center",
          WebkitMaskImage: mask,
          WebkitMaskSize: "contain",
          WebkitMaskRepeat: "no-repeat",
          WebkitMaskPosition: "center",
        }}
      />
    </span>
  );
}
