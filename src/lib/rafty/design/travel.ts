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
        area: [1, 13, 1, 3],
        parts: [{ t: "brand" }],
      },
      {
        area: [1, 13, 7, 13],
        justify: "end",
        gap: "md",
        parts: [
          { t: "kicker" },
          { t: "headline", size: "hero" },
          { t: "facts" },
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
        area: [1, 13, 1, 3],
        parts: [{ t: "brand" }],
      },
      {
        area: [1, 13, 8, 13],
        justify: "end",
        panel: "paper",
        gap: "md",
        parts: [
          { t: "kicker" },
          { t: "headline", size: "large" },
          { t: "facts" },
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
        area: [1, 13, 1, 3],
        align: "center",
        parts: [{ t: "brand" }],
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
        area: [1, 13, 11, 13],
        align: "center",
        justify: "end",
        gap: "sm",
        parts: [{ t: "cta", as: "tag" }, { t: "contact" }],
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
        parts: [{ t: "brand" }, { t: "kicker" }],
      },
      {
        area: [1, 13, 7, 13],
        justify: "end",
        panel: "veil",
        gap: "md",
        parts: [
          { t: "headline", size: "large" },
          { t: "included", as: "ticks", limit: 3 },
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
        parts: [{ t: "brand" }, { t: "headline", size: "large" }, { t: "facts" }],
      },
      {
        area: [1, 13, 10, 13],
        justify: "end",
        gap: "sm",
        parts: [
          { t: "included", as: "line", limit: 4 },
          { t: "price", as: "plain" },
          { t: "contact" },
        ],
      },
    ],
  },
];
