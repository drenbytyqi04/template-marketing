import { toPng } from "html-to-image";
import { ARRIVAL_ATTR, introAt, introDurationMs, STILL_ATTR } from "./design/animation";

/**
 * Renders a video post to a real clip.
 *
 * The design is static for the duration, so it is rasterised once and then
 * composited onto every frame of the footage. Frames are drawn to a canvas whose
 * stream, plus the clip's own audio, is captured by MediaRecorder.
 *
 * Capture is real time by construction: MediaRecorder records a live stream, so a
 * fifteen second clip takes fifteen seconds. The container is MP4 wherever the
 * browser can encode H.264, and WebM where it cannot.
 */

export type VideoExportSize = { width: number; height: number };

/** Where the footage sits inside the exported frame, in output pixels. Most
 * templates run it full bleed, some inset it (letterbox). */
type FootageRect = { x: number; y: number; width: number; height: number };

/**
 * The design as a pair of per pixel maps.
 *
 * Everything a template puts around the footage composites linearly onto it:
 * `pixel = gain * footage + constant`, where the gain is how much of the clip
 * still shows through at that pixel (its own opacity times the transmittance of
 * every scrim and title above it) and the constant is everything the design
 * contributes on its own - the backdrop showing through a dimmed clip, a
 * gradient, the type.
 */
/** One part of the design, solved on its own so it can arrive on its own.
 * Everywhere the part does not draw, gain is full and constant is nothing, which
 * is the identity of the compositing model: the footage passes through. */
type Layer = {
  gain: HTMLCanvasElement;
  constant: HTMLCanvasElement;
  /** This line's place in the arrival order, read from the document rather than
   * counted here: lines the post left empty are in the document but have no
   * layer, so counting would put every later line on the wrong beat. */
  arrival: number;
  /** Where this piece belongs, in overlay pixels. Only the box the part draws
   * in is kept: everywhere else was the identity of the compositing model, and
   * a full frame of identity is eight megabytes of nothing. */
  x: number;
  y: number;
  width: number;
  height: number;
};

/**
 * A line's box, in overlay pixels: its own rectangle and not a pixel more.
 *
 * It used to be given a margin, for a shadow or a soft edge falling outside the
 * element. That margin was wider than the gap between two lines, so neighbouring
 * boxes overlapped by about twenty pixels - and a line's answer, solved with the
 * others hidden, holds only the picture where those others would be. Drawing a
 * line therefore rubbed out a strip of the line above it, which read as a band
 * moving with the wipe and was exactly what a customer photographed twice.
 *
 * Lines are laid out as siblings with a gap, so their own rectangles never
 * overlap. Anything a line paints outside its rectangle is lost for the length
 * of the intro, and these designs paint nothing there.
 */
function boxOf(
  el: HTMLElement,
  nodeBox: DOMRect,
  scale: number,
  size: VideoExportSize,
): { x: number; y: number; width: number; height: number } {
  const r = el.getBoundingClientRect();
  const x = Math.max(0, Math.floor((r.left - nodeBox.left) * scale));
  const y = Math.max(0, Math.floor((r.top - nodeBox.top) * scale));
  const right = Math.min(size.width, Math.ceil((r.right - nodeBox.left) * scale));
  const bottom = Math.min(size.height, Math.ceil((r.bottom - nodeBox.top) * scale));
  return { x, y, width: Math.max(1, right - x), height: Math.max(1, bottom - y) };
}

function cropTo(
  source: HTMLCanvasElement,
  box: { x: number; y: number; width: number; height: number },
): HTMLCanvasElement {
  const out = document.createElement("canvas");
  out.width = box.width;
  out.height = box.height;
  const ctx = out.getContext("2d");
  if (!ctx) return source;
  ctx.drawImage(source, box.x, box.y, box.width, box.height, 0, 0, box.width, box.height);
  return out;
}

/**
 * Bits a second for a frame of this size, at the rate it is recorded.
 *
 * Left unset, a browser picks one number for every clip - Chrome settles near
 * 2.5 Mbps whether the frame is 480p or 1080p - and a vertical 1080 export came
 * back at 2242 kb/s, heavy compression on two million pixels, softer than the
 * footage that went in.
 *
 * Asking for a great deal more turned out to cost more than it bought. At
 * roughly a fifth of a bit per pixel per frame - near 12 Mbps on a vertical
 * 1080 frame - the encoder could not keep up with a live recording and the clip
 * came back at 16.5 frames a second instead of 30. A stuttering clip is a worse
 * picture than a slightly softer one, and the extra bits were being spent on
 * something no one would see anyway: a feed re-encodes what it is given, and
 * keeps nothing like that rate. A tenth of a bit per pixel per frame is around
 * 6 Mbps here, comfortably past what the destination keeps and comfortably
 * inside what a browser can encode live.
 */
