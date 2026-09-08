import { toPng } from "html-to-image";

/**
 * Renders a video post to a real clip.
 *
 * The design is static for the duration, so it is rasterised once with the
 * footage hidden - giving a transparent overlay - and then composited onto every
 * frame. Frames are drawn to a canvas whose stream, plus the clip's own audio, is
 * captured by MediaRecorder.
 *
 * Capture is real time by construction: MediaRecorder records a live stream, so a
 * fifteen second clip takes fifteen seconds. The output is WebM, the only format
 * MediaRecorder is guaranteed to produce.
 */

export type VideoExportSize = { width: number; height: number };

/** WebM with the best codec this browser actually offers. */
function pickMimeType(): string | undefined {
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type));
}

export function canExportVideo(): boolean {
  return (
    typeof MediaRecorder !== "undefined" &&
    typeof HTMLCanvasElement.prototype.captureStream === "function" &&
    !!pickMimeType()
  );
}

/** Rasterises the design with the footage hidden, so the result is transparent
 * wherever the video shows through. */
async function renderOverlay(
  node: HTMLElement,
  video: HTMLVideoElement,
  size: VideoExportSize,
): Promise<HTMLImageElement> {
  const savedVisibility = video.style.visibility;
  const savedBackground = node.style.backgroundColor;
  const savedWidth = node.style.width;
  try {
    video.style.visibility = "hidden";
    node.style.backgroundColor = "transparent";
    node.style.width = `${size.width}px`;
    node.getBoundingClientRect();
    await new Promise((r) => requestAnimationFrame(() => r(null)));

    const dataUrl = await toPng(node, {
      width: size.width,
      height: size.height,
      canvasWidth: size.width,
      canvasHeight: size.height,
      pixelRatio: 1,
      cacheBust: true,
      // html-to-image copies the node's computed style onto its clone. If the
      // node is parked off-screen the design gets drawn far outside the canvas
      // and the overlay comes back fully transparent - the footage would export
      // with no design on it at all.
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
    return img;
  } finally {
    video.style.visibility = savedVisibility;
    node.style.backgroundColor = savedBackground;
    node.style.width = savedWidth;
  }
}

/** Draws a frame using object-fit: cover, matching how the preview shows it. */
function drawCover(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  width: number,
  height: number,
): void {
  const vw = video.videoWidth || width;
  const vh = video.videoHeight || height;
  const scale = Math.max(width / vw, height / vh);
  const w = vw * scale;
  const h = vh * scale;
  ctx.drawImage(video, (width - w) / 2, (height - h) / 2, w, h);
}

/**
 * Loads the footage into an element this function fully controls.
 *
 * The on-screen <video> carries crossOrigin="anonymous" and a signed URL from
 * storage. If that response ever lacks CORS headers the element decodes nothing,
 * drawImage silently paints nothing, and the export comes out as design over
 * blank - which is exactly what it did. Fetching the bytes and playing them from
 * an object url makes the source same-origin, so decoding cannot fail that way
 * and the canvas can never be tainted. It also lets looping be turned off, so the
 * clip ends by itself.
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

/**
 * A still of a video post, with the footage actually in it.
 *
 * html-to-image serialises the DOM, and a cloned <video> paints nothing - so the
 * saved thumbnail of a video post came out as the design over an empty gradient.
 * This composites the same way the clip export does, one frame instead of many:
 * design rasterised with the footage hidden, drawn over a real video frame.
 */
export async function renderVideoPosterToDataUrl(
  node: HTMLElement,
  onScreenVideo: HTMLVideoElement,
  size: VideoExportSize,
): Promise<string> {
  const src = onScreenVideo.currentSrc || onScreenVideo.src;
  if (!src) throw new Error("This post has no video.");

  const overlay = await renderOverlay(node, onScreenVideo, size);
  const { video, release } = await loadFootage(src);
  try {
    // A frame from a little way in: the very first frame of a clip is often
    // black or a fade.
    const target = Number.isFinite(video.duration) ? Math.min(0.4, video.duration / 4) : 0.2;
    video.currentTime = target;
    await new Promise<void>((resolve) => {
      const done = () => resolve();
      video.onseeked = done;
      setTimeout(done, 2000);
    });

    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not get a drawing context.");
    drawCover(ctx, video, size.width, size.height);
    ctx.drawImage(overlay, 0, 0, size.width, size.height);
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

  const overlay = await renderOverlay(node, onScreenVideo, size);
  const { video, release } = await loadFootage(src);

  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get a drawing context.");

  const drawFrame = () => {
    ctx.clearRect(0, 0, size.width, size.height);
    drawCover(ctx, video, size.width, size.height);
    ctx.drawImage(overlay, 0, 0, size.width, size.height);
  };

  // Paint once before recording: captureStream only emits on paint, so starting
  // on an unpainted canvas records an empty file.
  video.currentTime = 0;
  drawFrame();

  // Refuse to hand back a clip that is only the design. Comparing the composite
  // against the overlay alone catches footage that decoded but never painted,
  // rather than shipping a silently empty export.
  const probe = document.createElement("canvas");
  probe.width = size.width;
  probe.height = size.height;
  const pctx = probe.getContext("2d");
  if (pctx) {
    pctx.drawImage(overlay, 0, 0, size.width, size.height);
    const a = ctx.getImageData(0, 0, size.width, size.height).data;
    const b = pctx.getImageData(0, 0, size.width, size.height).data;
    let different = 0;
    for (let i = 0; i < a.length; i += 4 * 997) {
      if (Math.abs(a[i]! - b[i]!) > 6 || Math.abs(a[i + 1]! - b[i + 1]!) > 6) different++;
    }
    if (different === 0) {
      release();
      throw new Error("The video frames could not be read, so the export would have no picture.");
    }
  }

  const stream = canvas.captureStream(30);
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
  const done = new Promise<Blob>((resolve) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
  });

  const limit = opts.maxDurationMs ?? 60_000;
  let raf = 0;
  const startedAt = performance.now();
  const stop = () => {
    cancelAnimationFrame(raf);
    video.removeEventListener("ended", stop);
    if (recorder.state !== "inactive") recorder.stop();
    video.pause();
    release();
  };
  const tick = () => {
    drawFrame();
    if (video.ended || performance.now() - startedAt > limit) return stop();
    raf = requestAnimationFrame(tick);
  };

  video.addEventListener("ended", stop, { once: true });
  recorder.start(100);
  await video.play();
  tick();

  return done;
}
