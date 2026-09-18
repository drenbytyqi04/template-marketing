import type { DesignSpec } from "./spec";

/**
 * The designs a travel agency posts with.
 *
 * Every one of them draws every part a post can carry: the offer, where it is,
 * the hotel and the dates and where it leaves from, what it costs and what it
 * cost before, what is included, the urgent line, the call to action, the brand
 * and how to reach it. That is not a stylistic preference, it is what stops a
 * customer losing a field by choosing a different layout - they fill the form
 * in once and every design in the library says all of it. `checkSpec` holds the
 * rule so it cannot quietly lapse again.
 *
 * What a design is free to decide is arrangement and voice: where the weight
 * sits in the frame, what ground the type is written on, and which form each
 * part takes - a price as a badge or set plain, what is included as chips,
 * ticks or one quiet line, a call to action as a full bar or a small tag. Nine
 * designs sharing nine parts and one page margin still read as nine designs,
 * because that is where the difference between designs actually lives.
 */
export const TRAVEL_DESIGNS: DesignSpec[] = [
  {
    // Weight low, picture open above it: the default, and the one that most
    // flatters a photograph worth showing.
    id: "tr_01",
    name: "T01 Lower Third",
    tags: ["image_first", "minimal"],
    for: ["travel_agency"],
    tone: "light",
    photo: { treatment: "scrimBottom" },
    blocks: [
      {
        area: [1, 13, 1, 4],
        gap: "sm",
        parts: [{ t: "brand" }, { t: "stamp", as: "ribbon" }],
      },
      {
        area: [1, 13, 5, 11],
        justify: "end",
        gap: "md",
        parts: [
          { t: "kicker" },
          { t: "headline", size: "hero" },
          { t: "facts" },
          { t: "price", as: "badge" },
        ],
      },
      {
        area: [1, 13, 11, 13],
        justify: "end",
        gap: "sm",
        parts: [{ t: "included", as: "chips" }, { t: "cta", as: "bar" }, { t: "contact" }],
      },
    ],
  },
  {
    // A sheet of paper resting on the foot of the picture. The offer is read
    // off the paper; the photograph is the window above it.
    id: "tr_02",
    name: "T02 Paper Foot",
    tags: ["editorial", "light"],
    for: ["travel_agency"],
    tone: "light",
    photo: { treatment: "scrimTop", strength: 0.7 },
    blocks: [
      {
        area: [1, 13, 1, 4],
        gap: "sm",
        parts: [{ t: "brand" }, { t: "stamp", as: "ribbon" }],
      },
      {
        area: [1, 13, 5, 13],
        justify: "end",
        panel: "paper",
        gap: "md",
        parts: [
          { t: "kicker" },
          { t: "headline", size: "large" },
          { t: "facts" },
          { t: "included", as: "chips" },
          { t: "price", as: "plain" },
          { t: "cta", as: "tag" },
          { t: "contact" },
        ],
      },
    ],
  },
  {
    // Centred and quiet, the offer held in the middle of the frame with air on
    // both sides. The only design in the set that is symmetrical.
    id: "tr_03",
    name: "T03 Quiet Centre",
    tags: ["minimal", "centered"],
    for: ["travel_agency"],
    tone: "light",
    photo: { treatment: "scrimBoth", strength: 0.85 },
    blocks: [
      {
        area: [1, 13, 1, 4],
        align: "center",
        gap: "sm",
        parts: [{ t: "brand" }, { t: "stamp", as: "tag" }],
      },
      {
        area: [2, 12, 4, 10],
        align: "center",
        justify: "center",
        gap: "md",
        parts: [
          { t: "kicker" },
          { t: "headline", size: "large" },
          { t: "rule" },
          { t: "facts" },
          { t: "price", as: "plain" },
        ],
      },
      {
        area: [1, 13, 10, 13],
        align: "center",
        justify: "end",
        gap: "sm",
        parts: [{ t: "included", as: "line" }, { t: "cta", as: "tag" }, { t: "contact" }],
      },
    ],
  },
  {
    // The loud one: a tinted panel holding the whole offer, ticked list and a
    // full width call to action. Built to be read at a glance in a feed.
    id: "tr_04",
    name: "T04 Offer Panel",
    tags: ["bold", "offer"],
    for: ["travel_agency"],
    tone: "light",
    photo: { treatment: "scrimBottom", strength: 0.6 },
    blocks: [
      {
        area: [1, 13, 1, 4],
        gap: "sm",
        parts: [{ t: "brand" }, { t: "stamp", as: "tag" }],
      },
      {
        area: [1, 13, 5, 13],
        justify: "end",
        panel: "veil",
        gap: "md",
        parts: [
          { t: "kicker" },
          { t: "headline", size: "large" },
          { t: "facts" },
          { t: "included", as: "ticks" },
          { t: "price", as: "badge" },
          { t: "cta", as: "bar" },
          { t: "contact" },
        ],
      },
    ],
  },
  {
    // Type first, at the top, the way a magazine opens a piece. The picture
    // gets the middle of the frame to itself.
    id: "tr_05",
    name: "T05 Top Story",
    tags: ["editorial", "type_first"],
    for: ["travel_agency"],
    tone: "light",
    photo: { treatment: "scrimBoth", strength: 0.9 },
    blocks: [
      {
        area: [1, 13, 1, 7],
        gap: "md",
        parts: [
          { t: "brand" },
          { t: "stamp", as: "tag" },
          { t: "kicker" },
          { t: "headline", size: "large" },
          { t: "facts" },
        ],
      },
      {
        area: [1, 13, 9, 13],
        justify: "end",
        gap: "sm",
        parts: [
          { t: "included", as: "line" },
          { t: "price", as: "plain" },
          { t: "cta", as: "tag" },
          { t: "contact" },
        ],
      },
    ],
  },
  {
    // Dark ink on a sheet of paper over an untouched photograph. Every other
    // design lays white type over a darkened picture, so a bright, pale, busy
    // frame - what a beach holiday actually photographs as - has to be fought
    // with a scrim before it can be written on. Paper does not care how bright
    // the picture behind it is. Everything writing in the design's ink stays on
    // the sheet; only the ribbon sits on the bare photograph, and a ribbon
    // brings its own ground.
    id: "tr_06",
    name: "T06 Paper Sheet",
    tags: ["editorial", "light"],
    for: ["travel_agency"],
    tone: "dark",
    photo: { treatment: "plain" },
    blocks: [
      {
        area: [1, 13, 1, 3],
        parts: [{ t: "stamp", as: "ribbon" }],
      },
      {
        area: [1, 13, 3, 13],
        justify: "center",
        panel: "paper",
        gap: "md",
        parts: [
          { t: "brand" },
          { t: "kicker" },
          { t: "headline", size: "large" },
          { t: "rule" },
          { t: "facts" },
          { t: "included", as: "ticks" },
          { t: "price", as: "plain" },
          { t: "cta", as: "tag" },
          { t: "contact" },
        ],
      },
    ],
  },
  {
    // The offer set on the brand's own colour rather than as an accent on
    // somebody else's photograph. The design to reach for when the only
    // picture to hand is a weak one.
    id: "tr_07",
    name: "T07 Brand Block",
    tags: ["bold", "type_first"],
    for: ["travel_agency"],
    tone: "light",
    photo: { treatment: "scrimBottom", strength: 0.5 },
    blocks: [
      {
        area: [1, 13, 1, 4],
        gap: "sm",
        parts: [{ t: "brand" }, { t: "stamp", as: "tag" }],
      },
      {
        area: [1, 13, 4, 12],
        justify: "center",
        panel: "brand",
        gap: "md",
        parts: [
          { t: "kicker" },
          { t: "headline", size: "large" },
          { t: "facts" },
          { t: "included", as: "line" },
          { t: "price", as: "plain" },
          { t: "cta", as: "tag" },
        ],
      },
      {
        area: [1, 13, 12, 13],
        justify: "end",
        parts: [{ t: "contact" }],
      },
    ],
  },
  {
    // The whole frame taken over by the brand colour, the photograph reading
    // through it as texture. For the loud posts - a flash sale, a last minute
    // block - where the picture is a mood and the offer is the message.
    id: "tr_08",
    name: "T08 Full Wash",
    tags: ["bold", "offer"],
    for: ["travel_agency"],
    tone: "light",
    photo: { treatment: "wash", strength: 0.92 },
    blocks: [
      {
        area: [1, 13, 1, 4],
        align: "center",
        gap: "sm",
        parts: [{ t: "brand" }, { t: "stamp", as: "ribbon" }],
      },
      {
        area: [1, 13, 4, 10],
        align: "center",
        justify: "center",
        gap: "md",
        parts: [
          { t: "kicker" },
          { t: "headline", size: "hero" },
          { t: "rule" },
          { t: "facts" },
          { t: "price", as: "badge" },
        ],
      },
      {
        area: [1, 13, 10, 13],
        align: "center",
        justify: "end",
        gap: "sm",
        parts: [{ t: "included", as: "chips" }, { t: "cta", as: "bar" }, { t: "contact" }],
      },
    ],
  },
  {
    // The post an agency makes every week and this system could not make once:
    // several destinations against their prices on one card. It is the only
    // design that reads the offers list, and the only one excused from setting
    // a single price - the list is the price, and printing both would ask the
    // reader which of the two to believe.
    id: "tr_09",
    name: "T09 Price List",
    tags: ["editorial", "offer"],
    for: ["travel_agency"],
    tone: "dark",
    photo: { treatment: "plain" },
    blocks: [
      {
        area: [1, 13, 1, 3],
        parts: [{ t: "stamp", as: "ribbon" }],
      },
      {
        area: [1, 13, 3, 13],
        justify: "end",
        panel: "paper",
        gap: "md",
        parts: [
          { t: "brand" },
          { t: "kicker" },
          { t: "headline", size: "medium" },
          { t: "facts" },
          { t: "offers" },
          { t: "included", as: "line" },
          { t: "cta", as: "tag" },
          { t: "contact" },
        ],
      },
    ],
  },
  {
    /**
     * Adria 1.0, built to the proportions of a printed travel offer rather than
     * invented: the reference was measured rather than eyeballed, and the
     * numbers are what this design is made of.
     *
     *   page margin   10.7% of the width, where the rest of the library uses 7
     *   logo          top left, on the margin
     *   ribbon        just under it, at a fifth of the width
     *   empty         the whole middle third carries nothing at all
     *   hotel         set in a hand, leaning on the headline below it
     *   destination   the largest thing in the frame by a distance
     *   foot          the details on the left, the price square to their right
     *
     * The wide margin and the empty middle are the design. Everything sits on
     * one left edge and nothing competes with the destination, which is why it
     * reads from across a room.
     *
     * The scrim is heavier than the reference, which laid its type straight
     * onto the picture and got away with it because that particular photograph
     * happened to be dark where the words sat. A template cannot count on the
     * next photograph doing the same, so the lower half is darkened and the top
     * lightly, which keeps the open middle the composition depends on while the
     * logo and the destination stay readable over anything.
     */
    id: "tr_10",
    name: "Adria 1.0",
    tags: ["bold", "offer"],
    for: ["travel_agency"],
    tone: "light",
    photo: { treatment: "scrimBoth", strength: 0.85 },
    page: 10.7,
    blocks: [
      {
        area: [1, 13, 1, 4],
        gap: "md",
        parts: [{ t: "brand" }, { t: "stamp", as: "ribbon" }],
      },
      {
        // The middle of the frame is deliberately not addressed by any block.
        area: [1, 13, 5, 9],
        justify: "end",
        gap: "sm",
        parts: [
          { t: "kicker", as: "script" },
          { t: "headline", size: "display" },
        ],
      },
      {
        // The foot is two columns, which is what the field is for. Splitting it
        // with a row of parts instead let the details run the full width and
        // pushed the price onto its own line, which is the one arrangement this
        // design must not have.
        area: [1, 7, 10, 13],
        justify: "end",
        gap: "sm",
        parts: [{ t: "facts" }, { t: "included", as: "line" }, { t: "contact" }],
      },
      {
        area: [7, 13, 10, 13],
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
];