function bitrateFor(size: VideoExportSize): number {
  const perFrame = size.width * size.height * 0.1;
  return Math.round(Math.min(8_000_000, Math.max(2_500_000, perFrame * CAPTURE_FPS)));
}

/** Frames a second the clip is drawn and recorded at. Thirty is what a feed
 * plays, what an encoder keeps up with, and what a phone expects. */
const CAPTURE_FPS = 30;
const FRAME_MS = 1000 / CAPTURE_FPS;

type Overlay = {
  gain: HTMLCanvasElement;
  constant: HTMLCanvasElement;
  rect: FootageRect;
  /**
   * Everything the design draws that does not arrive: the treatment over the
   * photograph, a block's panel, anything not a line of type.
   *
   * Without it the intro drew the lines and nothing else, so a clip began with
   * no scrim under its type and then, the instant the last line landed, the
   * whole treatment appeared in a single frame. Measured on a customer's
   * export: the bottom of the frame held steady at 107 for the whole intro and
   * dropped to 35 between two frames. The shadow belongs to the picture, not to
   * the writing, so it is there from the first frame and never moves.
   */
  base?: { gain: HTMLCanvasElement; constant: HTMLCanvasElement };
  /** The design taken apart, in the order its parts arrive. Absent when nothing
   * is animating, and unused once the intro has finished - the whole design in
   * one piece is two draws a frame, and taking it apart is five times that. */
  layers?: Layer[];
};

/**
 * The best container and codec this browser will actually encode.
 *
 * MP4 with H.264 leads, because that is the file people can use: it opens on a
 * phone, it uploads to Instagram, it drops into any editor. WebM does none of
 * those reliably, and a clip nobody can post is not an export.
 *
 * H.264 is asked for by name rather than by container. Requesting bare
 * "video/mp4" reports supported on builds that have no H.264 encoder at all and
 * then hands back VP9 inside an MP4 - measured, not assumed: a test recording
 * on Chromium 141 came out carrying a `vp09` sample entry. That file has the
 * right extension and fails everywhere the extension promised it would work,
 * which is worse than an honest WebM. Bare "video/mp4" still appears, last of
 * the MP4 options, because Safari answers only to that spelling and does
 * produce H.264 - the ordering means it is reached only when no explicit H.264
 * string was accepted.
 *
 * VP8 leads the WebM fallbacks rather than VP9. isTypeSupported answers whether
 * the browser knows the codec, not whether it can encode a 1080x1920 stream in
 * real time on this machine, and a VP9 encoder that cannot keep up gives up part
 * way: the recorder emits its first chunk and then errors, which lands as a file
 * holding a single frame. VP8 is the encoder every browser that offers
 * MediaRecorder has actually shipped.
 */
function pickMimeType(): string | undefined {
  const candidates = [
    // High profile first, at a level that actually covers a vertical 1080 frame.
    //
    // This used to ask only for avc1.42E01E, which is baseline at level 3.0 -
    // a level that tops out around 720x576, declared on a clip four times that
    // size, in a profile with neither CABAC nor B-frames. Baseline needs a good
    // deal more bitrate than High for the same picture, and a customer's export
    // came back visibly softer than the footage that went into it. Each of these
    // is offered in turn and the browser takes the first it can honestly encode,
    // so a browser with only baseline still gets a file.
    "video/mp4;codecs=avc1.640028,mp4a.40.2",
    "video/mp4;codecs=avc1.640028",
    "video/mp4;codecs=avc1.4d0028,mp4a.40.2",
    "video/mp4;codecs=avc1.4d0028",
    "video/mp4;codecs=avc1.42E028,mp4a.40.2",
    "video/mp4;codecs=avc1.42E028",
    "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
    "video/mp4;codecs=avc1.42E01E",
    "video/mp4;codecs=avc1",
    "video/mp4;codecs=h264",
    "video/mp4",
    "video/webm;codecs=vp8,opus",
    "video/webm;codecs=vp8",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp9",
    "video/webm",
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type));
}

