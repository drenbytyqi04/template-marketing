import { toPng } from "html-to-image";
import { FONT_LIBRARY } from "./constants";
import {
  canExportVideo,
  renderVideoPosterToDataUrl,
  renderVideoPostToBlob,
  videoExtension,
} from "./video-export";
import { tagSrgbDataUrl } from "./png-srgb";
import { withOffscreenCopy } from "./offscreen";

/** Always embedded: every template declares these as its fallback faces. */
const ALWAYS_EMBEDDED = ["Sora", "Plus Jakarta Sans"];

/** Default export size, the standard 4:5 post. Other formats pass their own
 * size from the shared format table so there is still one pipeline. */
const EXPORT_WIDTH = 1080;
const EXPORT_HEIGHT = 1350;

export type ExportSize = { width: number; height: number };

/**
 * Google Fonts URL covering exactly the families this node renders with.
 *
 * A brand picks its own typeface from the whole curated library, and templates
 * apply it as `"<brand font>", "Sora", ...`. The exporter used to embed only
 * Sora and Plus Jakarta Sans, so any other brand font was absent from the clone
 * html-to-image rasterises. The text fell back to a face with different glyph
 * widths, rendered wider than the layout the preview had measured, and lost its
 * last character to the box's overflow:hidden - a headline read "Dubai" on
 * screen and "Duba" in the PNG. Collecting the faces actually in use makes the
 * capture render with the same typography as the screen.
 */
function fontCssUrlFor(node: HTMLElement): string {
  const used = new Set<string>(ALWAYS_EMBEDDED);
  const collect = (el: Element) => {
    const family = getComputedStyle(el).fontFamily;
    if (!family) return;
    for (const font of FONT_LIBRARY) {
      if (family.includes(font.family)) used.add(font.family);
    }
  };
  collect(node);
  for (const el of node.querySelectorAll("*")) collect(el);

  const query = FONT_LIBRARY.filter((f) => used.has(f.family))
    .map((f) => `family=${f.family.replace(/ /g, "+")}:wght@${f.weights}`)
    .join("&");
  return `https://fonts.googleapis.com/css2?${query}&display=swap`;
}

// Keyed by URL. A single shared slot would hand one brand's typefaces to the
// next brand's export.
const fontCssCache = new Map<string, string>();

/** Inline the brand webfonts as base64 so exported PNGs keep the typography. */
async function getFontEmbedCss(url: string): Promise<string> {
  const cached = fontCssCache.get(url);
  if (cached !== undefined) return cached;
  let out = "";
  try {
    const css = await (await fetch(url)).text();
    const fontUrls = [...new Set(css.match(/https:\/\/[^)]+\.woff2/g) ?? [])];
    out = css;
    await Promise.all(
      fontUrls.map(async (fontUrl) => {
        const buf = await (await fetch(fontUrl)).arrayBuffer();
        let binary = "";
        new Uint8Array(buf).forEach((b) => (binary += String.fromCharCode(b)));
        out = out.split(fontUrl).join(`data:font/woff2;base64,${btoa(binary)}`);
      }),
    );
  } catch (err) {
    // Do NOT cache the failure. A transient network blip would otherwise disable
    // font embedding for the rest of the session, and an export without the
    // brand's typeface silently falls back to a face with different glyph
    // widths - the exact failure that clipped headlines.
    console.warn("[export] Could not embed webfonts; this PNG may not match the preview.", err);
    return "";
  }
  fontCssCache.set(url, out);
  return out;
}

/**
 * Renders a node to a deterministic 1080x1350 PNG data url. This is the only
 * export implementation, shared by download and share so preview, save,
 * download and share always agree pixel for pixel.
 *
 * Every return goes out through `tagSrgbDataUrl`, so the one thing the canvas
 * leaves unsaid - which colour space the pixels are in - is written into the
 * file here rather than at each of the four call sites.
 */
export async function renderNodeToDataUrl(node: HTMLElement, size?: ExportSize): Promise<string> {
  return tagSrgbDataUrl(await rasterise(node, size));
}

/** The height this design lays out to at a given width, from the shape it has
 * on screen. A frame is one shape whatever size it is drawn at. */
function heightAt(node: HTMLElement, width: number): number {
  const box = node.getBoundingClientRect();
  if (box.width <= 0 || box.height <= 0) return EXPORT_HEIGHT;
  return Math.round(width * (box.height / box.width));
}

