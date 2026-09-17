import type { DesignSpec } from "./spec";

/**
 * Five designs for a travel agency.
 *
 * Each one leads with a single thing and holds at most three blocks, so the
 * frame has somewhere to breathe and the eye is told where to start. They share
 * the page margin, the field and the type scale, which is what makes two posts
 * from one brand read as a pair rather than as two unrelated adverts.
 */
export const TRAVEL_DESIGNS: DesignSpec[] = [
  {
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
        area: [1, 13, 7, 13],
        justify: "end",
        gap: "md",
        parts: [
          { t: "kicker" },
          { t: "headline", size: "hero" },
          { t: "facts" },
          { t: "included", as: "chips" },
          { t: "price", as: "badge" },
          { t: "contact" },
        ],
      },
    ],
  },
  {
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
        area: [1, 13, 6, 13],
        justify: "end",
        panel: "paper",
        gap: "md",
        parts: [
          { t: "kicker" },
          { t: "headline", size: "large" },
          { t: "facts" },
          { t: "included", as: "chips" },
          { t: "price", as: "plain" },
        ],
      },
    ],
  },
  {
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
        area: [2, 12, 5, 9],
        align: "center",
        justify: "center",
        gap: "md",
        parts: [
          { t: "kicker" },
          { t: "headline", size: "large" },
          { t: "rule" },
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
        parts: [{ t: "brand" }, { t: "kicker" }, { t: "stamp", as: "tag" }],
      },
      {
        area: [1, 13, 7, 13],
        justify: "end",
        panel: "veil",
        gap: "md",
        parts: [
          { t: "headline", size: "large" },
          { t: "included", as: "ticks" },
          { t: "price", as: "badge" },
          { t: "cta", as: "bar" },
        ],
      },
    ],
  },
  {
    id: "tr_05",
    name: "T05 Top Story",
    tags: ["editorial", "type_first"],
    for: ["travel_agency"],
    tone: "light",
    photo: { treatment: "scrimBoth", strength: 0.9 },
    blocks: [
      {
        area: [1, 13, 1, 6],
        gap: "md",
        parts: [
          { t: "brand" },
          { t: "stamp", as: "tag" },
          { t: "headline", size: "large" },
          { t: "facts" },
        ],
      },
      {
        area: [1, 13, 10, 13],
        justify: "end",
        gap: "sm",
        parts: [{ t: "included", as: "line" }, { t: "price", as: "plain" }, { t: "contact" }],
      },
    ],
  },
  {
    // The first design in the set that writes dark, and the first that leaves
    // the photograph alone. The other five all lay white type over a darkened
    // picture, so a bright, pale, busy frame - what a beach holiday actually
    // photographs as - has to be fought with a scrim before it can be written
    // on. A sheet of paper does not care how bright the picture behind it is.
    // Everything that writes in dark ink stays on that sheet; the ribbon above
    // it carries its own ground.
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
        area: [1, 13, 4, 13],
        justify: "center",
        panel: "paper",
        gap: "md",
        parts: [
          { t: "kicker" },
          { t: "headline", size: "large" },
          { t: "rule" },
          { t: "facts" },
          { t: "included", as: "ticks" },
          { t: "price", as: "plain" },
          { t: "contact" },
        ],
      },
    ],
  },
  {
    // Type first, on the brand's own colour. No photograph carries this one, so
    // it is the design to reach for when the only picture to hand is a weak
    // one - and the only design in the set where the brand colour is the
    // ground rather than an accent on somebody else's photo.
    id: "tr_07",
    name: "T07 Brand Block",
    tags: ["bold", "type_first"],
    for: ["travel_agency"],
    tone: "light",
    photo: { treatment: "scrimBottom", strength: 0.5 },
    blocks: [
      {
        area: [1, 13, 1, 3],
        parts: [{ t: "brand" }],
      },
      {
        area: [1, 13, 5, 12],
        justify: "center",
        panel: "brand",
        gap: "md",
        parts: [
          { t: "stamp", as: "tag" },
          { t: "headline", size: "large" },
          { t: "included", as: "line" },
          { t: "price", as: "plain" },
          { t: "cta", as: "tag" },
        ],
      },
    ],
  },
  {
    // The wash: the whole frame taken over by the brand colour, with the
    // photograph reading through it as texture. Built for the loud posts - a
    // flash sale, a last minute block - where the picture is a mood and the
    // offer is the message.
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
          { t: "price", as: "plain" },
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
    // The post an agency makes every week and the system could not make once:
    // a season on one card, several destinations against their prices. It is
    // the only design that reads the offers list, and the spec rules keep it
    // from also setting a single price beside them.
    id: "tr_09",
    name: "T09 Price List",
    tags: ["editorial", "offer"],
    for: ["travel_agency"],
    tone: "dark",
    photo: { treatment: "plain" },
    blocks: [
      {
        // Only the ribbon sits on the bare photograph, and a ribbon carries its
        // own ground. Everything that writes in the design's ink - and this
        // design's ink is dark - stays on the paper below, where it is legible
        // whatever picture the agency uploaded.
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
          { t: "offers" },
          { t: "included", as: "line" },
          { t: "contact" },
        ],
      },
    ],
  },
];