/**
 * The file extension a blob has earned, from what it actually is.
 *
 * The download used to name every clip `.webm` because that was the only thing
 * the recorder produced. Now that it can produce either, the name has to follow
 * the bytes: a `.mp4` holding WebM is a file that opens nowhere.
 */
export function videoExtension(blob: Blob): "mp4" | "webm" {
  return blob.type.includes("mp4") ? "mp4" : "webm";
}

/**
 * Whether an MP4 really carries H.264.
 *
 * Only a warning, never a reason to refuse the file: it plays in a browser
 * either way, and re-recording to find out would cost the person the whole
 * length of their clip a second time. It exists so that if someone reports a
 * clip Instagram would not take, the reason is already in the console.
 */
async function warnIfNotH264(blob: Blob): Promise<void> {
  if (!blob.type.includes("mp4")) return;
  try {
    const head = new Uint8Array(await blob.slice(0, 4096).arrayBuffer());
    let text = "";
    for (const byte of head) text += String.fromCharCode(byte);
    if (text.includes("avc1")) return;
    const codec = ["vp09", "vp08", "av01", "hvc1"].find((name) => text.includes(name));
    console.warn(
      `[video-export] This browser wrote ${codec ?? "an unknown codec"} into the MP4 rather than ` +
        "H.264. The clip plays in a browser but some platforms will refuse it.",
    );
  } catch {
    /* a sniff that fails tells us nothing, and must not fail the export */
  }
}

export function canExportVideo(): boolean {
  return (
    typeof MediaRecorder !== "undefined" &&
    typeof HTMLCanvasElement.prototype.captureStream === "function" &&
    !!pickMimeType()
  );
}

/** What the stand-in has to reproduce exactly: its box, so the design around the
 * footage lands on the same pixels it does on screen, and the styling the
 * template applies to the clip itself, so a dimmed or filtered media layer
 * exports as dimmed rather than at full strength. */
const GEOMETRY_PROPS = [
  "opacity",
  "filter",
  "position",
  "top",
  "right",
  "bottom",
  "left",
  "width",
  "height",
  "margin",
  "transform",
  "transform-origin",
  "z-index",
  "border-radius",
  "clip-path",
  "mix-blend-mode",
] as const;

/**
 * Swaps the footage for a flat block of one colour.
 *
 * The design has to be rasterised without the moving picture in it, but simply
 * hiding the <video> is what buried the footage in every export: a hidden element
 * paints nothing, so whatever the template draws *behind* the clip - a black
 * luxury backdrop, a letterbox mat, a brand wash - ended up baked into the design
 * layer and covered the very frames it was supposed to sit on. A stand-in of a
 * known colour occupies the same box, so those layers stay hidden and the
 * rasteriser reports exactly which pixels belong to the footage.
 */
function standIn(video: HTMLVideoElement, color: string): () => void {
  const computed = getComputedStyle(video);
  const block = document.createElement("div");
  for (const prop of GEOMETRY_PROPS) {
    block.style.setProperty(prop, computed.getPropertyValue(prop));
  }
  block.style.background = color;
  video.parentElement?.insertBefore(block, video);
  return () => block.remove();
}

async function rasterise(
  node: HTMLElement,
  size: VideoExportSize,
  skip: HTMLElement,
): Promise<{ ctx: CanvasRenderingContext2D; data: Uint8ClampedArray }> {
  const dataUrl = await toPng(node, {
    // The footage is drawn per frame, and the element itself must not reach the
    // clone: html-to-image rasterises a <video> by drawing its current frame, so
    // the design layer would come back with one frame burnt into it.
    filter: (element) => element !== skip,
    width: size.width,
    height: size.height,
    canvasWidth: size.width,
    canvasHeight: size.height,
    pixelRatio: 1,
    cacheBust: true,
    // html-to-image copies the node's computed style onto its clone. If the node
    // is parked off-screen the design gets drawn far outside the canvas and the
    // capture comes back empty.
    style: {
      position: "static",
      left: "auto",
      top: "auto",
      zIndex: "auto",
      margin: "0",
      width: `${size.width}px`,
      maxWidth: "none",
    } as Partial<CSSStyleDeclaration>,
  });
  const img = new Image();
  img.src = dataUrl;
  await img.decode();
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get a drawing context.");
  ctx.drawImage(img, 0, 0, size.width, size.height);
  return { ctx, data: ctx.getImageData(0, 0, size.width, size.height).data };
}

