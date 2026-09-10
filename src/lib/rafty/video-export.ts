import { toPng } from "html-to-image";

/**
 * Renders a video post to a real clip.
 *
 * The design is static for the duration, so it is rasterised once and then
 * composited onto every frame of the footage. Frames are drawn to a canvas whose
 * stream, plus the clip's own audio, is captured by MediaRecorder.
 *
 * Capture is real time by construction: MediaRecorder records a live stream, so a
 * fifteen second clip takes fifteen seconds. The output is WebM, the only format
 * MediaRecorder is guaranteed to produce.
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
type Overlay = { gain: HTMLCanvasElement; constant: HTMLCanvasElement; rect: FootageRect };

/**
 * WebM with a codec this browser will actually encode.
 *
 * VP8 leads rather than VP9. isTypeSupported answers whether the browser knows
 * the codec, not whether it can encode a 1080x1920 stream in real time on this
 * machine, and a VP9 encoder that cannot keep up gives up part way: the
 * recorder emits its first chunk and then errors, which lands as a file holding
 * a single frame. VP8 is the encoder every browser that offers MediaRecorder
 * has actually shipped.
 */
function pickMimeType(): string | undefined {
  const candidates = [
    "video/webm;codecs=vp8,opus",
    "video/webm;codecs=vp8",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp9",
    "video/webm",
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type));
}

/**
 * A recording that holds one frame is a still with a video extension, and
 * handing that to someone as their clip is worse than saying it failed. The
 * check reads how much media the file actually carries, without playing it.
 */
async function measureClip(blob: Blob): Promise<{ seconds: number; frames: number }> {
  const url = URL.createObjectURL(blob);
  try {
    const probe = document.createElement("video");
    probe.src = url;
    probe.muted = true;
    probe.preload = "auto";
    const loaded = await new Promise<boolean>((resolve) => {
      probe.onloadeddata = () => resolve(true);
      probe.onerror = () => resolve(false);
      setTimeout(() => resolve(false), 4000);
    });
    if (!loaded) throw new Error("The recorded clip could not be read back.");

    // A recording made live carries no duration in its header, so the only
    // honest measure is how much of it decodes. Played fast and muted, a whole
    // clip runs through in a fraction of its length.
    const withCallback = probe as HTMLVideoElement & {
      requestVideoFrameCallback?: (cb: () => void) => number;
    };
    if (!withCallback.requestVideoFrameCallback) return { seconds: Infinity, frames: Infinity };
    let frames = 0;
    let last = 0;
    const count = () => {
      frames += 1;
      last = probe.currentTime;
      withCallback.requestVideoFrameCallback?.(count);
    };
    withCallback.requestVideoFrameCallback(count);
    probe.playbackRate = 16;
    await probe.play().catch(() => {});
    await new Promise<void>((resolve) => {
      probe.onended = () => resolve();
      setTimeout(resolve, 6000);
    });
    probe.pause();
    return { seconds: Math.max(last, probe.currentTime), frames };
  } finally {
    URL.revokeObjectURL(url);
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

    return { gain: toCanvas(gainData), constant: toCanvas(constantData), rect };
  } finally {
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
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, size.width, size.height);
  drawCover(ctx, video, rect);
  ctx.globalCompositeOperation = "multiply";
  ctx.drawImage(overlay.gain, 0, 0, size.width, size.height);
  ctx.globalCompositeOperation = "lighter";
  ctx.drawImage(overlay.constant, 0, 0, size.width, size.height);
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
    composite(ctx, video, overlay, size);
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
    // Recording at a size the machine cannot keep up with does not simply lower
    // the frame rate: frames the capture queue cannot take are dropped, and the
    // clip comes back shorter than the footage, a six second walkthrough
    // arriving as two seconds of stutter. What a machine can manage is only
    // knowable by recording, so the clip is measured against the time it took
    // to record and, if it fell behind, made again at half the frame size. The
    // design is rasterised once and scaled, so a second pass costs one more
    // playthrough and nothing else.
    const half = { width: Math.round(size.width / 4) * 2, height: Math.round(size.height / 4) * 2 };
    let best: Blob | null = null;
    for (const recordSize of [size, half]) {
      const attempt = await recordOnce({
        video,
        overlay,
        mimeType,
        size: recordSize,
        limitMs: opts.maxDurationMs ?? 60_000,
      });
      const clip = await measureClip(attempt.blob);
      if (clip.frames < 2) {
        throw new Error(
          "The clip recorded only a single frame. Please try the download again, and keep this tab in front while it runs.",
        );
      }
      best = attempt.blob;
      // Within a tenth of the time it was recorded over is a faithful clip.
      if (clip.seconds >= (attempt.wallMs / 1000) * 0.9) return attempt.blob;
    }
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
}): Promise<{ blob: Blob; wallMs: number }> {
  const { video, overlay, mimeType, size, limitMs } = input;
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext("2d");
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
  composite(ctx, video, overlay, size);

  // Frames are handed over one at a time rather than sampled at a fixed rate,
  // so every frame that was painted is offered to the recorder.
  const manual = canvas.captureStream(0);
  const manualTrack = manual.getVideoTracks()[0] as
    (MediaStreamTrack & { requestFrame?: () => void }) | undefined;
  const stream = manualTrack?.requestFrame ? manual : canvas.captureStream(30);
  const requestFrame = manualTrack?.requestFrame ? () => manualTrack.requestFrame?.() : () => {};

  const source = video as HTMLVideoElement & { captureStream?: () => MediaStream };
  try {
    const audio = source.captureStream?.().getAudioTracks() ?? [];
    for (const track of audio) stream.addTrack(track);
  } catch {
    // No audio is better than no export.
  }

  const recorder = new MediaRecorder(stream, { mimeType });
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
  const tick = () => {
    composite(ctx, video, overlay, size);
    requestFrame();
    if (video.ended || performance.now() - startedAt > limitMs) return stop();
    handle = requestAnimationFrame(tick);
  };
  video.addEventListener("ended", stop, { once: true });
  tick();

  const blob = await done;
  return { blob, wallMs: performance.now() - startedAt };
}
