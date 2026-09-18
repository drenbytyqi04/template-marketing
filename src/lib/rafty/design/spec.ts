import type { BusinessType, TemplateTag } from "../types";

/**
 * A design, written down rather than coded.
 *
 * The old library was 142 hand laid functions, so it held 142 independent
 * decisions and no two designs agreed on a margin, a type size or how a price
 * was set. Here a design says what it is made of and where the parts sit, and
 * one renderer decides how each part is drawn, from the same tokens every time.
 *
 * Three things follow from that. A rule changed once changes every design. A
 * design reads as data in a diff rather than as three hundred lines of inline
 * style. And the rules a design has to meet - one dominant element, few blocks,
 * type that clears its backdrop - can be checked by a program instead of by eye.
 */

/** Where a block sits, on a twelve by twelve field laid over the canvas.
 * Columns and rows are one based, the end is exclusive: [1, 13, 9, 13] is the
 * bottom third across the full width. */
export type Area = [colStart: number, colEnd: number, rowStart: number, rowEnd: number];

export const GRID = 12;

/** The parts a design can be built from. Each one knows how to draw itself from
 * the post's content, so a design never names a font, a size or a colour. */
export type Part =
  /** The small line over a headline: what the post is about. Caps read as a
   * label, a hand reads as a travel poster naming the hotel. */
  | { t: "kicker"; as?: "caps" | "script" }
  /** The headline. A design has exactly one, and it leads the frame. */
  | { t: "headline"; size: "display" | "hero" | "large" | "medium" }
  /** The number. Plain reads as editorial, badge reads as an offer.
   * Whatever the post filled in rides along: a starting-from price, what it
   * buys, and the figure it was reduced from. */
  | { t: "price"; as: "plain" | "badge" | "block" }
  /** The short urgent line over an offer: last minute, five places left.
   * A ribbon shouts, a tag is quiet enough to sit beside a headline. */
  | { t: "stamp"; as: "ribbon" | "tag" }
  /** Several destinations and their prices, for a post that sells a season
   * rather than one trip. */
  | { t: "offers"; limit?: number }
  /** Where, how long, when: whatever the post actually filled in. */
  | { t: "facts"; limit?: number }
  /** What the offer includes: one quiet line, a ticked list, or the same tags
   * the post was built with. */
  | { t: "included"; as: "line" | "ticks" | "chips"; limit?: number }
  | { t: "cta"; as: "bar" | "tag" }
  /** Logo and business name, drawn only when the brand has them. */
  | { t: "brand" }
  | { t: "contact" }
  /** A short accent rule, for designs that need a beat between two parts. */
  | { t: "rule" };

/** A block of parts placed on the field. */
export type Block = {
  area: Area;
  /** Horizontal placement of the parts inside the block. */
  align?: "start" | "center" | "end";
  /** Vertical placement of the parts inside the block. */
  justify?: "start" | "center" | "end";
  /** A ground drawn behind the block: none lets the picture through. */
  panel?: "none" | "brand" | "paper" | "veil";
  /** How the picture is treated under this design. */
  gap?: "sm" | "md" | "lg";
  parts: Part[];
};

/** How the photograph under the design is prepared. */
export type PhotoTreatment = "plain" | "scrimBottom" | "scrimTop" | "scrimBoth" | "wash";

export type DesignSpec = {
  id: string;
  name: string;
  tags: TemplateTag[];
  /** Trades this design is offered to. Absent means every trade. */
  for?: BusinessType[];
  /** Which ink the design writes in over the picture. */
  tone: "light" | "dark";
  photo: { treatment: PhotoTreatment; strength?: number };
  /** This design's page margin, in cqw. Designs share one by default, which is
   * most of what makes a set look like a set; a design states its own only when
   * the wider frame is the point of it. */
  page?: number;
  blocks: Block[];
};

/* --------------------------------- rules ---------------------------------- */

