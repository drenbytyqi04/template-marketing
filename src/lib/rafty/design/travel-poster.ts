import type { DesignSpec } from "./spec";

/**
 * The poster set: type written straight onto the photograph.
 *
 * The rest of the library darkens the picture under its writing. That is the
 * safe way to keep light type readable and it is also the thing a customer sees
 * first when they did not want it - the photograph they chose, dimmed, with a
 * grey wash across the half the words sit on. These ten leave the picture
 * completely alone. Nothing is laid over it, no gradient, no panel behind the
 * headline; the letters carry their own edge instead, which is how a printed
 * travel poster has always done it.
 *
 * They share one voice, taken from the posters this set was asked for: a hotel
 * or a region named small in a hand above, the destination set enormous in
 * caps under it, the terms in two or three quiet lines below that, and the
 * figure in a hard-cornered sticker off to one side. What separates one design
 * from the next is where that weight sits in the frame and how much of the
 * photograph is left to breathe around it - which, on a picture nothing is
 * covering, is the whole of the design.
 *
 * Every one still draws every part a post can carry, so moving between them
 * never silently drops a field the customer filled in.
 */
export const TRAVEL_POSTER_DESIGNS: DesignSpec[] = [
  {
    // The reference layout: weight just above centre, the foreground of the
    // photograph left open underneath it.
    id: "tp_01",
    name: "P01 Poster Middle",
    tags: ["image_first", "bold"],
    for: ["travel_agency"],
    tone: "light",
    lift: true,
    photo: { treatment: "plain" },
    blocks: [
      {
        area: [1, 13, 1, 3],
        gap: "sm",
        parts: [{ t: "brand" }, { t: "stamp", as: "tag" }],
      },
      {
        area: [1, 13, 4, 9],
        justify: "end",
        gap: "sm",
        parts: [
          { t: "kicker", as: "script" },
          { t: "headline", size: "display" },
          { t: "facts", limit: 3 },
          { t: "price", as: "block" },
        ],
      },
      {
        area: [1, 13, 11, 13],
        justify: "end",
        gap: "sm",
        parts: [{ t: "included", as: "line" }, { t: "cta", as: "tag" }, { t: "contact" }],
      },
    ],
  },
  {
    // Everything low, so the top two thirds of the picture carry the post on
    // their own. The one to reach for when the photograph has a sky worth
    // keeping.
    id: "tp_02",
    name: "P02 Poster Foot",
    tags: ["image_first", "minimal"],
    for: ["travel_agency"],
    tone: "light",
    lift: true,
    photo: { treatment: "plain" },
    blocks: [
      {
        area: [1, 13, 1, 3],
        gap: "sm",
        parts: [{ t: "brand" }, { t: "stamp", as: "tag" }],
      },
      {
        area: [1, 13, 6, 11],
        justify: "end",
        gap: "sm",
        parts: [
          { t: "kicker", as: "script" },
          { t: "headline", size: "hero" },
          { t: "facts", limit: 3 },
          { t: "price", as: "block" },
        ],
      },
      {
        area: [1, 13, 11, 13],
        justify: "end",
        gap: "sm",
        parts: [{ t: "included", as: "line" }, { t: "cta", as: "tag" }, { t: "contact" }],
      },
    ],
  },
  {
    // Read from the top down, the way a magazine cover is. The photograph's
    // subject is expected to be low in the frame.
    id: "tp_03",
    name: "P03 Poster Head",
    tags: ["editorial", "bold"],
    for: ["travel_agency"],
    tone: "light",
    lift: true,
    photo: { treatment: "plain" },
    blocks: [
      {
        area: [1, 13, 1, 8],
        gap: "sm",
        parts: [
          { t: "stamp", as: "tag" },
          { t: "kicker", as: "script" },
          { t: "headline", size: "display" },
          { t: "facts", limit: 3 },
          { t: "price", as: "block" },
        ],
      },
      {
        area: [1, 13, 10, 13],
        justify: "end",
        gap: "sm",
        parts: [
          { t: "included", as: "line" },
          { t: "cta", as: "tag" },
          { t: "brand" },
          { t: "contact" },
        ],
      },
    ],
  },
  {
    // The headline holds the left, the figure sits on the right of the same
    // band. A wide frame reads this as one line rather than as a stack.
    id: "tp_04",
    name: "P04 Poster Split",
    tags: ["bold", "image_first"],
    for: ["travel_agency"],
    tone: "light",
    lift: true,
    photo: { treatment: "plain" },
    blocks: [
      {
        area: [1, 13, 1, 3],
        gap: "sm",
        parts: [{ t: "brand" }, { t: "stamp", as: "tag" }],
      },
      {
        area: [1, 9, 6, 11],
        justify: "end",
        gap: "sm",
        parts: [
          { t: "kicker", as: "script" },
          { t: "headline", size: "hero" },
          { t: "facts", limit: 3 },
        ],
      },
      {
        area: [9, 13, 8, 11],
        align: "end",
        justify: "end",
        gap: "sm",
        parts: [{ t: "price", as: "block" }],
      },
      {
        area: [1, 13, 11, 13],
        justify: "end",
        gap: "sm",
        parts: [{ t: "included", as: "line" }, { t: "cta", as: "tag" }, { t: "contact" }],
      },
    ],
  },
  {
    // Symmetrical, with air on both sides. The quietest design in the set, and
    // the only one that does not lean.
    id: "tp_05",
    name: "P05 Poster Centre",
    tags: ["minimal", "image_first"],
    for: ["travel_agency"],
    tone: "light",
    lift: true,
    photo: { treatment: "plain" },
    blocks: [
      {
        area: [1, 13, 1, 3],
        align: "center",
        gap: "sm",
        parts: [{ t: "brand" }],
      },
      {
        area: [2, 12, 4, 10],
        align: "center",
        justify: "center",
        gap: "sm",
        parts: [
          { t: "stamp", as: "tag" },
          { t: "kicker", as: "script" },
          { t: "headline", size: "hero" },
          { t: "facts", limit: 3 },
          { t: "price", as: "block" },
        ],
      },
      {
        area: [1, 13, 11, 13],
        align: "center",
        justify: "end",
        gap: "sm",
        parts: [{ t: "included", as: "line" }, { t: "cta", as: "tag" }, { t: "contact" }],
      },
    ],
  },
  {
    // Set from the right edge. A photograph whose subject sits left of centre
    // is given the whole of that side.
    id: "tp_06",
    name: "P06 Poster Right",
    tags: ["editorial", "image_first"],
    for: ["travel_agency"],
    tone: "light",
    lift: true,
    photo: { treatment: "plain" },
    blocks: [
      {
        area: [1, 13, 1, 3],
        align: "end",
        gap: "sm",
        parts: [{ t: "brand" }, { t: "stamp", as: "tag" }],
      },
      {
        area: [3, 13, 5, 11],
        align: "end",
        justify: "end",
        gap: "sm",
        parts: [
          { t: "kicker", as: "script" },
          { t: "headline", size: "hero" },
          { t: "facts", limit: 3 },
          { t: "price", as: "block" },
        ],
      },
      {
        area: [1, 13, 11, 13],
        align: "end",
        justify: "end",
        gap: "sm",
        parts: [{ t: "included", as: "line" }, { t: "cta", as: "tag" }, { t: "contact" }],
      },
    ],
  },
  {
    // The name across the top, the terms across the bottom, and the middle of
    // the picture left entirely alone.
    id: "tp_07",
    name: "P07 Poster Banner",
    tags: ["bold", "minimal"],
    for: ["travel_agency"],
    tone: "light",
    lift: true,
    photo: { treatment: "plain" },
    blocks: [
      {
        area: [1, 13, 1, 5],
        gap: "sm",
        parts: [
          { t: "kicker", as: "script" },
          { t: "headline", size: "hero" },
        ],
      },
      {
        area: [1, 13, 9, 13],
        justify: "end",
        gap: "sm",
        parts: [
          { t: "facts", limit: 3 },
          { t: "price", as: "block" },
          { t: "stamp", as: "tag" },
          { t: "included", as: "line" },
          { t: "cta", as: "tag" },
          { t: "brand" },
          { t: "contact" },
        ],
      },
    ],
  },
  {
    // A narrow column down the left. Half the frame is never written on at all,
    // which is what makes a busy photograph work.
    id: "tp_08",
    name: "P08 Poster Column",
    tags: ["editorial", "minimal"],
    for: ["travel_agency"],
    tone: "light",
    lift: true,
    photo: { treatment: "plain" },
    blocks: [
      {
        area: [1, 8, 1, 3],
        gap: "sm",
        parts: [{ t: "brand" }],
      },
      {
        area: [1, 8, 4, 11],
        justify: "end",
        gap: "sm",
        parts: [
          { t: "kicker", as: "script" },
          { t: "headline", size: "large" },
          { t: "facts", limit: 3 },
          { t: "stamp", as: "tag" },
          { t: "price", as: "block" },
        ],
      },
      {
        area: [1, 13, 11, 13],
        justify: "end",
        gap: "sm",
        parts: [{ t: "included", as: "line" }, { t: "cta", as: "tag" }, { t: "contact" }],
      },
    ],
  },
  {
    // Wide foot, with the figure held out to the right of it, the way a price
    // is stuck on the corner of a printed poster.
    id: "tp_09",
    name: "P09 Poster Wide Foot",
    tags: ["bold", "image_first"],
    for: ["travel_agency"],
    tone: "light",
    lift: true,
    photo: { treatment: "plain" },
    blocks: [
      {
        area: [1, 13, 1, 3],
        gap: "sm",
        parts: [{ t: "brand" }, { t: "stamp", as: "tag" }],
      },
      {
        area: [1, 9, 7, 13],
        justify: "end",
        gap: "sm",
        parts: [
          { t: "kicker", as: "script" },
          { t: "headline", size: "hero" },
          { t: "facts", limit: 3 },
          { t: "included", as: "line" },
          { t: "contact" },
        ],
      },
      {
        area: [9, 13, 8, 13],
        align: "end",
        justify: "end",
        gap: "sm",
        parts: [
          { t: "price", as: "block" },
          { t: "cta", as: "tag" },
        ],
      },
    ],
  },
  {
    // The largest setting in the set, low and heavy, with the terms kept to one
    // line so the headline can take as much of the frame as it wants.
    id: "tp_10",
    name: "P10 Poster Heavy",
    tags: ["bold", "image_first"],
    for: ["travel_agency"],
    tone: "light",
    lift: true,
    photo: { treatment: "plain" },
    blocks: [
      {
        area: [1, 13, 1, 3],
        gap: "sm",
        parts: [{ t: "brand" }, { t: "stamp", as: "tag" }],
      },
      {
        area: [1, 13, 4, 9],
        justify: "end",
        gap: "sm",
        parts: [
          { t: "kicker", as: "script" },
          { t: "headline", size: "display" },
          { t: "facts", limit: 2 },
        ],
      },
      {
        area: [1, 13, 9, 13],
        justify: "end",
        gap: "sm",
        parts: [
          { t: "price", as: "block" },
          { t: "included", as: "line" },
          { t: "cta", as: "tag" },
          { t: "contact" },
        ],
      },
    ],
  },
];
