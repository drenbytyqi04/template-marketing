import type { DesignSpec } from "./spec";

/**
 * The AltaVia layout.
 *
 * Built from a poster the agency was already running: the destination set
 * enormous in the top corner, the terms in two quiet lines under it, the price
 * held in a hairline box out in the middle of the picture, and the mark signed
 * off at the foot between two short rules. The photograph is not touched at
 * all - no scrim, no panel, no wash - and the type carries its own edge to
 * stand off a bright sky, which on that poster is most of the frame.
 *
 * What makes it read as theirs rather than as another poster is the box. It is
 * empty: a hairline in the brand's own colour with the picture showing through,
 * the figure large on the photograph itself and the words small in that same
 * colour. The number is not on a sticker stuck over the view; it is written on
 * the view.
 *
 * It draws every part a post can carry, like everything else in the library, so
 * moving to it from another design never silently drops a field. The parts the
 * original poster has no use for - an urgent line, a call to action, a phone
 * number - are placed where they belong and simply draw nothing until the post
 * fills them in.
 */
export const TRAVEL_ALTAVIA_DESIGNS: DesignSpec[] = [
  {
    id: "av_01",
    name: "AV1 AltaVia",
    tags: ["image_first", "bold"],
    for: ["travel_agency"],
    tone: "light",
    lift: true,
    photo: { treatment: "plain" },
    blocks: [
      {
        area: [1, 13, 1, 3],
        gap: "sm",
        parts: [{ t: "stamp", as: "tag" }],
      },
      {
        // The corner the eye starts in. Nothing shares it.
        area: [1, 13, 3, 8],
        gap: "sm",
        parts: [
          { t: "kicker", as: "caps" },
          // Set to the column, not to a step on the scale. The destination is
          // the poster, and a destination that stops two thirds of the way
          // across the measure is a headline on a layout rather than a poster.
          { t: "headline", size: "banner", caps: true },
          // The two lines under the name, stacked and large, the way the
          // printed offer has them: how long, and what is in it. They are the
          // same size as each other on purpose - one group, read in one go.
          { t: "facts", as: "stack", limit: 2 },
          { t: "included", as: "terms", limit: 2 },
        ],
      },
      {
        // Held off the left edge, out over the picture, the way the poster
        // places it: far enough in that it reads as an object sitting on the
        // photograph rather than as another line of the block above.
        //
        // A row of the field is left empty above it as well. Butted straight
        // against the block above, a tall frame with every field filled in put
        // the terms over the top of the box; the air is what the poster has
        // there anyway, and it is what keeps the box an object rather than the
        // next line down.
        area: [4, 13, 9, 11],
        gap: "md",
        parts: [{ t: "price", as: "outline" }, { t: "cta", as: "tag" }, { t: "contact" }],
      },
      {
        // The sign-off: a rule, the mark, a rule, centred on the foot.
        area: [1, 13, 11, 13],
        row: true,
        align: "center",
        justify: "end",
        gap: "md",
        parts: [{ t: "rule" }, { t: "brand" }, { t: "rule" }],
      },
    ],
  },
];