/**
 * What a design has to satisfy before it belongs in the library.
 *
 * These are the differences between a design that was art directed and one
 * that was assembled, stated so a program can hold them: one thing leads, the
 * frame carries few blocks, and nothing is pushed against an edge.
 */
export type Finding = { id: string; rule: string; detail: string };

// Four, not three. Three was set when a design carried whatever its author felt
// like; now every design has to draw all nine parts, and a frame that wants the
// details and the price side by side genuinely needs a fourth region. It is
// still a limit: the point was never the number, it was that a frame with a
// region per part is not a design.
const MAX_BLOCKS = 4;

/**
 * Every part a post can fill in, and therefore every part a design must draw.
 *
 * A design is free to decide how each one looks - a price as a badge or set
 * plain, what is included as chips, ticks or one quiet line - and where it
 * sits. It is not free to leave one out.
 */
const REQUIRED: Part["t"][] = [
  "kicker",
  "headline",
  "facts",
  "price",
  "included",
  "stamp",
  "cta",
  "brand",
  "contact",
];

export function checkSpec(spec: DesignSpec): Finding[] {
  const found: Finding[] = [];
  const say = (rule: string, detail: string) => found.push({ id: spec.id, rule, detail });

  const parts = spec.blocks.flatMap((b) => b.parts);
  const headlines = parts.filter((p) => p.t === "headline");
  if (headlines.length !== 1) {
    say("one headline", `has ${headlines.length}, a design leads with exactly one`);
  }

  if (spec.blocks.length > MAX_BLOCKS) {
    say("few blocks", `has ${spec.blocks.length}, a frame holds at most ${MAX_BLOCKS}`);
  }

  for (const block of spec.blocks) {
    const [c1, c2, r1, r2] = block.area;
    if (c1 < 1 || c2 > GRID + 1 || r1 < 1 || r2 > GRID + 1) {
      say("inside the field", `block at ${block.area.join(",")} leaves the frame`);
    }
    if (c2 <= c1 || r2 <= r1) {
      say("real area", `block at ${block.area.join(",")} has no width or no height`);
    }
    if (block.parts.length === 0) {
      say("no empty block", `block at ${block.area.join(",")} carries nothing`);
    }
  }

  const overlaps = spec.blocks.some((a, i) =>
    spec.blocks.some((b, j) => {
      if (j <= i) return false;
      const [ac1, ac2, ar1, ar2] = a.area;
      const [bc1, bc2, br1, br2] = b.area;
      return ac1 < bc2 && bc1 < ac2 && ar1 < br2 && br1 < ar2;
    }),
  );
  if (overlaps) say("no overlap", "two blocks cover the same part of the frame");

  // Everything the form can be filled in with has to land somewhere.
  //
  // This is the rule the library kept breaking quietly. A design missing a part
  // does not look broken - it looks fine, and simply never mentions the hotel,
  // or the dates, or how to get in touch. The customer typed those in, saw
  // them on the design they happened to have selected, picked a different
  // design for the next post and lost them with no warning and no error. Which
  // fields survive should not depend on which layout somebody liked.
  const drawn = new Set(parts.map((p) => p.t));
  for (const needed of REQUIRED) {
    // A price list is the one honest exception: it is a different kind of post,
    // and the rule below keeps it from also setting a single price.
    if (needed === "price" && drawn.has("offers")) continue;
    if (!drawn.has(needed)) {
      say("prints everything a post can carry", `nothing in this design draws the ${needed}`);
    }
  }

  // An offers list is the frame's whole content. Setting a single price beside
  // it asks which of the two the reader is meant to believe.
  if (drawn.has("offers") && drawn.has("price")) {
    say("one price story", "a design lists offers or sets one price, never both");
  }

  // A design that writes light ink straight onto an untreated photograph is a
  // caption waiting to disappear into a bright sky.
  if (spec.tone === "light" && spec.photo.treatment === "plain") {
    say("readable ink", "light type needs a scrim or a wash under it");
  }

  return found;
}