/**
 * Measures the design against the footage box.
 *
 * Rasterising the same design twice, once with a black stand-in where the clip
 * plays and once with a white one, solves the compositing at every pixel: a pixel
 * the design covers completely reads the same in both, one where the clip plays
 * unobstructed differs by the full range, and a half transparent scrim differs by
 * half. So `gain = (white - black) / 255` and `constant = black`.
 *
 * Hiding the <video> instead - what this used to do - is what buried the footage
 * in every export: a hidden element paints nothing, so whatever the template
 * draws *behind* the clip (a black luxury backdrop, a letterbox mat, a brand
 * wash) was baked into the design layer and covered the very frames it was
 * supposed to sit on.
 */
async function buildOverlay(
  node: HTMLElement,
  video: HTMLVideoElement,
  size: VideoExportSize,
): Promise<Overlay> {
  const saved = {
    width: node.style.width,
    maxWidth: node.style.maxWidth,
    position: node.style.position,
    left: node.style.left,
    top: node.style.top,
    zIndex: node.style.zIndex,
  };

  try {
    // Every pass below has to see the same, settled design. The parts arrive
    // over the first second of a clip, and a solve taken while they are arriving
    // would bake that moment into the layer it was meant to describe.
    node.setAttribute(STILL_ATTR, "");
    // Lay the design out at the real export width, off-screen so the page does
    // not visibly jump. Every template is sized in cqw against this node, so
    // this makes the raster a 1:1 capture instead of an upscale.
    node.style.position = "fixed";
    node.style.left = "-100000px";
    node.style.top = "0";
    node.style.zIndex = "-1";
    node.style.maxWidth = "none";
    node.style.width = `${size.width}px`;
    node.getBoundingClientRect();
    await new Promise((r) => requestAnimationFrame(() => r(null)));

    const nodeBox = node.getBoundingClientRect();
    const videoBox = video.getBoundingClientRect();
    const scale = nodeBox.width > 0 ? size.width / nodeBox.width : 1;
    const rect: FootageRect = {
      x: (videoBox.left - nodeBox.left) * scale,
      y: (videoBox.top - nodeBox.top) * scale,
      width: videoBox.width * scale,
      height: videoBox.height * scale,
    };

    const solve = async (): Promise<{ gain: HTMLCanvasElement; constant: HTMLCanvasElement }> => {
      let restore = standIn(video, "#000000");
      let black: Uint8ClampedArray;
      try {
        black = (await rasterise(node, size, video)).data;
      } finally {
        restore();
      }
      restore = standIn(video, "#ffffff");
      let white: Uint8ClampedArray;
      let ctx: CanvasRenderingContext2D;
      try {
        const pass = await rasterise(node, size, video);
        white = pass.data;
        ctx = pass.ctx;
      } finally {
        restore();
      }

      const gainData = ctx.createImageData(size.width, size.height);
      const constantData = ctx.createImageData(size.width, size.height);
      for (let i = 0; i < black.length; i += 4) {
        for (let c = 0; c < 3; c++) {
          gainData.data[i + c] = Math.max(0, white[i + c]! - black[i + c]!);
          constantData.data[i + c] = black[i + c]!;
        }
        gainData.data[i + 3] = 255;
        constantData.data[i + 3] = 255;
      }
      return { gain: toCanvas(gainData), constant: toCanvas(constantData) };
    };

    const whole = await solve();

    // Each part solved on its own, by hiding the others and solving again.
    //
    // A part cannot be animated out of a single flat raster: the design is one
    // image, and fading half of it means knowing which half. Hiding the rest
    // leaves a solve where that part is the only thing altering the footage and
    // everywhere else is the identity, so the parts can be laid back over the
    // clip one at a time, at whatever opacity and offset the moment calls for,
    // and at full opacity with no offset they add back up to `whole`.
    // Lines that draw nothing are in the document but take no room and have
    // nothing to animate, so they are not worth two rasters each.
    const groups = [...node.querySelectorAll<HTMLElement>(".krijo-intro")].filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });
    let layers: Layer[] | undefined;
    let base: { gain: HTMLCanvasElement; constant: HTMLCanvasElement } | undefined;
    if (groups.length > 1) {
      // The design with none of its writing: hidden rather than removed, so the
      // panels a block draws keep the size their content gave them.
      for (const g of groups) g.style.visibility = "hidden";
      try {
        base = await solve();
      } finally {
        for (const g of groups) g.style.visibility = "";
      }
      layers = [];
      for (const only of groups) {
        const box = boxOf(only, nodeBox, scale, size);
        const arrival = Number(only.getAttribute(ARRIVAL_ATTR) ?? layers.length);
        const hidden = groups.filter((g) => g !== only);
        for (const g of hidden) g.style.visibility = "hidden";
        try {
          const solved = await solve();
          layers.push({
            gain: cropTo(solved.gain, box),
            constant: cropTo(solved.constant, box),
            arrival,
            ...box,
          });
        } finally {
          for (const g of hidden) g.style.visibility = "";
        }
      }
    }

    return { ...whole, rect, ...(base ? { base } : {}), ...(layers ? { layers } : {}) };
  } finally {
    node.removeAttribute(STILL_ATTR);
    node.style.width = saved.width;
    node.style.maxWidth = saved.maxWidth;
    node.style.position = saved.position;
    node.style.left = saved.left;
    node.style.top = saved.top;
    node.style.zIndex = saved.zIndex;
    node.getBoundingClientRect();
  }
}

