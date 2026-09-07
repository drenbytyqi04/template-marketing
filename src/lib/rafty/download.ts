import { toPng } from "html-to-image";

const FONT_CSS =
  "https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap";

// The embedded font CSS is immutable (same fonts for every post), so caching
// it module-wide is safe and does not bleed per-post state between exports.
let fontCssCache: string | null = null;

/** Default export size, the standard 4:5 post. Other formats pass their own
 * size from the shared format table so there is still one pipeline. */
const EXPORT_WIDTH = 1080;
const EXPORT_HEIGHT = 1350;

export type ExportSize = { width: number; height: number };

/** Inline the brand webfonts as base64 so exported PNGs keep the typography. */
async function getFontEmbedCss(): Promise<string> {
  if (fontCssCache !== null) return fontCssCache;
  try {
    const css = await (await fetch(FONT_CSS)).text();
    const urls = [...new Set(css.match(/https:\/\/[^)]+\.woff2/g) ?? [])];
    let out = css;
    await Promise.all(
      urls.map(async (url) => {
        const buf = await (await fetch(url)).arrayBuffer();
        let binary = "";
        new Uint8Array(buf).forEach((b) => (binary += String.fromCharCode(b)));
        out = out.split(url).join(`data:font/woff2;base64,${btoa(binary)}`);
      }),
    );
    fontCssCache = out;
  } catch {
    fontCssCache = "";
  }
  return fontCssCache;
}

/** Waits for every image inside the node to finish decoding, tolerating
 * broken or slow images instead of hanging the export. */
async function waitForImages(node: HTMLElement): Promise<void> {
  const imgs = Array.from(node.querySelectorAll("img"));
  await Promise.all(
    imgs.map(async (img) => {
      if (img.complete && img.naturalWidth > 0) return;
      try {
        await img.decode();
      } catch {
        await new Promise<void>((resolve) => {
          img.addEventListener("load", () => resolve(), { once: true });
          img.addEventListener("error", () => resolve(), { once: true });
        });
      }
    }),
  );
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

/**
 * Renders a node to a deterministic 1080x1350 PNG data url. This is the only
 * export implementation, shared by download and share so preview, save,
 * download and share always agree pixel for pixel.
 */
export async function renderNodeToDataUrl(
  node: HTMLElement,
  size?: ExportSize,
): Promise<string> {
  const outWidth = size?.width ?? EXPORT_WIDTH;
  const outHeight = size?.height ?? EXPORT_HEIGHT;
  const width = node.offsetWidth || node.getBoundingClientRect().width || 1;
  const fontEmbedCSS = await getFontEmbedCss();

  await document.fonts.ready;
  await waitForImages(node);
  await nextFrame();

  const options = {
    width,
    height: node.offsetHeight || Math.round((width * outHeight) / outWidth),
    pixelRatio: outWidth / width,
    canvasWidth: outWidth,
    canvasHeight: outHeight,
    cacheBust: true,
    ...(fontEmbedCSS ? { fontEmbedCSS } : { skipFonts: true }),
  };

  // html-to-image has a known first-pass race where fonts or images that
  // finish loading during the initial rasterization are missing from the
  // resulting canvas. A first, discarded render warms the browser's layout
  // and image cache so the second render is stable and deterministic.
  await toPng(node, options);
  return toPng(node, options);
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

/** Export a rendered post node as a 1080x1350 PNG. */
export async function downloadNode(node: HTMLElement, filename: string, size?: ExportSize) {
  const blob = await renderPostToBlob(node, filename, size);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.png`;
  a.click();
  URL.revokeObjectURL(url);
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

/**
 * Exports an ordered list of nodes (carousel slides) one after another with
 * the same deterministic single frame pipeline. Slides are rendered
 * sequentially from their own live DOM nodes, so one slide can never pick up
 * another slide's content or overwrite its file.
 */
export async function downloadNodes(
  nodes: HTMLElement[],
  filename: string,
  size?: ExportSize,
): Promise<number> {
  let done = 0;
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (!node) continue;
    await downloadNode(node, `${filename}-${String(i + 1).padStart(2, "0")}`, size);
    done++;
    // Small gap so browsers do not drop consecutive programmatic downloads.
    await new Promise((resolve) => setTimeout(resolve, 350));
  }
  return done;
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
