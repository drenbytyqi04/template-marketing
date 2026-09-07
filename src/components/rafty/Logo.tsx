import { cn } from "@/lib/utils";

/**
 * krijo24 mark, drawn inline as SVG.
 *
 * The upstream Lovable project stored the artwork as `.asset.json` pointers into
 * its own CDN (`/__l5e/assets-v1/...`), which 404s on any other host. Drawing the
 * wordmark here keeps it self-contained: no network request, no broken image, and
 * it stays crisp at every size.
 *
 * `tone` picks the black or white artwork, `showWordmark` switches between the
 * full logo and the k24 icon.
 */
export function Logo({
  className,
  showWordmark = true,
  height = 28,
  tone = "dark",
}: {
  className?: string;
  showWordmark?: boolean;
  height?: number;
  /** "dark" = black artwork for light surfaces, "light" = white artwork for dark surfaces. */
  tone?: "dark" | "light";
}) {
  const ink = tone === "light" ? "#ffffff" : "#0f1020";
  const accent = "#7c5cff";

  // The icon is a rounded tile with "k24" reversed out of it.
  if (!showWordmark) {
    return (
      <svg
        viewBox="0 0 64 64"
        role="img"
        aria-label="krijo24"
        style={{ height, width: height }}
        className={cn("select-none", className)}
      >
        <rect width="64" height="64" rx="16" fill={accent} />
        <text
          x="32"
          y="41"
          textAnchor="middle"
          fill="#ffffff"
          fontFamily='"Sora", ui-sans-serif, system-ui, sans-serif'
          fontSize="24"
          fontWeight="800"
          letterSpacing="-1"
        >
          k24
        </text>
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 200 56"
      role="img"
      aria-label="krijo24"
      style={{ height, width: "auto" }}
      className={cn("select-none", className)}
    >
      <rect y="4" width="48" height="48" rx="13" fill={accent} />
      <text
        x="24"
        y="37"
        textAnchor="middle"
        fill="#ffffff"
        fontFamily='"Sora", ui-sans-serif, system-ui, sans-serif'
        fontSize="19"
        fontWeight="800"
        letterSpacing="-0.8"
      >
        k24
      </text>
      <text
        x="60"
        y="37"
        fill={ink}
        fontFamily='"Sora", ui-sans-serif, system-ui, sans-serif'
        fontSize="27"
        fontWeight="700"
        letterSpacing="-1.1"
      >
        krijo
        <tspan fill={accent}>24</tspan>
      </text>
    </svg>
  );
}