async function rasterise(node: HTMLElement, size?: ExportSize): Promise<string> {
  const outWidth = size?.width ?? EXPORT_WIDTH;

  // A cloned <video> paints nothing, so rasterising a video post this way would
  // return the design over an empty background. Composite a real frame instead.
  const posterVideo = node.querySelector("video");
  if (posterVideo && (posterVideo.currentSrc || posterVideo.getAttribute("src"))) {
    return renderVideoPosterToDataUrl(node, posterVideo, {
      width: outWidth,
      // Measured off the design, not defaulted. A caller that passes no size
      // used to get a feed post's 1350 here whatever the design was, so a still
      // taken from a 9:16 clip came back cropped by 570 pixels - the same cut
      // the picture path was fixed for, still open on this one.
      height: size?.height ?? heightAt(node, outWidth),
    });
  }

  const fontEmbedCSS = await getFontEmbedCss(fontCssUrlFor(node));

  // Laid out at the real export width on a copy, never on the design the
  // customer is looking at.
  //
  // Everything in a template is sized in `cqw`, relative to this node's inline
  // size, and FitText converges its font sizes against the width it can measure.
  // Rasterising a ~340px preview at ~3.2x asks the browser to extrapolate that
  // layout, and glyph advances do not scale perfectly linearly - text that fit
  // on screen ends up a fraction too wide in the PNG and the box's
  // overflow:hidden cuts the last character off. Widening a copy makes the
  // browser lay the design out at 1080px for real, and leaves the page alone.
  return withOffscreenCopy(node, outWidth, async (copy) => {
    // The frame is as tall as the design actually lays out, not as tall as the
    // caller believed it would be. A caller that passed nothing used to get
    // 1350 - the shape of a feed post - so a 9:16 story lost 570 pixels off its
    // bottom edge, taking the price and the phone number with them.
    const laidOut = Math.round(copy.getBoundingClientRect().height);
    const outHeight = laidOut > 0 ? laidOut : (size?.height ?? EXPORT_HEIGHT);

    const options = {
      width: outWidth,
      height: outHeight,
      pixelRatio: 1,
      canvasWidth: outWidth,
      canvasHeight: outHeight,
      cacheBust: true,
      // html-to-image copies the node's computed style onto its clone, which
      // would carry the off-screen parking above into the capture and draw the
      // design 100000px to the left of the canvas - a blank PNG. Neutralise
      // exactly those properties on the clone, keeping the export width.
      style: {
        position: "static",
        left: "auto",
        top: "auto",
        zIndex: "auto",
        margin: "0",
        width: `${outWidth}px`,
        maxWidth: "none",
      } as Partial<CSSStyleDeclaration>,
      ...(fontEmbedCSS ? { fontEmbedCSS } : { skipFonts: true }),
    };

    // html-to-image has a known first-pass race where fonts or images that
    // finish loading during the initial rasterization are missing from the
    // resulting canvas. A first, discarded render warms the browser's layout
    // and image cache so the second render is stable and deterministic.
    await toPng(copy, options);
    return await toPng(copy, options);
  });
}

/** Renders the post to a PNG Blob. This is the single export implementation;
 * download, share and any future save-to-device flow all call this. */
export async function renderPostToBlob(
  node: HTMLElement,
  filename: string,
  size?: ExportSize,
): Promise<Blob> {
  void filename; // kept in the signature so callers read intent at call sites
  const dataUrl = await renderNodeToDataUrl(node, size);
  return (await fetch(dataUrl)).blob();
}

/** The message to show when an export fails. The exporter raises reasons a
 * person can act on, so they are passed through rather than replaced with one
 * generic line. */
export function reasonFor(err: unknown): string {
  const message = err instanceof Error ? err.message.trim() : "";
  return message || "Could not prepare the download. Please try again.";
}

/** Exports a rendered post: a still, or a clip when the post carries footage.
 * Returns which of the two was saved so the caller can say so. */
export async function downloadNode(
  node: HTMLElement,
  filename: string,
  size?: ExportSize,
): Promise<"image" | "video"> {
  // A post built on uploaded footage exports as a clip, not a still. Detecting
  // the video here covers every download path - Create, Posts, share - because
  // they all come through this function.
  const video = node.querySelector("video");
  const isVideoPost = !!video?.currentSrc || !!video?.getAttribute("src");
  const blob =
    isVideoPost && video && canExportVideo()
      ? await renderVideoPostToBlob(node, video, size ?? { width: 1080, height: 1920 })
      : await renderPostToBlob(node, filename, size);
  // Named from what the file is, not from what the exporter used to produce.
  // Every clip was called .webm because WebM was once the only possible output;
  // now that an MP4 can come back, a fixed extension would put the wrong name on
  // it and a file named .webm holding MP4 opens nowhere.
  const extension = blob.type.startsWith("video/") ? videoExtension(blob) : "png";
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.${extension}`;
  a.rel = "noopener";
  a.style.display = "none";

  // Some browsers ignore a click on an anchor that was never in the document.
  document.body.appendChild(a);
  a.click();
  a.remove();

  // Revoking in the same tick as the click races the browser: if it has not
  // started reading the blob yet the download is dropped with no error, which is
  // why saving an image "sometimes" did nothing. Hold the URL until the transfer
  // has certainly begun.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return extension === "png" ? "image" : "video";
}

/** Same export, returned as a File so it can be handed to the Web Share API. */
export async function nodeToPngFile(
  node: HTMLElement,
  filename: string,
  size?: ExportSize,
): Promise<File> {
  const blob = await renderPostToBlob(node, filename, size);
  return new File([blob], `${filename}.png`, { type: "image/png" });
}

export function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "krijo24-post"
  );
}