function toCanvas(data: ImageData): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = data.width;
  canvas.height = data.height;
  canvas.getContext("2d")!.putImageData(data, 0, 0);
  return canvas;
}

/** Draws a frame into the footage box using object-fit: cover, matching how the
 * preview shows it. */
function drawCover(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  rect: FootageRect,
): void {
  const vw = video.videoWidth || rect.width;
  const vh = video.videoHeight || rect.height;
  const scale = Math.max(rect.width / vw, rect.height / vh);
  const w = vw * scale;
  const h = vh * scale;
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.width, rect.height);
  ctx.clip();
  ctx.drawImage(video, rect.x + (rect.width - w) / 2, rect.y + (rect.height - h) / 2, w, h);
  ctx.restore();
}

/**
 * Loads the footage into an element this function fully controls.
 *
 * The on-screen <video> carries crossOrigin="anonymous" and a signed URL from
 * storage. If that response ever lacks CORS headers the element decodes nothing,
 * drawImage silently paints nothing, and the export comes out as design over
 * blank. Fetching the bytes and playing them from an object url makes the source
 * same-origin, so decoding cannot fail that way and the canvas can never be
 * tainted. It also lets looping be turned off, so the clip ends by itself.
 */
async function loadFootage(src: string): Promise<{ video: HTMLVideoElement; release: () => void }> {
  const response = await fetch(src, { mode: "cors", credentials: "omit" });
  if (!response.ok) throw new Error("Could not read the uploaded video.");
  const url = URL.createObjectURL(await response.blob());

  const video = document.createElement("video");
  video.src = url;
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";

  await new Promise<void>((resolve, reject) => {
    video.onloadeddata = () => resolve();
    video.onerror = () => reject(new Error("The uploaded video could not be decoded."));
  });
  if (!video.videoWidth || !video.videoHeight) {
    URL.revokeObjectURL(url);
    throw new Error("The uploaded video has no picture.");
  }
  return { video, release: () => URL.revokeObjectURL(url) };
}

/** Seeks and waits for the frame at that time to be decoded, so the first thing
 * drawn is a real picture rather than an empty element. */
async function seekTo(video: HTMLVideoElement, time: number): Promise<void> {
  const withCallback = video as HTMLVideoElement & {
    requestVideoFrameCallback?: (cb: () => void) => number;
  };
  await new Promise<void>((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    video.onseeked = () => {
      if (withCallback.requestVideoFrameCallback) withCallback.requestVideoFrameCallback(done);
      else done();
    };
    setTimeout(done, 2000);
    video.currentTime = time;
  });
}

/**
 * Composites one frame as `gain * footage + constant`.
 *
 * The footage is painted on black so the multiply below zeroes every pixel the
 * design owns, then the gain map dims it exactly as the template does on screen,
 * then the design's own contribution is added on top.
 */
