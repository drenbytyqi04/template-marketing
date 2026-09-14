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
  /** The small tracked line over a headline: what the post is about. */
  | { t: "kicker" }
  /** The headline. A design has exactly one, and it leads the frame. */
  | { t: "headline"; size: "hero" | "large" | "medium" }
  /** The number. Plain reads as editorial, badge reads as an offer. */
  | { t: "price"; as: "plain" | "badge" }
  /** Where, how long, when: whatever the post actually filled in. */
  | { t: "facts"; limit?: number }
  /** What the offer includes, as one quiet line or as a ticked list. */
  | { t: "included"; as: "line" | "ticks"; limit?: number }
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

const MAX_BLOCKS = 3;

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

  // A design that writes light ink straight onto an untreated photograph is a
  // caption waiting to disappear into a bright sky.
  if (spec.tone === "light" && spec.photo.treatment === "plain") {
    say("readable ink", "light type needs a scrim or a wash under it");
  }

  return found;
}
