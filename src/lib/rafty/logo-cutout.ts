/**
 * Lifts a logo off its background.
 *
 * Almost no customer has a transparent copy of their own logo. What they have
 * is the one from their printer, their sign maker or their Facebook page: the
 * mark on a white square, or on whatever flat colour the designer used. Placed
 * on a template that is not white, that square is the first thing anybody sees
 * - a bright rectangle sitting on the photograph, with the brand inside it.
 *
 * Doing it on the way in, once, is what makes it stay fixed. Every later
 * consumer - the templates, the exporter, the admin thumbnails - reads one
 * stored file, so there is no second place where a background could come back.
 *
 * What this is not: it is not segmentation. It does not know what a logo is,
 * and it will not cut a mark out of a photograph. It removes a *flat* border
 * colour, connected to the edge of the image, and it checks that the border
 * really is flat before it touches a pixel. Anything else is returned exactly
 * as it came in, because a logo with a background somebody can see is a far
 * smaller problem than a logo with a hole in it.
 */

/** How close a pixel must be to the background colour to be erased outright.
 * On the 0-255 scale of the colour distance below. Low: a flat background from
 * a real export varies by a point or two from JPEG noise, not by ten. */
const SOLID = 16;

/**
 * Past this, a pixel is the mark and is left alone. Between the two it is an
 * antialiased edge: it gets partial alpha plus the fringe correction below,
 * which is what keeps a cut-out mark's edges smooth instead of jagged.
 *
 * Half the scale, which is not arbitrary. A soft edge between a mark and its
 * background is a straight blend of the two, so a pixel's distance from the
 * background *is* how much of the mark is in it - erasing a pixel at a quarter
 * of the way across is exactly as wrong as leaving one at three quarters fully
 * opaque. Stopping at the halfway point takes the outer, paler half of every
 * soft edge, which is the half that shows as a halo, and leaves the inner half
 * alone, because that is also where a logo's own mid-tones live: a grey mark on
 * white is only half the scale from its background, and must not be treated as
 * a background pixel that went slightly wrong.
 */
const EDGE = 128;

/** How much of the border has to be the same colour before this will run. A
 * photograph, a gradient or a mark that already bleeds off its own edge all
 * fail this, and are left alone. */
const BORDER_AGREEMENT = 0.86;

/** Already-transparent border this fraction or more: the file is a proper
 * cut-out already and there is nothing here to do. */
const ALREADY_CLEAR = 0.6;

/** Alpha at or below this counts as nothing there. Matches logo-trim. */
const EMPTY_ALPHA = 8;

/** A flood fill allocates five bytes a pixel and blocks the tab while it runs.
 * Past this the freeze costs more than the background does, and a file this
 * large is not a logo. Deliberately not a downscale: the point of this step is
 * a logo that still looks like itself. */
const MAX_PIXELS = 12_000_000;

function load(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read the image."));
    img.src = dataUrl;
  });
}

/** Distance between two colours, on the same 0-255 scale as a channel, so the
 * tolerances above read as "this many levels off". */
function distance(r: number, g: number, b: number, to: [number, number, number]) {
  const dr = r - to[0];
  const dg = g - to[1];
  const db = b - to[2];
  return Math.sqrt((dr * dr + dg * dg + db * db) / 3);
}

/**
 * The colour the border agrees on, or null if it does not agree.
 *
 * Buckets every border pixel 16 levels to a side, takes the fullest bucket, and
 * then averages the pixels in it - the bucket finds the colour, the average
 * gives it back its precision, which matters because the tolerances are tight.
 */
