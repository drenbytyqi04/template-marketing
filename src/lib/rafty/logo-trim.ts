/**
 * Crops the empty border off an uploaded logo.
 *
 * Logo files almost never arrive as just the mark. A brand kit exports it
 * centred on a square canvas, a designer leaves the clear space around it baked
 * into the PNG, an "export selection" keeps the artboard. None of that is
 * visible on a white page, so nobody notices - until the file is placed in a
 * template, where the box the design reserves is sized to the *file*, and the
 * mark inside it paints at whatever fraction of that box the exporter happened
 * to leave. A logo with 40% padding renders at 60% of the size the design asked
 * for, and no amount of adjusting the template fixes it, because the template
 * is already doing what it was told.
 *
 * Trimming once, on the way in, is what makes the design system's sizes mean
 * what they say: from here on, "the mark is 8cqw tall" is true of the mark and
 * not of a canvas it happens to sit on.
 *
 * Only fully transparent edges are cut. An opaque image - a JPEG, or a PNG with
 * a painted white background - has no border this can identify without guessing
 * at what its background colour is, so it is returned exactly as it came in.
 */

/** Alpha at or below this counts as empty. Not zero: exporters leave a fringe
 * of near-transparent antialiasing around a mark, and treating that as content
 * would find a bounding box a pixel or two outside the one a person sees. */
const EMPTY_ALPHA = 8;

/** Below this much saving, the crop is not worth a re-encode. A file already
 * trimmed to its mark comes back byte for byte what it was. */
const WORTH_TRIMMING = 0.98;

/** A scan allocates 4 bytes a pixel and blocks the tab while it runs. Past this
 * the freeze is worse than the padding; such a file is not a logo anyway. */
const MAX_PIXELS = 40_000_000;

function load(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read the image."));
    img.src = dataUrl;
  });
}

export async function trimTransparentEdges(dataUrl: string): Promise<string> {
  try {
    // An SVG is resolution independent; rasterising it here would throw that
    // away to remove padding that costs nothing at any size.
    if (!dataUrl.startsWith("data:image/") || dataUrl.startsWith("data:image/svg+xml")) {
      return dataUrl;
    }

    const img = await load(dataUrl);
    const width = img.naturalWidth;
    const height = img.naturalHeight;
    if (!width || !height || width * height > MAX_PIXELS) return dataUrl;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return dataUrl;
    ctx.drawImage(img, 0, 0);

    const { data } = ctx.getImageData(0, 0, width, height);
    let top = height;
    let left = width;
    let right = -1;
    let bottom = -1;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if (data[(y * width + x) * 4 + 3]! <= EMPTY_ALPHA) continue;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
        if (x < left) left = x;
        if (x > right) right = x;
      }
    }

    // Nothing opaque at all: a blank file, or one this cannot read. Cropping it
    // to an empty box would turn a visible mistake into an invisible one.
    if (right < left || bottom < top) return dataUrl;

    const cropWidth = right - left + 1;
    const cropHeight = bottom - top + 1;
    if (cropWidth >= width * WORTH_TRIMMING && cropHeight >= height * WORTH_TRIMMING) {
      return dataUrl;
    }

    const out = document.createElement("canvas");
    out.width = cropWidth;
    out.height = cropHeight;
    const outCtx = out.getContext("2d");
    if (!outCtx) return dataUrl;
    outCtx.drawImage(canvas, left, top, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
    // PNG, whatever came in: the alpha this just measured is the whole point,
    // and re-encoding it as JPEG would fill it with black.
    return out.toDataURL("image/png");
  } catch {
    // A logo that cannot be trimmed is still a perfectly good logo. Nothing
    // here is worth failing an upload over.
    return dataUrl;
  }
}