function composite(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  overlay: Overlay,
  size: VideoExportSize,
  elapsedMs: number,
): void {
  // The design is rasterised once, at full size, and may be recorded onto a
  // smaller canvas, so the box the footage fills is scaled with it.
  const k = size.width / overlay.gain.width;
  const rect: FootageRect = {
    x: overlay.rect.x * k,
    y: overlay.rect.y * k,
    width: overlay.rect.width * k,
    height: overlay.rect.height * k,
  };
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, size.width, size.height);
  drawCover(ctx, video, rect);

  const layers = overlay.layers;
  const base = overlay.base;
  const lastArrival = layers ? Math.max(...layers.map((l) => l.arrival)) : 0;
  const arriving = layers && base && elapsedMs < introDurationMs(lastArrival + 1);
  if (!arriving) {
    // Settled, or never animating: the whole design in one pass.
    ctx.globalCompositeOperation = "multiply";
    ctx.drawImage(overlay.gain, 0, 0, size.width, size.height);
    ctx.globalCompositeOperation = "lighter";
    ctx.drawImage(overlay.constant, 0, 0, size.width, size.height);
    ctx.globalCompositeOperation = "source-over";
    return;
  }

  // Laid back over the clip one line at a time, and every pixel is either the
  // design or the picture - never a blend of the two.
  //
  // A line used to fade up as it uncovered, and that left a visible rectangle
  // behind it: laying a line down means putting the untouched footage back
  // inside the uncovered strip first, and at less than full strength the strip
  // keeps some of that raw footage and reads brighter than the shadow around
  // it. A box that tracks the wipe is worse than no softness at all, so the
  // strip is drawn whole or not drawn, and the wipe's own edge is the only edge
  // in the frame.
  //
  // Where this is exact, and where it is not. Lines that do not overlap add
  // back up to the whole design pixel for pixel, and so does an opaque line
  // over another - its gain is zero, so it replaces what is under it exactly as
  // a single raster would. The one case that differs is a semi-transparent line
  // over another: in this library that is the soft edge of a pinned logo lying
  // over a block, the designs being barred from overlapping blocks at all. It
  // is also confined to the intro: the moment everything has arrived the whole
  // design is drawn in one piece again, so what stays on screen for the rest of
  // the clip is exact.

  // The picture's own treatment first, whole and at full strength. It is the
  // shadow the type is written on, not a thing that arrives with the type.
  ctx.globalCompositeOperation = "multiply";
  ctx.drawImage(base.gain, 0, 0, size.width, size.height);
  ctx.globalCompositeOperation = "lighter";
  ctx.drawImage(base.constant, 0, 0, size.width, size.height);

  for (const l of layers) {
    const { reveal } = introAt(l.arrival, elapsedMs);
    if (reveal <= 0) continue;
    // `k` carries the layer's box from overlay pixels to this recording's,
    // which differ whenever a clip is re-recorded at half size.
    const dx = l.x * k;
    const dy = l.y * k;
    const dh = l.height * k;
    // The wipe: only the uncovered part of the line is drawn.
    const sw = Math.max(1, Math.round(l.gain.width * reveal));
    const dw = l.width * k * reveal;

    // A line replaces what is under it rather than stacking on top of it.
    //
    // Each line was solved with the treatment in place, so its answer already
    // contains the shadow within its own box. Laying that over a backdrop that
    // has the treatment on it too would darken those pixels twice, and the
    // writing would sit in a patch visibly deeper than the picture around it.
    // Putting the untouched footage back inside the uncovered strip first makes
    // the line's answer land on what it was solved against.
    ctx.save();
    ctx.beginPath();
    ctx.rect(dx, dy, dw, dh);
    ctx.clip();
    ctx.globalCompositeOperation = "source-over";
    drawCover(ctx, video, rect);
    ctx.globalCompositeOperation = "multiply";
    ctx.drawImage(l.gain, 0, 0, sw, l.gain.height, dx, dy, dw, dh);
    ctx.globalCompositeOperation = "lighter";
    ctx.drawImage(l.constant, 0, 0, sw, l.constant.height, dx, dy, dw, dh);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
}

/**
 * Throws unless the footage actually painted. An element that decoded nothing
 * draws nothing at all, leaving the box the flat black it was filled with -
 * better to say so than to hand back a clip with no picture in it.
 */
function assertFootagePainted(ctx: CanvasRenderingContext2D, rect: FootageRect): void {
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));
  const { data } = ctx.getImageData(Math.round(rect.x), Math.round(rect.y), width, height);
  for (let i = 0; i < data.length; i += 4 * 101) {
    if (data[i]! > 4 || data[i + 1]! > 4 || data[i + 2]! > 4) return;
  }
  throw new Error("The video frames could not be read, so the export would have no picture.");
}

