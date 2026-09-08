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

export async function renderVideoPostToBlob(
  node: HTMLElement,
  video: HTMLVideoElement,
  size: VideoExportSize,
  opts: { maxDurationMs?: number } = {},
): Promise<Blob> {
  const mimeType = pickMimeType();
  if (!mimeType) throw new Error("This browser cannot record video.");

  const overlay = await renderOverlay(node, video, size);

  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get a drawing context.");

  const stream = canvas.captureStream(30);
  // Carry the clip's own audio when the browser exposes it.
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

  const wasMuted = video.muted;
  const limit = opts.maxDurationMs ?? 60_000;
  let raf = 0;
  const startedAt = performance.now();

  const stop = () => {
    cancelAnimationFrame(raf);
    video.removeEventListener("ended", stop);
    if (recorder.state !== "inactive") recorder.stop();
    video.muted = wasMuted;
  };

  const tick = () => {
    ctx.clearRect(0, 0, size.width, size.height);
    drawCover(ctx, video, size.width, size.height);
    ctx.drawImage(overlay, 0, 0, size.width, size.height);
    if (performance.now() - startedAt > limit) return stop();
    raf = requestAnimationFrame(tick);
  };

  video.currentTime = 0;
  video.addEventListener("ended", stop, { once: true });

  // Draw one frame before recording starts. captureStream only emits when the
  // canvas is painted, so starting the recorder on a canvas that has never been
  // drawn to yields an empty file.
  ctx.clearRect(0, 0, size.width, size.height);
  drawCover(ctx, video, size.width, size.height);
  ctx.drawImage(overlay, 0, 0, size.width, size.height);

  // A timeslice makes data flow throughout rather than only at stop, so a short
  // clip cannot end before the single dataavailable ever fires.
  recorder.start(100);
  await video.play();
  tick();

  return done;
}
