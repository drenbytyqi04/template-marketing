import { cn } from "@/lib/utils";
import logoBlack from "@/assets/Krijo24_logo_blackfont.png.asset.json";
import logoWhite from "@/assets/Krijo24_logo_whitefont.png.asset.json";
import iconBlack from "@/assets/Krijo24_icon_black.png.asset.json";
import iconWhite from "@/assets/Krijo24_icon_white.png.asset.json";

/**
 * krijo24 mark. `tone` picks the black or white artwork, `showWordmark`
 * switches between the full logo and the k24 icon.
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
  const src = showWordmark
    ? tone === "light"
      ? logoWhite.url
      : logoBlack.url
    : tone === "light"
      ? iconWhite.url
      : iconBlack.url;

  return (
    <img
      src={src}
      alt="krijo24"
      style={{ height }}
      className={cn("w-auto select-none object-contain", className)}
      draggable={false}
    />
  );
}
