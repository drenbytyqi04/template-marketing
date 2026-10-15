import { cn } from "@/lib/utils";

/**
 * The krijo24 mark.
 *
 * One drawing, used in every place the product signs its own name: the app
 * header, the marketing header and footer, the sign-in page, onboarding, the
 * admin screen and the opening splash. It is the same file the browser puts in
 * the tab, referenced rather than copied, so the tab and the page can never
 * drift apart into two marks that are nearly but not quite the same thing -
 * which is what they were.
 *
 * The square alone, with no wordmark beside it. The name is carried by the
 * `alt` text, which matters more than it used to: with the lettering gone,
 * that string is the only place a screen reader finds what this is.
 *
 * It is a 64 pixel raster, so it is sharp up to about that size on an ordinary
 * screen and about half that on a dense one. Nothing here asks for more than
 * 64; a larger drawing, or the same mark as SVG, would be the thing to swap in
 * if it ever does.
 */
export function Logo({ className, height = 28 }: { className?: string; height?: number }) {
  return (
    <img
      src="/favicon.png"
      alt="krijo24"
      width={height}
      height={height}
      // The mark is square. Stating both ends of it means the space is already
      // the right shape before the file has loaded, so nothing beside it jumps
      // when it arrives.
      style={{ height, width: height }}
      className={cn("select-none", className)}
      draggable={false}
    />
  );
}