function borderColour(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): [number, number, number] | null {
  const buckets = new Map<number, { n: number; r: number; g: number; b: number }>();
  let counted = 0;
  let clear = 0;

  const look = (x: number, y: number) => {
    const i = (y * width + x) * 4;
    counted += 1;
    if (data[i + 3]! <= EMPTY_ALPHA) {
      clear += 1;
      return;
    }
    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const slot = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    slot.n += 1;
    slot.r += r;
    slot.g += g;
    slot.b += b;
    buckets.set(key, slot);
  };

  for (let x = 0; x < width; x += 1) {
    look(x, 0);
    look(x, height - 1);
  }
  for (let y = 1; y < height - 1; y += 1) {
    look(0, y);
    look(width - 1, y);
  }

  if (!counted || clear / counted >= ALREADY_CLEAR) return null;

  let best: { n: number; r: number; g: number; b: number } | null = null;
  for (const slot of buckets.values()) if (!best || slot.n > best.n) best = slot;
  if (!best) return null;

  const colour: [number, number, number] = [
    Math.round(best.r / best.n),
    Math.round(best.g / best.n),
    Math.round(best.b / best.n),
  ];

  // The bucket boundary is arbitrary, so agreement is measured against the
  // colour itself and not against the bucket: a background sitting astride two
  // buckets is still a flat background.
  let agree = 0;
  const check = (x: number, y: number) => {
    const i = (y * width + x) * 4;
    if (data[i + 3]! <= EMPTY_ALPHA) {
      agree += 1;
      return;
    }
    if (distance(data[i]!, data[i + 1]!, data[i + 2]!, colour) <= SOLID) agree += 1;
  };
  for (let x = 0; x < width; x += 1) {
    check(x, 0);
    check(x, height - 1);
  }
  for (let y = 1; y < height - 1; y += 1) {
    check(0, y);
    check(width - 1, y);
  }

  return agree / counted >= BORDER_AGREEMENT ? colour : null;
}

export async function removeFlatBackground(dataUrl: string): Promise<string> {
  try {
    // An SVG has no pixels to read and usually no background to remove;
    // rasterising it here would cost it every resolution it has.
    if (!dataUrl.startsWith("data:image/") || dataUrl.startsWith("data:image/svg+xml")) {
      return dataUrl;
    }

    const img = await load(dataUrl);
    const width = img.naturalWidth;
    const height = img.naturalHeight;
    if (width < 3 || height < 3 || width * height > MAX_PIXELS) return dataUrl;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return dataUrl;
    ctx.drawImage(img, 0, 0);

    const image = ctx.getImageData(0, 0, width, height);
    const data = image.data;
    const bg = borderColour(data, width, height);
    if (!bg) return dataUrl;

    // Connected to the edge, so an enclosed shape keeps its fill: a white
    // counter inside an O, or a white letter on a dark badge, is not reachable
    // from the border and is never touched.
    const pixels = width * height;
    const seen = new Uint8Array(pixels);
    const queue = new Int32Array(pixels);
    let head = 0;
    let tail = 0;

    const consider = (index: number) => {
      if (seen[index]) return;
      seen[index] = 1;
      const i = index * 4;
      if (data[i + 3]! <= EMPTY_ALPHA) {
        queue[tail++] = index;
        return;
      }
      const d = distance(data[i]!, data[i + 1]!, data[i + 2]!, bg);
      if (d > EDGE) return;

      if (d <= SOLID) {
        data[i + 3] = 0;
        queue[tail++] = index;
        return;
      }

      // An antialiased edge pixel: part mark, part background. Its alpha is how
      // far along it is, and its colour is then the mark's own colour rather
      // than the blend - without that correction a mark cut off a white square
      // keeps a pale halo, which is the giveaway that something was removed.
      const alpha = (d - SOLID) / (EDGE - SOLID);
      const unmix = (channel: number, back: number) =>
        Math.max(0, Math.min(255, Math.round((channel - (1 - alpha) * back) / alpha)));
      data[i] = unmix(data[i]!, bg[0]);
      data[i + 1] = unmix(data[i + 1]!, bg[1]);
      data[i + 2] = unmix(data[i + 2]!, bg[2]);
      data[i + 3] = Math.round(alpha * data[i + 3]!);
      // Not a seed: expanding through a half-transparent pixel is how a fill
      // leaks into the mark through its own soft edge.
    };

    for (let x = 0; x < width; x += 1) {
      consider(x);
      consider((height - 1) * width + x);
    }
    for (let y = 0; y < height; y += 1) {
      consider(y * width);
      consider(y * width + width - 1);
    }

    while (head < tail) {
      const index = queue[head++]!;
      const x = index % width;
      const y = (index - x) / width;
      if (x > 0) consider(index - 1);
      if (x < width - 1) consider(index + 1);
      if (y > 0) consider(index - width);
      if (y < height - 1) consider(index + width);
    }

    // Nothing opaque survived: the whole file was one colour. Returning an
    // empty image would replace a visible mistake with an invisible one.
    let anyInk = false;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i]! > EMPTY_ALPHA) {
        anyInk = true;
        break;
      }
    }
    if (!anyInk) return dataUrl;

    ctx.putImageData(image, 0, 0);
    // PNG whatever came in: the alpha this just wrote is the entire point, and
    // JPEG has nowhere to keep it.
    return canvas.toDataURL("image/png");
  } catch {
    // A logo that cannot be cut out is still a perfectly good logo.
    return dataUrl;
  }
}