/**
 * A still of a video post, with the footage actually in it.
 *
 * html-to-image serialises the DOM, and a cloned <video> is not the live picture -
 * so the saved thumbnail of a video post came out as the design over an empty
 * gradient. This composites the same way the clip export does, one frame instead
 * of many.
 */
export async function renderVideoPosterToDataUrl(
  node: HTMLElement,
  onScreenVideo: HTMLVideoElement,
  size: VideoExportSize,
): Promise<string> {
  const src = onScreenVideo.currentSrc || onScreenVideo.src;
  if (!src) throw new Error("This post has no video.");

  const overlay = await buildOverlay(node, onScreenVideo, size);
  const { video, release } = await loadFootage(src);
  try {
    // A frame from a little way in: the very first frame of a clip is often
    // black or a fade.
    await seekTo(video, Number.isFinite(video.duration) ? Math.min(0.4, video.duration / 4) : 0.2);

    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not get a drawing context.");
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, size.width, size.height);
    drawCover(ctx, video, overlay.rect);
    assertFootagePainted(ctx, overlay.rect);
    // A poster is a still of the clip, so it shows the design finished arriving
    // rather than whichever moment of the intro it was taken at.
    composite(ctx, video, overlay, size, Number.POSITIVE_INFINITY);
    return canvas.toDataURL("image/png");
  } finally {
    release();
  }
}

export async function renderVideoPostToBlob(
  node: HTMLElement,
  onScreenVideo: HTMLVideoElement,
  size: VideoExportSize,
  opts: { maxDurationMs?: number } = {},
): Promise<Blob> {
  const mimeType = pickMimeType();
  if (!mimeType) throw new Error("This browser cannot record video.");

  const src = onScreenVideo.currentSrc || onScreenVideo.src;
  if (!src) throw new Error("This post has no video to export.");

  const overlay = await buildOverlay(node, onScreenVideo, size);
  const { video, release } = await loadFootage(src);

  try {
    // What a machine can manage is only knowable by recording, so when it
    // cannot keep up the clip is made again - at the same frame size, asking
    // the encoder for fewer bits.
    //
    // It used to make it again at half the frame size, which is the one loss a
    // customer sees immediately, and it never diagnosed the right thing: a
    // recording that falls behind still runs the length of its footage, so
    // measuring the clip's duration says nothing. What it loses is frames. The
    // honest measure is how many were handed to the encoder against how long
    // recording took, which this counts as it goes and costs nothing.
    //
    // Bits are what get given up, because the encoder is what ran out of time
    // and because a feed re-encodes the file anyway. The frame size is never
    // touched.
    let best: Blob | null = null;
    const rates = [bitrateFor(size), Math.round(bitrateFor(size) / 2)];
    for (const bitrate of rates) {
      const attempt = await recordOnce({
        video,
        overlay,
        mimeType,
        size,
        bitrate,
        limitMs: opts.maxDurationMs ?? 60_000,
      });
      // A clip is judged by what was handed to the encoder, not by reading the
      // file back.
      //
      // It used to play the recording through at sixteen times speed and count
      // the frames the browser chose to present, which is not the same thing as
      // the frames the file holds: a large clip presents a fraction of them, so
      // a perfectly good recording could be declared a single frame and thrown
      // away, and a decoder that simply took too long failed the export
      // outright. The counter below is kept while recording, costs nothing, and
      // cannot be fooled.
      if (attempt.emitted < 2) {
        throw new Error(
          "The clip recorded only a single frame. Please try the download again, and keep this tab in front while it runs.",
        );
      }
      best = attempt.blob;
      const achievedFps = attempt.emitted / (attempt.wallMs / 1000);
      // Within a sixth of the rate it was aiming for is a smooth clip. Below
      // that it stutters, and it is worth one more pass to get it back.
      if (achievedFps >= CAPTURE_FPS * 0.83) {
        await warnIfNotH264(attempt.blob);
        return attempt.blob;
      }
      console.warn(
        `[video-export] Recorded ${achievedFps.toFixed(1)} frames a second against ${CAPTURE_FPS}. Trying again with a lighter encode.`,
      );
    }
    await warnIfNotH264(best!);
    return best!;
  } finally {
    release();
  }
}

/** One recording pass: plays the footage through once, compositing every frame
 * onto a canvas the recorder is reading. */
