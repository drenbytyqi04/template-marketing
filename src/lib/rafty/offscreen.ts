import { STILL_ATTR } from "./design/animation";

/** Waits for every image inside the node to finish decoding, tolerating
 * broken or slow images instead of hanging the export. */
export async function waitForImages(node: HTMLElement): Promise<void> {
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

export function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

/**
 * Runs an export against a copy of the design, parked off the page.
 *
 * Every exporter needs the design laid out at the real export width, because
 * everything in a template is sized relative to its own frame and a small
 * preview scaled up is not the same drawing. This used to be done by taking the
 * design itself - the element on the page - fixing it off-screen and widening
 * it, then putting it back when the export finished.
 *
 * That works, and it takes the design out of the page while it runs. On the
 * Create preview it is a flicker. In the grid of saved posts it is a card that
 * empties out for as long as an export takes, which for a clip is many seconds:
 * the thumbnail is fixed, so it leaves the layout entirely, the card collapses
 * to its title, and a customer watching that reasonably concludes the post is
 * broken. It was photographed as exactly that.
 *
 * A copy costs one clone and the memory of a second layout for the length of
 * the export, and the page never changes at all. The copy is held in the same
 * document, so it inherits the same stylesheet, the same fonts and the same
 * already-decoded images; it is parked far off-screen rather than hidden,
 * because an element that is not rendered has no layout to capture.
 */
export async function withOffscreenCopy<T>(
  node: HTMLElement,
  width: number,
  run: (copy: HTMLElement) => Promise<T>,
): Promise<T> {
  const host = document.createElement("div");
  // Holds the design still while it is captured: the lines of a clip arrive
  // over the first second or so, and an export must have the finished design.
  host.setAttribute(STILL_ATTR, "");
  host.style.cssText = [
    "position:fixed",
    "left:-100000px",
    "top:0",
    "z-index:-1",
    "pointer-events:none",
    `width:${width}px`,
  ].join(";");

  const copy = node.cloneNode(true) as HTMLElement;
  copy.style.width = `${width}px`;
  copy.style.maxWidth = "none";
  copy.style.margin = "0";
  host.appendChild(copy);
  document.body.appendChild(host);

  try {
    copy.getBoundingClientRect();
    await document.fonts.ready;
    await waitForImages(copy);
    // Two frames: the first settles layout, the second lets anything that
    // re-fits itself against the new width finish doing so.
    await nextFrame();
    await nextFrame();
    return await run(copy);
  } finally {
    host.remove();
  }
}
