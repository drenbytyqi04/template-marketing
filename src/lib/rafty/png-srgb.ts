/**
 * Marks an exported PNG as sRGB.
 *
 * The canvas writes correct pixels - a measured export matches the design on
 * screen to within one value out of 255 - but it writes them with no colour
 * space attached: the file goes straight from IHDR to IDAT with no `sRGB`,
 * `iCCP`, `gAMA` or `cHRM` chunk. An untagged PNG leaves every viewer free to
 * guess what those numbers mean. A browser assumes sRGB and shows the brand
 * colour. Windows Photos on a wide gamut or HDR screen, and some upload
 * pipelines, treat the numbers as already being in the display's own space and
 * skip the conversion, so a brand magenta arrives washed out or shifted - the
 * same file, read two different ways.
 *
 * Stating sRGB takes that choice away: a colour managed viewer now converts
 * from a known space to the monitor instead of inventing one. `gAMA` and
 * `cHRM` carry the same statement for older readers that ignore `sRGB`, which
 * is what libpng recommends writing alongside it.
 */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** One PNG chunk: length, type, data, CRC over type and data. */
function chunk(type: string, data: number[]): Uint8Array {
  const body = new Uint8Array(4 + data.length);
  for (let i = 0; i < 4; i++) body[i] = type.charCodeAt(i);
  body.set(data, 4);
  const out = new Uint8Array(8 + data.length + 4);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  out.set(body, 4);
  view.setUint32(out.length - 4, crc32(body));
  return out;
}

function be32(value: number): number[] {
  return [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff];
}

/** Rendering intent 0, perceptual: what a photograph with a design over it wants. */
const SRGB = chunk("sRGB", [0]);
/** 1/2.2, in PNG's hundred-thousandths. */
const GAMA = chunk("gAMA", be32(45455));
/** The sRGB white point and primaries, in the same units. */
const CHRM = chunk("cHRM", [31270, 32900, 64000, 33000, 30000, 60000, 15000, 6000].flatMap(be32));

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
const ALREADY_TAGGED = new Set(["sRGB", "iCCP", "gAMA", "cHRM"]);

/** Inserts the colour space chunks after IHDR. Returns the bytes unchanged if
 * this is not a PNG, or if it already says what space it is in. */
export function tagSrgb(bytes: Uint8Array): Uint8Array {
  if (bytes.length < 8 || PNG_SIGNATURE.some((b, i) => bytes[i] !== b)) return bytes;

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const typeAt = (offset: number) =>
    String.fromCharCode(
      bytes[offset + 4]!,
      bytes[offset + 5]!,
      bytes[offset + 6]!,
      bytes[offset + 7]!,
    );

  let offset = 8;
  if (typeAt(offset) !== "IHDR") return bytes;
  const afterIhdr = offset + 12 + view.getUint32(offset);

  // Colour space chunks must precede IDAT, so that is as far as this has to look.
  offset = afterIhdr;
  while (offset + 8 <= bytes.length) {
    const type = typeAt(offset);
    if (type === "IDAT" || type === "IEND") break;
    if (ALREADY_TAGGED.has(type)) return bytes;
    offset += 12 + view.getUint32(offset);
  }

  const added = SRGB.length + GAMA.length + CHRM.length;
  const out = new Uint8Array(bytes.length + added);
  out.set(bytes.subarray(0, afterIhdr), 0);
  out.set(SRGB, afterIhdr);
  out.set(GAMA, afterIhdr + SRGB.length);
  out.set(CHRM, afterIhdr + SRGB.length + GAMA.length);
  out.set(bytes.subarray(afterIhdr), afterIhdr + added);
  return out;
}

/** The same, for a base64 PNG data url. Tagging must never be the reason an
 * export fails, so anything unexpected hands the original url back. */
export function tagSrgbDataUrl(dataUrl: string): string {
  const marker = ";base64,";
  const at = dataUrl.indexOf(marker);
  if (!dataUrl.startsWith("data:image/png") || at < 0) return dataUrl;
  try {
    const binary = atob(dataUrl.slice(at + marker.length));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const tagged = tagSrgb(bytes);
    if (tagged === bytes) return dataUrl;
    let out = "";
    const CHUNK = 0x8000; // btoa on one huge string blows the argument limit
    for (let i = 0; i < tagged.length; i += CHUNK) {
      out += String.fromCharCode(...tagged.subarray(i, i + CHUNK));
    }
    return `data:image/png;base64,${btoa(out)}`;
  } catch {
    return dataUrl;
  }
}