async function recordOnce(input: {
  video: HTMLVideoElement;
  overlay: Overlay;
  mimeType: string;
  size: VideoExportSize;
  limitMs: number;
  bitrate: number;
}): Promise<{ blob: Blob; wallMs: number; emitted: number }> {
  const { video, overlay, mimeType, size, limitMs, bitrate } = input;
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  // Opaque: every frame starts with a fill and ends covered, so the alpha
  // channel is two million values a frame that nothing ever reads, and carrying
  // it costs compositing time this recording does not have to spare.
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("Could not get a drawing context.");

  // Paint once before recording: a capture only emits on paint, so starting on
  // an unpainted canvas records an empty file.
  await seekTo(video, 0);
  // The picture is checked before the design goes over it, while black still
  // means nothing decoded rather than a scrim doing its work.
  const k = size.width / overlay.gain.width;
  const rect: FootageRect = {
    x: overlay.rect.x * k,
    y: overlay.rect.y * k,
    width: overlay.rect.width * k,
    height: overlay.rect.height * k,
  };
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, size.width, size.height);
  drawCover(ctx, video, rect);
  assertFootagePainted(ctx, rect);
  // The first frame is the clip before the design has arrived on it.
  composite(ctx, video, overlay, size, 0);

  // Frames are handed over one at a time rather than sampled at a fixed rate,
  // so every frame that was painted is offered to the recorder.
  const manual = canvas.captureStream(0);
  const manualTrack = manual.getVideoTracks()[0] as
    (MediaStreamTrack & { requestFrame?: () => void }) | undefined;
  const stream = manualTrack?.requestFrame ? manual : canvas.captureStream(CAPTURE_FPS);
  const requestFrame = manualTrack?.requestFrame ? () => manualTrack.requestFrame?.() : () => {};

  const source = video as HTMLVideoElement & { captureStream?: () => MediaStream };
  try {
    const audio = source.captureStream?.().getAudioTracks() ?? [];
    for (const track of audio) stream.addTrack(track);
  } catch {
    // No audio is better than no export.
  }

  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: bitrate });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };
  const done = new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
    // An encoder that quits part way used to pass silently: the chunks it had
    // already emitted were handed over as the finished clip.
    recorder.onerror = () => reject(new Error("The browser stopped recording this clip."));
  });

  // Paced by animation frames rather than by the footage's own frame callback:
  // the element being recorded is never in the document, and a detached video
  // never presents frames, so its callback would not fire.
  let handle = 0;
  const stop = () => {
    cancelAnimationFrame(handle);
    video.removeEventListener("ended", stop);
    if (recorder.state !== "inactive") recorder.stop();
    video.pause();
  };

  recorder.start(100);
  await video.play();
  const startedAt = performance.now();
  // Footage that reports itself finished before a single frame has been drawn
  // never played, so recording it would capture one still.
  if (video.ended) {
    stop();
    throw new Error("The uploaded video would not play, so there was nothing to record.");
  }
  // Paced to a frame rate rather than to the display's.
  //
  // This used to composite and hand over a frame on every animation frame, which
  // is the screen's refresh rate, not a video's. On a 165Hz monitor that is 165
  // frames a second, each one two full-size composites and one more picture for
  // the encoder to swallow - measured on a customer's export: 1648 frames in
  // 10.27 seconds, a 1080x1920 clip at 160fps. Nothing plays that rate the way
  // it was meant, the file is several times the size it should be, and the work
  // is five times what the machine was asked for. The clock stays the animation
  // frame, because a detached video presents no frames of its own to follow, but
  // only every thirtieth of a second is drawn and offered.
  let nextFrameAt = startedAt;
  let emitted = 0;
  const tick = () => {
    const now = performance.now();
    if (now >= nextFrameAt) {
      composite(ctx, video, overlay, size, now - startedAt);
      requestFrame();
      emitted += 1;
      // Anchored to the schedule, not to now: one late frame must not push the
      // whole clip later, and a very late one should not fire a burst to catch
      // up either.
      nextFrameAt = Math.max(now, nextFrameAt + FRAME_MS);
    }
    if (video.ended || now - startedAt > limitMs) return stop();
    handle = requestAnimationFrame(tick);
  };
  video.addEventListener("ended", stop, { once: true });
  tick();

  const blob = await done;
  return { blob, wallMs: performance.now() - startedAt, emitted };
}
