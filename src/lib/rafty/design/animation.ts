/**
 * How a design arrives on a clip.
 *
 * A still post is read all at once, so it has nothing to time. A clip is
 * watched, and a design that is simply there from the first frame looks like a
 * screenshot someone laid over a video. The lines arrive instead: each one is
 * wiped in from the left, one after another, and then the design is just the
 * design for the rest of the clip.
 *
 * A wipe rather than a fade because that is what the customer asked for, with a
 * reference clip to point at: heavy type uncovering itself line by line over
 * footage. A line that fades up reads as a caption switching on; a line that
 * wipes in reads as typography.
 *
 * The timing lives here rather than in the stylesheet because two very
 * different things have to agree on it. The preview animates in CSS, where the
 * browser does the work. The exported clip has no CSS - it is a canvas being
 * composited frame by frame - so it has to compute the same curve itself. If
 * the two ever disagree, what the customer approved is not what they post.
 */

/**
 * Set on a canvas while it is being rasterised, to hold the design still.
 *
 * The stylesheet answers it by switching the keyframes off, and because those
 * keyframes run from absent to the element's own resting style, switching them
 * off leaves the finished design rather than whatever moment the capture landed
 * on. Every rasteriser sets it; a capture that forgets produces a file with the
 * design half arrived, and nothing about that file says so.
 */
export const STILL_ATTR = "data-krijo-still";

/** Milliseconds one part takes to arrive. */
const DURATION = 620;

/**
 * Milliseconds between one line starting and the next.
 *
 * Tight enough that the lines overlap and the whole thing reads as one
 * movement. At 130 a nine line design took over a second and a half and each
 * line waited visibly for the one before it, which reads as a queue rather than
 * as an arrival; at 95 the design is in place in under a second and a half with
 * the lines still clearly in order.
 */
const STAGGER = 95;

export const INTRO = { duration: DURATION, stagger: STAGGER } as const;

/** The attribute a part carries its place in the order on, so the stylesheet
 * and the exporter read the same number rather than each counting for itself.
 * They count differently: a part that draws nothing is still in the document,
 * and the exporter skips it. */
export const ARRIVAL_ATTR = "data-krijo-arrival";

/** The whole intro, for a design with this many parts. */
export function introDurationMs(groups: number): number {
  return Math.max(0, groups - 1) * STAGGER + DURATION;
}

/** The CSS timing function, written once so the stylesheet and the solver below
 * cannot drift apart. */
export const INTRO_EASING = "cubic-bezier(0.22, 1, 0.36, 1)";
const P1X = 0.22;
const P1Y = 1;
const P2X = 0.36;
const P2Y = 1;

const bezier = (t: number, a: number, b: number) => {
  const u = 1 - t;
  return 3 * u * u * t * a + 3 * u * t * t * b + t * t * t;
};

/**
 * The same curve the stylesheet applies, solved for a given progress.
 *
 * A cubic bezier timing function is written as x and y curves over a parameter,
 * and what is wanted is y at a given x. There is no closed form, so the
 * parameter is bisected until x is close enough - twenty steps put it within a
 * millionth, far under a pixel of movement, and it runs once per part per
 * frame rather than per pixel.
 */
export function introEase(progress: number): number {
  const x = Math.min(1, Math.max(0, progress));
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 20; i += 1) {
    const mid = (lo + hi) / 2;
    if (bezier(mid, P1X, P2X) < x) lo = mid;
    else hi = mid;
  }
  return bezier((lo + hi) / 2, P1Y, P2Y);
}

/**
 * Where one line of the design is at a moment in the clip.
 *
 * `reveal` is how much of it has been uncovered, left to right. There is
 * nothing else: the line is either uncovered at a pixel or it is not.
 *
 * It used to fade up over the same window as well, and that left a visible
 * rectangle. A line is laid down by putting the untouched footage back inside
 * the uncovered strip and then applying the line's own answer, which is only
 * correct at full strength - at anything less, the strip keeps some of the raw
 * footage and reads brighter than the shadow around it. So the strip is drawn
 * whole or not at all, and the edge of the wipe is the only edge there is.
 *
 * `reveal` is 1 once the line's window has passed, which is what lets the
 * exporter stop compositing line by line and draw the design in one piece.
 */
export function introAt(index: number, elapsedMs: number): { reveal: number } {
  const started = elapsedMs - index * STAGGER;
  if (started >= DURATION) return { reveal: 1 };
  if (started <= 0) return { reveal: 0 };
  return { reveal: introEase(started / DURATION) };
}
