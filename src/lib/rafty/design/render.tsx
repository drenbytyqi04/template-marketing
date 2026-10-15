import { useLayoutEffect, useRef, useState } from "react";
import { fieldLabel, formatPrice, SCRIPT_FONT } from "../constants";
import { alpha, INK, luminance, RADIUS, shade, SPACE, TRACK, TYPE, WEIGHT } from "../tokens";
import { FitText } from "@/components/rafty/FitText";
import type { RenderCtx } from "../templates";
import type { ElementAdjust, LanguageCode, MovableElement } from "../types";
import { MOVABLE_ELEMENTS } from "../types";
import type { Block, DesignSpec, Part, PhotoTreatment } from "./spec";
import { GRID } from "./spec";
import { ARRIVAL_ATTR, INTRO } from "./animation";

/**
 * The one renderer every design is drawn by.
 *
 * A design says what it holds and where; how each part looks is decided here,
 * once, from the tokens. That is the whole point of the format: a change to how
 * a price is set, or to what a headline weighs, lands on every design at the
 * same moment instead of on the ones someone remembered to edit.
 */

const px = (n: number) => `${n}cqw`;

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/**
 * The brand mark's box in the lockup.
 *
 * It was 5cqw, which put the mark at roughly the optical size of the words
 * beside it - and the mark is the one thing on a post that has to be
 * recognisable from a thumbnail in a feed, before anybody reads a word of it.
 *
 * The height can be raised safely only because of the width cap. A wordmark
 * three times wider than it is tall hits `maxWidth` first, and `contain` scales
 * it down inside the box, so a banner-shaped logo takes a sensible share of the
 * row instead of pushing the business name off the end of it.
 */
const LOGO = {
  height: 8,
  maxWidth: 38,
  /** What the customer may scale the mark to. Half size still reads; past three
   * times it stops being a logo on a post and becomes the post. */
  minScale: 0.5,
  maxScale: 3,
} as const;

/** The mark itself, at a multiple of the size the design gives it. Both the
 * lockup and a corner placement draw it through here, so a logo moved out of
 * the lockup is the same drawing in a different spot rather than a second
 * implementation that drifts from the first. */
function LogoMark({ src, scale, page }: { src: string; scale: number; page: number }) {
  return (
    <img
      src={src}
      alt=""
      crossOrigin="anonymous"
      style={{
        height: px(LOGO.height * scale),
        // Never wider than the design's own content width, whatever the scale:
        // a banner-shaped mark scaled up should grow until it spans the page
        // and then stop, not run off both sides of the frame.
        maxWidth: px(Math.min(LOGO.maxWidth * scale, 100 - page * 2)),
        width: "auto",
        objectFit: "contain",
      }}
    />
  );
}

/** How far a nudge may carry the mark from its corner, in cqw. The same bound
 * the text nudges use, for the same reason: a post that can be pushed out of
 * its own frame is not an adjustment, it is a way to ruin an export. */
const LOGO_NUDGE = 12;

/** The customer's own logo settings, resolved and clamped. A post saved before
 * this existed has none, and gets the design's answer. */
function logoAdjust(ctx: RenderCtx) {
  const a = ctx.adjustments?.logo;
  return {
    place: a?.place ?? "design",
    scale: clamp(a?.scale ?? 1, LOGO.minScale, LOGO.maxScale),
    x: clamp(a?.x ?? 0, -LOGO_NUDGE, LOGO_NUDGE),
    y: clamp(a?.y ?? 0, -LOGO_NUDGE, LOGO_NUDGE),
  };
}

/**
 * The mark pinned to a corner of the frame, when the customer has moved it out
 * of the lockup.
 *
 * It is drawn after the field, so it sits over the design rather than under it:
 * somebody who has deliberately placed their logo somewhere should not find a
 * headline on top of it. The insets start from the design's own page margin, so
 * a logo in a corner lines up with everything else on the page, and the nudges
 * stop at the edge rather than carrying it off the canvas.
 */
function FloatingLogo({
  ctx,
  page,
  band,
  arrival,
}: {
  ctx: RenderCtx;
  page: number;
  band: Band;
  arrival?: number;
}) {
  const logo = ctx.brand.logoDataUrl;
  const { place, scale, x, y } = logoAdjust(ctx);
  if (!logo || place === "design") return null;

  // A centred placement is pinned to the middle of the frame rather than to one
  // of its edges, so it is measured from 50% and pulled back by half its own
  // size. An edge placement starts from the page margin, which is what makes a
  // logo in a corner line up with everything else on the page.
  const middleX = place === "topCenter" || place === "center" || place === "bottomCenter";
  const middleY = place === "center";
  const top = place === "topLeft" || place === "topCenter" || place === "topRight";
  const left = place === "topLeft" || place === "bottomLeft";

  // The nudges stop at the edge rather than carrying the mark off the canvas.
  const inset = (base: number) => px(Math.max(0, base));
  const pullBack = [middleX ? "translateX(-50%)" : "", middleY ? "translateY(-50%)" : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      {...(arrival === undefined ? {} : { className: "krijo-intro", [ARRIVAL_ATTR]: arrival })}
      style={{
        ...(arrival === undefined
          ? {}
          : ({
              "--krijo-delay": `${arrival * INTRO.stagger}ms`,
              "--krijo-duration": `${INTRO.duration}ms`,
            } as React.CSSProperties)),
        position: "absolute",
        ...(middleY
          ? { top: px(band.midY + y) }
          : top
            ? { top: inset(band.top + page + y) }
            : { bottom: inset(band.bottom + page - y) }),
        ...(middleX
          ? { left: `calc(50% + ${x}cqw)` }
          : left
            ? { left: inset(page + x) }
            : { right: inset(page - x) }),
        ...(pullBack ? { transform: pullBack } : {}),
        display: "flex",
      }}
    >
      <LogoMark src={logo} scale={scale} page={page} />
    </div>
  );
}

/* ------------------------------ moved elements ----------------------------- */

/**
 * The movable names, checked against the parts a design is actually built
 * from.
 *
 * The list lives in the types file, which the spec cannot be imported into
 * without a cycle, so nothing there can say that "headline" is a real part. It
 * is said here instead, where both are in scope: the annotation fails to
 * compile the day a part is renamed in one file and not the other, which is
 * the only moment it could ever go wrong.
 */
const MOVABLE: ReadonlySet<Part["t"]> = new Set<Part["t"]>(MOVABLE_ELEMENTS);

/** How far a placed element may be nudged from its edge. The mark's limit, for
 * the same reason: past this it is not a nudge, it is a different corner. */
const ELEMENT_NUDGE = 12;

/**
 * The part of the frame something may be pinned to.
 *
 * Not the frame. A full height clip keeps room at the top and the bottom for
 * the profile row and the caption the app draws over them, and a mark pinned
 * to "top left" means the top left of the picture somebody can see, not the
 * top left of a rectangle a third of which is under a username. The grid
 * already works inside this band; anything pinned over the grid has to as
 * well, or the two disagree about where the top of the post is.
 *
 * `top` and `bottom` are the room taken off each end, and `midY` is the middle
 * of what is left - all in the same container relative unit as everything
 * else, measured down from the top of the frame.
 */
type Band = { top: number; bottom: number; midY: number };

function bandOf(ctx: RenderCtx): Band {
  const shape = ctx.canvas ? ctx.canvas.height / ctx.canvas.width : 1.25;
  const safe = ctx.safe ?? { top: 0, bottom: 0 };
  return { ...safe, midY: safe.top + (100 * shape - safe.top - safe.bottom) / 2 };
}

/**
 * Where this element has been placed, or nothing if it is where its design put
 * it - which is the answer for almost every element of almost every post.
 *
 * Read through the same clamps the controls use, because the controls are not
 * the only way a value gets here: a post saved by an older build, or a row
 * edited by hand, arrives through the same door.
 */
function elementAdjust(ctx: RenderCtx, kind: Part["t"]): ElementAdjust | null {
  if (!MOVABLE.has(kind)) return null;
  const set = ctx.adjustments?.elements?.[kind as MovableElement];
  if (!set || set.place === "design") return null;
  return {
    place: set.place,
    scale: clamp(set.scale ?? 1, 0.5, 3),
    x: clamp(set.x ?? 0, -ELEMENT_NUDGE, ELEMENT_NUDGE),
    y: clamp(set.y ?? 0, -ELEMENT_NUDGE, ELEMENT_NUDGE),
  };
}

/**
 * Pins one element to the frame, the way the mark is pinned.
 *
 * The geometry is the mark's, down to the insets starting at the page margin
 * so a placed element lines up with everything still in the layout. Type needs
 * two things a mark does not. It needs a measure: an element with no width to
 * wrap in would set a headline as one endless line, so the box spans the page
 * and the words wrap inside it. And it needs to know which way it reads: an
 * element pinned to the right of the frame sets its lines ragged left, because
 * a line that hangs off the edge it was pinned to is not pinned to it.
 *
 * The size multiplier is drawn rather than typeset - the element is scaled as a
 * whole, around the corner it was pinned to, so it grows into the frame instead
 * of off it. Everything inside keeps the proportions the design gave it.
 */
function PlacedPart({
  children,
  adjust,
  page,
  band,
  arrival,
}: {
  children: React.ReactNode;
  adjust: ElementAdjust;
  page: number;
  band: Band;
  arrival?: number;
}) {
  const { place, scale, x, y } = adjust;
  const middleX = place === "topCenter" || place === "center" || place === "bottomCenter";
  const middleY = place === "center";
  const top = place === "topLeft" || place === "topCenter" || place === "topRight";
  const left = place === "topLeft" || place === "bottomLeft";

  const inset = (base: number) => px(Math.max(0, base));
  const middleOf = (base: number, offset: number) => px(base + offset);
  const pullBack = [middleX ? "translateX(-50%)" : "", middleY ? "translateY(-50%)" : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      {...(arrival === undefined ? {} : { className: "krijo-intro", [ARRIVAL_ATTR]: arrival })}
      style={{
        ...(arrival === undefined
          ? {}
          : ({
              "--krijo-delay": `${arrival * INTRO.stagger}ms`,
              "--krijo-duration": `${INTRO.duration}ms`,
            } as React.CSSProperties)),
        position: "absolute",
        ...(middleY
          ? { top: middleOf(band.midY, y) }
          : top
            ? { top: inset(band.top + page + y) }
            : { bottom: inset(band.bottom + page - y) }),
        ...(middleX
          ? { left: `calc(50% + ${x}cqw)` }
          : left
            ? { left: inset(page + x) }
            : { right: inset(page - x) }),
        width: px(100 - page * 2),
        transform: [pullBack, scale === 1 ? "" : `scale(${scale})`].filter(Boolean).join(" "),
        transformOrigin: `${middleY ? "center" : top ? "top" : "bottom"} ${
          middleX ? "center" : left ? "left" : "right"
        }`,
        display: "flex",
        flexDirection: "column",
        alignItems: middleX ? "center" : left ? "flex-start" : "flex-end",
        textAlign: middleX ? "center" : left ? "left" : "right",
      }}
    >
      {children}
    </div>
  );
}

const font = (ctx: RenderCtx) =>
  `"${ctx.brand.fontFamily}", "Sora", ui-sans-serif, system-ui, sans-serif`;

const fontSecondary = (ctx: RenderCtx) =>
  `"${ctx.brand.fontSecondary || ctx.brand.fontFamily}", "Sora", ui-sans-serif, system-ui, sans-serif`;

/**
 * The handful of words a design prints on its own behalf.
 *
 * Everything else on a post is typed by the customer, so this is the only place
 * the renderer has to choose wording - and it chooses in the language the brand
 * posts in, not the one the app happens to be showing. An agency that sells in
 * Albanian should not get an English "from" over its price because someone left
 * the interface in English.
 */
const WORDS: Record<LanguageCode, { from: string }> = {
  en: { from: "from" },
  de: { from: "ab" },
  sq: { from: "nga" },
};

const words = (ctx: RenderCtx) => WORDS[ctx.brand.language] ?? WORDS.en;

const accent = (ctx: RenderCtx) =>
  ctx.variant.accent === "secondary"
    ? ctx.brand.secondary
    : ctx.variant.accent === "accent"
      ? ctx.brand.accent
      : ctx.brand.primary;

type Tone = "light" | "dark";

/**
 * The ink a tone writes in, at the three strengths a design needs.
 *
 * A design that darkens the picture under its type can afford to write the
 * quieter lines at half strength: they are read against a wash it controls. A
 * design that writes onto an untreated photograph cannot. White at sixty per
 * cent over a snowfield or a bright sky is not quiet, it is gone - the terms,
 * the dates and the phone number all were - so where the type is lifted rather
 * than backed, the strengths close right up and the shadow carries the
 * difference in weight instead of the opacity.
 */
const ink = (tone: Tone, lift?: boolean) => {
  if (tone === "light" && lift) {
    return {
      strong: INK.onDark,
      body: "rgba(255,255,255,0.97)",
      muted: "rgba(255,255,255,0.9)",
      faint: "rgba(255,255,255,0.62)",
    };
  }
  return {
    strong: tone === "light" ? INK.onDark : INK.strong,
    body: tone === "light" ? INK.onDarkBody : INK.body,
    muted: tone === "light" ? INK.onDarkMuted : INK.muted,
    faint: tone === "light" ? INK.onDarkFaint : INK.faint,
  };
};

/* ---------------------------------- photo ---------------------------------- */

/**
 * The ground under a post that has no picture yet.
 *
 * It has to be dark enough for light type whatever the brand's colour is, so a
 * bright primary is taken down first rather than trusted. A slight gradient
 * rather than a flat fill: a poster printed on one flat colour looks like a
 * fallback, the same colour with a little depth looks chosen.
 *
 * This is where "a design that works without a photograph" belongs - in the one
 * place that already decides what to draw when there is no photograph - rather
 * than as a treatment a design opts into. A design that refused to draw the
 * picture ignored one the customer had uploaded, which is not a design choice,
 * it is a design losing their work.
 */
function solidGround(primary: string): string {
  const base = luminance(primary) > 0.3 ? shade(primary, 0.55) : primary;
  return `linear-gradient(160deg, ${base}, ${shade(base, 0.42)})`;
}

function Photo({
  ctx,
  treatment,
  strength = 1,
}: {
  ctx: RenderCtx;
  treatment: PhotoTreatment;
  strength?: number;
}) {
  const { content, brand } = ctx;
  const deep = shade(brand.primary, 0.74);
  const s = Math.min(1, Math.max(0, strength));
  const ramps: Record<PhotoTreatment, string | null> = {
    plain: null,
    scrimBottom: `linear-gradient(to top, ${alpha(deep, 0.9 * s)} 4%, ${alpha(deep, 0.46 * s)} 32%, ${alpha(deep, 0)} 66%)`,
    scrimTop: `linear-gradient(to bottom, ${alpha(deep, 0.82 * s)} 0%, ${alpha(deep, 0.26 * s)} 28%, ${alpha(deep, 0)} 56%)`,
    scrimBoth: `linear-gradient(to bottom, ${alpha(deep, 0.7 * s)} 0%, ${alpha(deep, 0)} 32%, ${alpha(deep, 0)} 50%, ${alpha(deep, 0.9 * s)} 96%)`,
    wash: `linear-gradient(150deg, ${alpha(brand.primary, 0.84 * s)}, ${alpha(deep, 0.92 * s)})`,
  };
  const ramp = ramps[treatment];
  const fill: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    height: "100%",
    width: "100%",
    objectFit: "cover",
  };
  return (
    <>
      {content.videoDataUrl ? (
        <video
          src={content.videoDataUrl}
          autoPlay
          loop
          muted
          playsInline
          crossOrigin="anonymous"
          style={fill}
        />
      ) : content.imageDataUrl ? (
        <img src={content.imageDataUrl} alt="" crossOrigin="anonymous" style={fill} />
      ) : (
        <div
          style={{
            ...fill,
            background: solidGround(brand.primary),
          }}
        />
      )}
      {ramp ? <div style={{ position: "absolute", inset: 0, background: ramp }} /> : null}
    </>
  );
}

/* ---------------------------------- parts ---------------------------------- */

const HEADLINE_SIZE = {
  banner: TYPE.banner,
  display: TYPE.display,
  hero: TYPE.hero,
  large: TYPE.h1,
  medium: TYPE.h2,
} as const;

function Kicker({
  ctx,
  tone,
  as = "caps",
}: {
  ctx: RenderCtx;
  tone: Tone;
  as?: "caps" | "script";
}) {
  const value = (ctx.content.subject || ctx.content.location).trim();
  if (!value) return null;
  // The brand colour is only legible where the design put a ground under it.
  // Over a photograph the kicker keeps the design's own ink, and the accent is
  // spent on the price and the call to action instead.
  const color = tone === "dark" ? accent(ctx) : INK.onDarkBody;
  if (as === "script") {
    // Set in a hand, large, and leaning into the headline beneath it. Travel
    // posters have named the hotel this way for as long as there have been
    // travel posters, and it is the one place a display face earns its keep.
    return (
      <span
        style={{
          fontSize: px(TYPE.h3),
          fontWeight: WEIGHT.bold,
          lineHeight: 1,
          letterSpacing: TRACK.normal,
          color: tone === "dark" ? INK.strong : INK.onDark,
          fontFamily: `"${SCRIPT_FONT}", ui-rounded, cursive`,
        }}
      >
        {value}
      </span>
    );
  }
  return (
    <span
      style={{
        fontSize: px(TYPE.label),
        fontWeight: WEIGHT.bold,
        letterSpacing: TRACK.wider,
        textTransform: "uppercase",
        color,
        fontFamily: fontSecondary(ctx),
      }}
    >
      {value}
    </span>
  );
}

/** The contact line a post prints, as one string. Written once so the room it
 * is given and the text that goes in it are measured from the same thing. */
function contactLine(ctx: RenderCtx): string {
  const c = ctx.brand.contact;
  if (!c) return "";
  const parts = [c.phones.filter(Boolean)[0], c.website, c.address].filter(
    (v): v is string => !!v && v.trim().length > 0,
  );
  return parts.join("  ·  ");
}

/**
 * How much room a part asks for, in cqw, before anything is drawn.
 *
 * The headline is the one part that gives: it is fitted to whatever the block
 * has left once the others are accounted for. Working that out from the tokens
 * and from what the post actually carries keeps the answer stable, which
 * matters more than it sounds - deriving it from the laid out box instead put
 * the two in a loop, each shrinking the other until the headline bottomed out
 * at its minimum on every design. A part with nothing to draw asks for nothing,
 * so an empty field hands its room back to the headline.
 */
function reserveOf(part: Part, ctx: RenderCtx, term: number = TYPE.h2): number {
  const { content } = ctx;
  const has = (value: string | undefined) => !!value && value.trim().length > 0;
  switch (part.t) {
    case "kicker":
      if (!has(content.subject) && !has(content.location)) return 0;
      return (part.as === "script" ? TYPE.h3 : TYPE.label) * 1.4;
    case "headline":
      return 0;
    case "price": {
      if (!formatPrice(content.price, ctx.brand.currency)) return 0;
      const base =
        part.as === "badge"
          ? TYPE.h3 * 1.2 + SPACE.sm * 2
          : part.as === "block"
            ? TYPE.h2 * 1.2 + SPACE.md * 2
            : part.as === "outline"
              ? TYPE.hero * 1.2 + SPACE.md * 2 + SPACE.sm
              : TYPE.h2 * 1.2;
      // "from", a struck old price and a unit wrap onto a second line in a
      // narrow block, so they are worth a line of small type between them.
      const extras =
        [content.priceWas, content.priceUnit].filter(has).length + (content.priceFrom ? 1 : 0);
      return base + (extras ? TYPE.label * 1.4 : 0);
    }
    case "stamp":
      return has(content.additionalText) ? TYPE.label * 1.4 + SPACE.xs * 2 : 0;
    case "offers": {
      const n = offerRows(ctx, part.limit ?? 4).length;
      return n ? n * (TYPE.lead * 1.4 + SPACE.sm) : 0;
    }
    case "facts": {
      // meta2 belongs here as much as the rest. Leaving it out quietly dropped
      // whatever a trade had put in its second detail slot - a property's area,
      // a trip's departure city - from every design in the library.
      //
      // Measured by length rather than by count: now that each fact prints the
      // name of its field as well as its answer the row is roughly twice as
      // long, and a reserve of one line would hand the headline room that the
      // second line of facts is about to take back.
      const rows = facts(ctx, part.limit ?? FACTS_LIMIT);
      if (!rows.length) return 0;
      // Stacked terms take a line each, at the terms size, plus the hairline
      // between them. They are the one shape here that is counted rather than
      // measured by length, because each one is on its own line by
      // construction; a term long enough to wrap is the exception, and the
      // allowance below covers one of them.
      if (part.as === "stack") {
        const lines = rows.reduce((n, f) => n + termRows(f.value, term), 0);
        return lines * (term * TERM_LEADING) + (rows.length - 1) * TERM_GAP;
      }
      const chars = rows.reduce((n, f) => n + f.label.length + f.value.length + 5, 0);
      return Math.max(1, Math.ceil(chars / 40)) * (TYPE.body * 1.5);
    }
    case "included": {
      const n = includedItems(ctx, part.limit).length;
      if (!n) return 0;
      if (part.as === "terms") {
        const lines = includedItems(ctx, part.limit).reduce((t, s) => t + termRows(s, term), 0);
        return lines * (term * TERM_LEADING) + (n - 1) * TERM_GAP;
      }
      if (part.as === "ticks") {
        const rows = Math.ceil(n / (n > 4 ? 2 : 1));
        return rows * (TYPE.body * 1.5 + SPACE.xs);
      }
      if (part.as === "chips") {
        // Chips wrap: roughly three to a row at the widths these blocks run to.
        const rows = Math.ceil(n / 3);
        return rows * (TYPE.label * 1.5 + SPACE.xxs * 2) + (rows - 1) * SPACE.xs;
      }
      // A line wraps by character count rather than by item count.
      const chars = includedItems(ctx, part.limit).join("   ").length;
      return Math.max(1, Math.ceil(chars / 44)) * (TYPE.body * 1.5);
    }
    case "cta":
      if (!has(content.cta)) return 0;
      return part.as === "bar" ? TYPE.body * 1.4 + SPACE.sm * 2 : TYPE.body * 1.4 + SPACE.xs * 2;
    case "brand": {
      // The row is as tall as its tallest half, not a flat 5 for either. A
      // lockup that is only a name asked for a mark's worth of room it never
      // used, and now that the mark is the taller of the two it has to say so -
      // at whatever size the customer set, and only while the mark is still in
      // the lockup at all. A logo moved to a corner hands its room back to the
      // headline, which is the whole point of having moved it.
      const { place, scale } = logoAdjust(ctx);
      const name = ctx.showBrandName && ctx.businessName ? TYPE.body * 1.5 : 0;
      const mark = ctx.brand.logoDataUrl && place === "design" ? LOGO.height * scale : 0;
      return Math.max(mark, name);
    }
    case "contact":
      // Measured by length, like the details are: a phone number, a website and
      // a town run past one line in a narrow block, and reserving a single line
      // would hand the headline room the second line is about to take back.
      if (!ctx.showContact) return 0;
      return Math.max(1, Math.ceil(contactLine(ctx).length / 38)) * (TYPE.body * 1.5);
    case "rule":
      return 0.4;
    default:
      return 0;
  }
}

/**
 * How close two lines of a headline may be set, decided by the headline.
 *
 * A line of type is allowed to be tighter than its own line box, and a headline
 * that has to shrink is tightened to buy a line back. Capitals have no
 * descender, so tightening a capitalised headline looks free - and is not. What
 * decides the floor is how high the face paints above the baseline, and a
 * capital carrying a mark paints much higher than a bare one. Measured on this
 * library's heavy face: a plain E reaches 0.73 of the type size above the
 * baseline, an E with a diaeresis reaches 0.97.
 *
 * At 0.96 the baselines sit closer together than that, so the dots of NETË,
 * GREQISË, PRANVERË - which is most of a sentence in Albanian - were painted
 * through the letters of the line above. 1.02 stops them touching and still
 * reads as a near miss, because the marks end a hair under the line above
 * rather than clear of it.
 *
 * So the leading is read off the text. A headline with a marked capital in it
 * is set with the room that mark needs; every other headline keeps the tight
 * setting the library was drawn around, and no existing design moves. The test
 * decomposes first, so a precomposed Ë and an E followed by a combining
 * diaeresis are the same letter, which they are.
 */
const MARKED_CAPITAL = /\p{Lu}\p{M}/u;

function leadingFor(drawn: string): { normal: number; tight: number } {
  return MARKED_CAPITAL.test(drawn.normalize("NFD"))
    ? { normal: 1.2, tight: 1.16 }
    : { normal: 1.02, tight: 0.96 };
}

function Headline({
  ctx,
  tone,
  size,
  room,
  caps,
}: {
  ctx: RenderCtx;
  tone: Tone;
  size: keyof typeof HEADLINE_SIZE;
  room?: number;
  caps?: boolean;
}) {
  const max = HEADLINE_SIZE[size];
  const lines = 3;
  const text = ctx.content.title || "Your headline here";
  const leading = leadingFor(caps ? text.toUpperCase() : text);
  // The floor gives way before the box does. A block whose other parts have
  // taken nearly everything leaves room for a line or two, and a headline held
  // to its usual minimum there is not shrunk, it is cut off by the box that
  // clips it. Better small and whole than large and halved.
  const floor = Math.max(TYPE.h4, max * 0.42);
  // Divided by the leading this headline is actually set with, not by a number
  // written when every headline was set with the same one. The floor is the
  // size at which the longest allowed headline still fits the room it was
  // given, and the fit will not go below it - so a floor worked out at a
  // tighter leading than the one in use is a floor the text overflows from. An
  // Albanian headline is set looser, to clear the marks on its capitals, and at
  // the old number its third line was drawn over the line beneath the block.
  const min =
    room !== undefined && room > 0
      ? Math.max(TYPE.label, Math.min(floor, room / (lines * leading.tight)))
      : floor;
  return (
    <FitText
      as="h2"
      text={text}
      maxSize={max}
      minSize={min}
      maxLines={lines}
      lineHeight={leading.normal}
      tightLineHeight={leading.tight}
      // The headline takes whatever the block has left after the other parts,
      // and is fitted to that. Without the cap a long title runs out of its
      // block and over whatever sits below it.
      boxStyle={{
        // Not shrinkable by the flex line: a box that the layout squeezes and
        // the fit then measures is a box that chases itself down to the
        // smallest size it is allowed. The cap below is the only bound, and it
        // is worked out before anything is drawn.
        flex: "0 0 auto",
        minHeight: 0,
        width: "100%",
        // Always capped, even where the other parts have taken nearly all of
        // the block: a headline with no room left shrinks to one small line
        // instead of running out over everything below it.
        ...(room !== undefined ? { maxHeight: px(Math.max(room, TYPE.h4 * 1.2)) } : {}),
      }}
      style={{
        fontWeight: WEIGHT.heavy,
        letterSpacing: TRACK.tight,
        fontFamily: font(ctx),
        color: ink(tone, ctx.lift).strong,
        // Set by the design, not by the customer: a poster that shouts its
        // destination shouts it whatever case the name was typed in. The text
        // itself is untouched, so what was saved is still what was written -
        // only the drawing is loud.
        ...(caps ? { textTransform: "uppercase" as const } : {}),
      }}
    />
  );
}

/**
 * What the post says about money, read once.
 *
 * A travel agency does not sell at a number, it sells at "from 590 EUR per
 * person, down from 790". Three of those four were impossible to print, so an
 * offer that was the whole reason for the post arrived on the design as a bare
 * figure. Reading them together here keeps the price parts and the offers list
 * telling the same story.
 */
function priceParts(ctx: RenderCtx) {
  const now = formatPrice(ctx.content.price, ctx.brand.currency);
  const was = formatPrice(ctx.content.priceWas ?? "", ctx.brand.currency);
  const unit = (ctx.content.priceUnit ?? "").trim();
  return {
    now,
    // A struck figure only means anything beside a current one, and only when
    // it is the larger of the two. Otherwise it reads as a mistake.
    was: now && was && was !== now ? was : "",
    unit,
    from: !!ctx.content.priceFrom && !!now,
  };
}

function Price({
  ctx,
  tone,
  as,
}: {
  ctx: RenderCtx;
  tone: Tone;
  as: "plain" | "badge" | "block" | "outline";
}) {
  const { now, was, unit, from } = priceParts(ctx);
  if (!now) return null;

  /*
   * The outline box.
   *
   * Nothing is filled in: a hairline in the accent colour, the photograph
   * showing through it, the figure set large on the picture itself and the
   * words around it small and in that same accent. It stacks rather than runs
   * along a line, because the sentence is spoken in that order - from, the
   * number, what the number buys - and a poster that prints it across one line
   * makes the reader assemble it.
   */
  if (as === "outline") {
    const edge = accent(ctx);
    // The three rows are set with room for what they paint rather than on the
    // tightest leading that looked right in English. A word here is uppercase,
    // so "PËR PERSON" paints a quarter of its own size higher than "PER
    // PERSON" does, and at a leading of 1 that marked capital reached out of
    // its row and into the figure above it. The figure's row had the same fault
    // from the other side: set at 0.95, the digits painted past the bottom of
    // their own line and into the words beneath.
    const word: React.CSSProperties = {
      fontSize: px(TYPE.lead),
      fontWeight: WEIGHT.heavy,
      letterSpacing: TRACK.wide,
      textTransform: "uppercase",
      color: edge,
      fontFamily: fontSecondary(ctx),
      lineHeight: 1.2,
      whiteSpace: "nowrap",
    };
    return (
      <span
        style={{
          display: "inline-flex",
          flexDirection: "column",
          alignItems: "flex-start",
          // A beat between the three rows rather than a hairline. The words
          // above and below are set in capitals, so a mark on one of them
          // reaches towards the figure, and at the old gap it arrived.
          gap: px(SPACE.sm),
          padding: `${px(SPACE.md)} ${px(SPACE.lg)}`,
          border: `${px(0.45)} solid ${edge}`,
          alignSelf: "inherit",
        }}
      >
        {from ? (
          <span style={{ ...word, color: ink(tone, ctx.lift).strong }}>{words(ctx).from}</span>
        ) : null}
        <span
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: px(SPACE.sm),
            fontSize: px(TYPE.hero),
            fontWeight: WEIGHT.heavy,
            letterSpacing: TRACK.tight,
            lineHeight: 1.2,
            color: ink(tone, ctx.lift).strong,
            fontFamily: font(ctx),
            whiteSpace: "nowrap",
          }}
        >
          {now}
          {was ? (
            <span
              style={{
                fontSize: px(TYPE.lead),
                fontWeight: WEIGHT.bold,
                textDecoration: "line-through",
                letterSpacing: TRACK.normal,
                color: ink(tone, ctx.lift).muted,
              }}
            >
              {was}
            </span>
          ) : null}
        </span>
        {unit ? <span style={word}>{unit}</span> : null}
      </span>
    );
  }
  // Badge and block are both the accent colour carrying white type; the pill
  // reads as something to press, the square corners read as a price sticker
  // stuck on the poster. Which one a design wants is a question of voice.
  const onBadge = as === "badge" || as === "block";
  const c = ink(tone, ctx.lift);
  const quiet = onBadge ? INK.onDarkBody : c.muted;

  // "from", the old price and the unit are all small type around one big
  // figure, so the eye still lands on the number first.
  const small: React.CSSProperties = {
    fontSize: px(TYPE.label),
    fontWeight: WEIGHT.bold,
    letterSpacing: TRACK.wide,
    textTransform: "uppercase",
    color: quiet,
    fontFamily: fontSecondary(ctx),
    whiteSpace: "nowrap",
  };
  const figure: React.CSSProperties = {
    fontSize: px(as === "block" ? TYPE.h2 : as === "badge" ? TYPE.h3 : TYPE.h2),
    fontWeight: WEIGHT.heavy,
    letterSpacing: TRACK.tight,
    whiteSpace: "nowrap",
    color: onBadge ? INK.onDark : c.strong,
    fontFamily: font(ctx),
  };
  const body = (
    <>
      {from ? <span style={small}>{words(ctx).from}</span> : null}
      {was ? (
        <span style={{ ...small, textDecoration: "line-through", letterSpacing: TRACK.normal }}>
          {was}
        </span>
      ) : null}
      <span style={figure}>{now}</span>
      {unit ? <span style={small}>/ {unit}</span> : null}
    </>
  );
  const row: React.CSSProperties = {
    display: "flex",
    alignItems: "baseline",
    flexWrap: "wrap",
    gap: px(SPACE.sm),
  };
  if (onBadge) {
    return (
      <span
        style={{
          ...row,
          alignItems: "center",
          padding:
            as === "block" ? `${px(SPACE.md)} ${px(SPACE.lg)}` : `${px(SPACE.sm)} ${px(SPACE.lg)}`,
          borderRadius: as === "block" ? px(RADIUS.xs) : px(RADIUS.pill),
          background: accent(ctx),
        }}
        data-ground
      >
        {body}
      </span>
    );
  }
  return <span style={row}>{body}</span>;
}

/**
 * The short urgent line: last minute, five places left, book by Friday.
 *
 * It reads `additionalText`, a field that had been in the content model and in
 * every placeholder from the start while no part drew it and no form offered
 * it. An offer post without one of these is a leaflet.
 */
/** As long as a stamp can be before it stops being a stamp. The form caps its
 * input, but posts saved before this field was drawn can carry a whole
 * sentence, and a ribbon that wraps to three lines is not a ribbon. */
const STAMP_MAX = 40;

function Stamp({ ctx, tone, as }: { ctx: RenderCtx; tone: Tone; as: "ribbon" | "tag" }) {
  const label = (ctx.content.additionalText ?? "").trim().slice(0, STAMP_MAX);
  if (!label) return null;
  const shared: React.CSSProperties = {
    fontSize: px(TYPE.label),
    fontWeight: WEIGHT.heavy,
    letterSpacing: TRACK.wide,
    textTransform: "uppercase",
    fontFamily: fontSecondary(ctx),
    borderRadius: px(RADIUS.xs),
    padding: `${px(SPACE.xs)} ${px(SPACE.md)}`,
    // The stamp is an aside, so it never stretches to the block's width.
    alignSelf: "inherit",
  };
  if (as === "ribbon") {
    return (
      <span data-ground style={{ ...shared, background: accent(ctx), color: INK.onDark }}>
        {label}
      </span>
    );
  }
  return (
    <span
      style={{
        ...shared,
        background: "transparent",
        border: `${px(0.25)} solid ${accent(ctx)}`,
        color: ink(tone, ctx.lift).strong,
      }}
    >
      {label}
    </span>
  );
}

/**
 * Several destinations and their prices, as one list.
 *
 * Agencies post these every week and the design system could not make one: a
 * spec carries a single headline and a single price, so three destinations had
 * to become three posts. The rows come from the post's own offers, and any row
 * missing either half is dropped rather than printed half empty.
 */
function Offers({ ctx, tone, limit = 4 }: { ctx: RenderCtx; tone: Tone; limit?: number }) {
  const rows = offerRows(ctx, limit);
  if (!rows.length) return null;
  const c = ink(tone, ctx.lift);
  return (
    <div style={{ display: "grid", gap: px(SPACE.sm), width: "100%" }}>
      {rows.map((row, i) => (
        <div
          key={row.id}
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: px(SPACE.md),
            // A hairline between rows, never above the first or below the last.
            paddingTop: i === 0 ? 0 : px(SPACE.sm),
            borderTop: i === 0 ? "none" : `${px(0.15)} solid ${c.faint}`,
          }}
        >
          <span
            style={{
              fontSize: px(TYPE.lead),
              fontWeight: WEIGHT.bold,
              letterSpacing: TRACK.snug,
              color: c.strong,
              fontFamily: font(ctx),
              minWidth: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {row.label}
          </span>
          <span
            style={{
              fontSize: px(TYPE.lead),
              fontWeight: WEIGHT.heavy,
              letterSpacing: TRACK.tight,
              color: accent(ctx),
              fontFamily: font(ctx),
              whiteSpace: "nowrap",
            }}
          >
            {formatPrice(row.price, ctx.brand.currency)}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Where, how long, when: printed only where the post actually said something. */
/** The four detail slots, each with the name the business calls it by. */
const FACT_KEYS = ["location", "meta1", "meta2", "date"] as const;

/**
 * What the post fills in, named: `Hotel: Bosphorus`, not `Bosphorus`.
 *
 * A hotel name, a departure city and a date all read as the same anonymous
 * string once they are set in a row, so a reader had to guess which was which
 * from the words themselves - and "Prishtina" tells you nothing about whether
 * the trip leaves from there or goes there. The name is set quieter than the
 * answer, so the row still reads as facts rather than as a form.
 */
function facts(ctx: RenderCtx, limit: number) {
  return FACT_KEYS.map((key) => ({
    key,
    label: fieldLabel(ctx.businessType, key, ctx.brand.language, ctx.content.labels),
    value: (ctx.content[key] ?? "").trim(),
  }))
    .filter((fact) => fact.value)
    .slice(0, limit);
}

/** Four, because there are four detail slots and a customer who filled one in
 * meant it to be printed. The old default of three was set when the renderer
 * could only see three of them, and left whichever came last on the floor. A
 * design that wants a shorter row asks for one. */
const FACTS_LIMIT = 4;

/**
 * The terms under a poster's destination, set once for every part that joins
 * them.
 *
 * Measured off the printed offer this reads from: the lines under the place
 * name stand at a little over a third of its cap height. At the size a banner
 * headline settles to in a square frame that lands on h2 - large enough to be
 * read as part of the statement rather than as a caption under it, and still
 * clearly subordinate to the name above.
 *
 * They wrap rather than shrink. A term is two or three words on a poster, and
 * a customer who writes a sentence into the slot gets a second line, which is
 * what a poster would do with it too.
 */
function termStyle(ctx: RenderCtx, size: number): React.CSSProperties {
  return {
    fontSize: px(size),
    fontWeight: WEIGHT.bold,
    // Enough to hold an accented capital, which paints 0.97 of its own size
    // above the baseline. Tighter and the mark on a NETË or a PËRFSHIRË is
    // drawn outside its own line and into whatever sits above it.
    lineHeight: TERM_LEADING,
    letterSpacing: TRACK.snug,
    fontFamily: fontSecondary(ctx),
  };
}

const TERM_LEADING = 1.26;

/**
 * The air between one term and the next.
 *
 * A hairline was enough while the terms were set at the poster's own size and
 * there were two of them. At four, set a step smaller in a tall clip, the
 * leading alone stopped clearing: a term ending in a lowercase tail and the one
 * under it starting on an accented capital met by a few pixels - not enough to
 * read as broken, and enough to be a line touching another line.
 */
const TERM_GAP = SPACE.xs;

/**
 * How large the terms in a block are set, read from how many of them there are.
 *
 * The poster this comes from carries two: how long, and what is in it. At two
 * they are set large, a third of the destination's own size, and read as part
 * of the statement rather than as a caption under it.
 *
 * A post that fills every slot asks for six, and six lines at that size do not
 * leave a poster - they leave a list, with the destination squeezed to less
 * than the terms beneath it, which inverts the one thing the design is for. So
 * the size steps down as the count goes up. The alternative was to print the
 * first two and drop the rest, and a design that silently loses what a customer
 * typed is the thing this library was rebuilt to stop doing.
 */
function termSizeFor(lines: number): number {
  return lines <= 2 ? TYPE.h2 : lines <= 4 ? TYPE.h3 : TYPE.lead;
}

/** The lines a block's terms come to, across every part that sets them, since
 * the size is a property of the group rather than of either part alone. */
function termLines(parts: Part[], ctx: RenderCtx): number {
  let n = 0;
  for (const part of parts) {
    if (part.t === "facts" && part.as === "stack") {
      n += facts(ctx, part.limit ?? FACTS_LIMIT).length;
    }
    if (part.t === "included" && part.as === "terms") {
      n += includedItems(ctx, part.limit).length;
    }
  }
  return n;
}

/** How many lines a term of this length wraps to at this size, in a column the
 * width of a block. Used by the reserve, so the headline is not handed room a
 * second line is about to take back. */
function termRows(text: string, size: number): number {
  // Roughly how many characters of this face fit a full width block.
  const perLine = Math.max(8, Math.floor(86 / (size * 0.52)));
  return Math.max(1, Math.ceil(text.length / perLine));
}

function Facts({
  ctx,
  tone,
  as = "row",
  limit = FACTS_LIMIT,
  term = TYPE.h2,
}: {
  ctx: RenderCtx;
  tone: Tone;
  as?: "row" | "stack";
  limit?: number;
  term?: number;
}) {
  const rows = facts(ctx, limit);
  if (!rows.length) return null;
  const c = ink(tone, ctx.lift);
  if (as === "stack") {
    // The terms under a poster's destination. One to a line, set at the size
    // the stacked terms share, and without the field's name in front of them:
    // see the note on the part for why a poster drops it where a row keeps it.
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: px(TERM_GAP), width: "100%" }}>
        {rows.map((fact) => (
          <span key={fact.key} style={{ ...termStyle(ctx, term), color: c.strong }}>
            {fact.value}
          </span>
        ))}
      </div>
    );
  }
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        flexWrap: "wrap",
        // No dots between the facts. They were the only thing telling one
        // anonymous string from the next, and now that each fact says what it
        // is the separator is doing nothing but waiting to be orphaned at the
        // start of a wrapped line. The space between them is the separator.
        columnGap: px(SPACE.lg),
        rowGap: px(SPACE.xs),
      }}
    >
      {rows.map((fact) => (
        <span
          key={fact.key}
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: px(SPACE.xs),
            fontSize: px(TYPE.body),
            fontFamily: fontSecondary(ctx),
          }}
        >
          {fact.label ? (
            <span style={{ fontWeight: WEIGHT.plain, color: c.muted }}>{fact.label}:</span>
          ) : null}
          <span style={{ fontWeight: WEIGHT.bold, color: c.strong }}>{fact.value}</span>
        </span>
      ))}
    </div>
  );
}

/** What Included actually prints: everything the post carries, unless the
 * design asked for fewer. */
function includedItems(ctx: RenderCtx, limit?: number): string[] {
  const items = ctx.content.services.filter((s) => s && s.trim());
  return limit === undefined ? items : items.slice(0, limit);
}

/** The offer rows worth drawing: a row needs both a destination and a price,
 * or it prints as a dangling label with nothing beside it. */
function offerRows(ctx: RenderCtx, limit: number) {
  return (ctx.content.offers ?? [])
    .filter((row) => row.label.trim() && row.price.trim())
    .slice(0, limit);
}

function Included({
  ctx,
  tone,
  as,
  limit,
  term = TYPE.h2,
}: {
  ctx: RenderCtx;
  tone: Tone;
  as: "line" | "ticks" | "chips" | "terms";
  limit?: number;
  term?: number;
}) {
  const items = includedItems(ctx, limit);
  if (!items.length) return null;
  const c = ink(tone, ctx.lift);
  if (as === "terms") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: px(TERM_GAP), width: "100%" }}>
        {items.map((item) => (
          <span key={item} style={{ ...termStyle(ctx, term), color: c.strong }}>
            {item}
          </span>
        ))}
      </div>
    );
  }
  if (as === "line") {
    return (
      <div
        style={{
          fontSize: px(TYPE.body),
          fontWeight: WEIGHT.medium,
          lineHeight: 1.4,
          color: c.body,
          fontFamily: fontSecondary(ctx),
        }}
      >
        {items.join("  ·  ")}
      </div>
    );
  }
  if (as === "chips") {
    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: px(SPACE.xs), width: "100%" }}>
        {items.map((item) => (
          <span
            key={item}
            style={{
              padding: `${px(SPACE.xxs)} ${px(SPACE.md)}`,
              borderRadius: px(RADIUS.pill),
              border: `1px solid ${c.faint}`,
              background: tone === "light" ? alpha("#ffffff", 0.14) : alpha(INK.strong, 0.05),
              fontSize: px(TYPE.label),
              fontWeight: WEIGHT.bold,
              color: c.strong,
              fontFamily: fontSecondary(ctx),
              whiteSpace: "nowrap",
            }}
          >
            {item}
          </span>
        ))}
      </div>
    );
  }
  // A long list in one column is taller than any block can hold. Two columns
  // keep the same ticked look at half the height.
  const columns = items.length > 4 ? 2 : 1;
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gap: `${px(SPACE.xs)} ${px(SPACE.lg)}`,
        width: "100%",
      }}
    >
      {items.map((item) => (
        <div key={item} style={{ display: "flex", alignItems: "center", gap: px(SPACE.sm) }}>
          <span
            style={{
              width: px(1.6),
              height: px(0.9),
              borderLeft: `${px(0.3)} solid ${accent(ctx)}`,
              borderBottom: `${px(0.3)} solid ${accent(ctx)}`,
              transform: "rotate(-45deg)",
              flex: "0 0 auto",
            }}
          />
          <span
            style={{
              fontSize: px(TYPE.body),
              fontWeight: WEIGHT.medium,
              color: c.body,
              fontFamily: fontSecondary(ctx),
            }}
          >
            {item}
          </span>
        </div>
      ))}
    </div>
  );
}

function Cta({ ctx, tone, as }: { ctx: RenderCtx; tone: Tone; as: "bar" | "tag" }) {
  const label = ctx.content.cta.trim();
  if (!label) return null;
  const shared: React.CSSProperties = {
    fontSize: px(TYPE.body),
    fontWeight: WEIGHT.bold,
    letterSpacing: TRACK.wide,
    textTransform: "uppercase",
    fontFamily: fontSecondary(ctx),
  };
  if (as === "bar") {
    return (
      <div
        style={{
          ...shared,
          width: "100%",
          textAlign: "center",
          padding: `${px(SPACE.sm)} ${px(SPACE.lg)}`,
          borderRadius: px(RADIUS.pill),
          background: accent(ctx),
          color: INK.onDark,
        }}
        data-ground
      >
        {label}
      </div>
    );
  }
  return (
    <span
      style={{
        ...shared,
        padding: `${px(SPACE.xs)} ${px(SPACE.md)}`,
        border: `1px solid ${ink(tone, ctx.lift).muted}`,
        borderRadius: px(RADIUS.pill),
        color: ink(tone, ctx.lift).strong,
      }}
    >
      {label}
    </span>
  );
}

function Brand({ ctx, tone, page }: { ctx: RenderCtx; tone: Tone; page: number }) {
  const showName = !!ctx.showBrandName && !!ctx.businessName;
  const { place, scale } = logoAdjust(ctx);
  // A mark the customer has pinned to a corner is drawn there, by FloatingLogo,
  // and must not also be drawn here - that is the one way this feature could
  // put two copies of a logo on one post.
  const logo = place === "design" ? ctx.brand.logoDataUrl : null;
  // Always a box, even when empty: a block that spreads its parts between the
  // top and the foot of the frame loses that arrangement when a part vanishes.
  if (!showName && !logo) return <span aria-hidden style={{ display: "block" }} />;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: px(SPACE.md) }}>
      {logo ? <LogoMark src={logo} scale={scale} page={page} /> : null}
      {showName ? (
        <span
          style={{
            fontSize: px(TYPE.body),
            fontWeight: WEIGHT.bold,
            color: ink(tone, ctx.lift).strong,
            fontFamily: fontSecondary(ctx),
          }}
        >
          {ctx.businessName}
        </span>
      ) : null}
    </div>
  );
}

function Contact({ ctx, tone }: { ctx: RenderCtx; tone: Tone }) {
  if (!ctx.showContact) return null;
  const line = contactLine(ctx);
  if (!line) return null;
  return (
    <div
      style={{
        // A step up the scale, and off the muted ink.
        //
        // This line is the only thing on a post that asks the reader to do
        // something with it: a phone number to dial, an address to find. It was
        // set at label size in muted ink, which is how you set a footnote, not
        // how you set the one line the post exists to be answered on. A number
        // nobody can read is the same as no number.
        fontSize: px(TYPE.body),
        fontWeight: WEIGHT.medium,
        color: ink(tone, ctx.lift).body,
        fontFamily: fontSecondary(ctx),
      }}
    >
      {line}
    </div>
  );
}

/**
 * A short accent rule.
 *
 * Block, stated rather than inherited. A rule is a span with a width and a
 * height and no content, and a span is inline unless something makes it
 * otherwise. As a direct child of a block's flex line it was made one, so the
 * width and the height applied and the rule was drawn - but on a clip every
 * part is wrapped so it can arrive on its own, and inside that wrapper the span
 * went back to being inline, where a width and a height mean nothing. The rule
 * collapsed to a box of nothing and simply vanished: the sign-off at the foot
 * of a poster had its two marks either side of the brand on the picture and
 * neither of them on the clip of the same post.
 *
 * It does not shrink either. It is a fixed mark, not a piece of the line's
 * spare room, and two marks flanking a brand have to be the same length or they
 * read as a mistake rather than as a pair.
 */
function Rule({ ctx }: { ctx: RenderCtx }) {
  return (
    <span
      style={{
        display: "block",
        flexShrink: 0,
        width: px(10),
        height: px(0.4),
        background: accent(ctx),
      }}
    />
  );
}

function renderPart(
  part: Part,
  ctx: RenderCtx,
  tone: Tone,
  key: number,
  page: number,
  room?: number,
  term: number = TYPE.h2,
): React.ReactNode {
  switch (part.t) {
    case "kicker":
      return <Kicker key={key} ctx={ctx} tone={tone} {...(part.as ? { as: part.as } : {})} />;
    case "headline":
      return (
        <Headline
          key={key}
          ctx={ctx}
          tone={tone}
          size={part.size}
          {...(part.caps ? { caps: true } : {})}
          {...(room !== undefined ? { room } : {})}
        />
      );
    case "price":
      return <Price key={key} ctx={ctx} tone={tone} as={part.as} />;
    case "stamp":
      return <Stamp key={key} ctx={ctx} tone={tone} as={part.as} />;
    case "offers":
      return (
        <Offers key={key} ctx={ctx} tone={tone} {...(part.limit ? { limit: part.limit } : {})} />
      );
    case "facts":
      return (
        <Facts
          key={key}
          ctx={ctx}
          tone={tone}
          term={term}
          {...(part.as ? { as: part.as } : {})}
          {...(part.limit ? { limit: part.limit } : {})}
        />
      );
    case "included":
      return (
        <Included
          key={key}
          ctx={ctx}
          tone={tone}
          as={part.as}
          term={term}
          {...(part.limit ? { limit: part.limit } : {})}
        />
      );
    case "cta":
      return <Cta key={key} ctx={ctx} tone={tone} as={part.as} />;
    case "brand":
      return <Brand key={key} ctx={ctx} tone={tone} page={page} />;
    case "contact":
      return <Contact key={key} ctx={ctx} tone={tone} />;
    case "rule":
      return <Rule key={key} ctx={ctx} />;
    default:
      return null;
  }
}

/* ---------------------------------- blocks --------------------------------- */

const GAP = { sm: SPACE.xs, md: SPACE.md, lg: SPACE.lg } as const;

/** The ink a block writes in: a paper panel flips it, everything else keeps the
 * design's own tone. */
const blockTone = (block: Block, tone: Tone): Tone => (block.panel === "paper" ? "dark" : tone);

function panelStyle(block: Block, ctx: RenderCtx): React.CSSProperties {
  switch (block.panel) {
    case "brand":
      return {
        background: accent(ctx),
        borderRadius: px(RADIUS.md),
        padding: px(SPACE.lg),
      };
    case "paper":
      return {
        background: ctx.brand.background || "#ffffff",
        borderRadius: px(RADIUS.md),
        padding: px(SPACE.lg),
      };
    case "veil":
      return {
        background: alpha(shade(ctx.brand.primary, 0.74), 0.82),
        borderRadius: px(RADIUS.md),
        padding: px(SPACE.lg),
      };
    default:
      return {};
  }
}

/**
 * One line of the design, wrapped so it can arrive on its own.
 *
 * The wrapper is what the stylesheet animates and what the exporter solves as a
 * layer, and it carries its place in the order as an attribute so the two read
 * the same number instead of each counting the lines for itself - they would
 * count differently, because a line the post left empty is still in the
 * document and the exporter has no use for it.
 */
function Arriving({ at, children }: { at: number; children: React.ReactNode }) {
  return (
    <div
      className="krijo-intro"
      {...{ [ARRIVAL_ATTR]: at }}
      style={
        {
          "--krijo-delay": `${at * INTRO.stagger}ms`,
          "--krijo-duration": `${INTRO.duration}ms`,
        } as React.CSSProperties
      }
    >
      {children}
    </div>
  );
}

/**
 * How far a block may be taken down before the design gives up on holding it.
 *
 * A block that cannot fit its area used to let the flex line squash its parts:
 * each one kept its own text at full size inside a box that had been shrunk
 * under it, so the writing simply carried on over whatever came next. Measured
 * across the library, that happened in nine of a hundred and twenty renders -
 * never in a tall frame, never with a half filled post, and every time a short
 * frame was asked to hold everything a post can carry. On the worst of them a
 * headline sat completely on top of the hotel and the dates.
 *
 * Shrinking the whole block instead keeps every field the customer typed and
 * keeps the design's own proportions: the same layout, smaller. The floor is
 * there because past a certain point the type stops being readable and the
 * honest answer is that the post has more in it than that frame can take.
 */
const BLOCK_FLOOR = 0.55;

/**
 * A block's contents, taken down to fit the area the design gave it.
 *
 * The cap is read back from the element's own resolved `max-height` rather than
 * measured off the laid out box, because the box's height is decided by what is
 * inside it - measuring that would be comparing the content with itself.
 */
function FittedParts({
  cap,
  origin,
  frame,
  column,
  ground,
  children,
}: {
  cap: string;
  origin: string;
  frame: React.CSSProperties;
  column: React.CSSProperties;
  ground: boolean;
  children: React.ReactNode;
}) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const box = outer.current;
    const content = inner.current;
    if (!box || !content) return;
    const fit = () => {
      const limit = parseFloat(getComputedStyle(box).maxHeight);
      if (!Number.isFinite(limit) || limit <= 0) return;
      // `offsetHeight` rather than the drawn rectangle, because a transform
      // moves pixels and not layout: this is the height the block would have
      // at full size whatever it is currently scaled to, so the answer never
      // depends on the last answer.
      //
      // Taking the transform off to measure and putting it back is what this
      // did first, and it was quietly wrong: React owns that property, so when
      // the new answer matched the old one it declined to re-render and the
      // transform stayed off. The block measured as needing 79 pixels in 67,
      // asked to be taken down to 0.85, and drew at full size anyway.
      const needs = content.offsetHeight;
      setScale(needs > limit + 0.5 ? Math.max(BLOCK_FLOOR, limit / needs) : 1);
    };
    fit();
    let cancelled = false;
    void document.fonts.ready.then(() => {
      if (!cancelled) fit();
    });
    // The frame is responsive and the auto-fit text inside settles a moment
    // after first paint, so the answer is taken again whenever either moves.
    const observer = new ResizeObserver(() => fit());
    observer.observe(box);
    observer.observe(content);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  });

  return (
    <div
      ref={outer}
      style={{ ...frame, maxHeight: cap }}
      {...(ground ? { "data-ground": "" } : {})}
    >
      <div
        ref={inner}
        style={{
          ...column,
          ...(scale === 1 ? {} : { transform: `scale(${scale})`, transformOrigin: origin }),
        }}
      >
        {children}
      </div>
    </div>
  );
}

function BlockNode({
  block,
  ctx,
  tone,
  rowHeight,
  page,
  arrivalBase,
}: {
  block: Block;
  ctx: RenderCtx;
  tone: Tone;
  rowHeight: number;
  page: number;
  /** The place in the arrival order this block's first line takes, or absent
   * when nothing is arriving. The lines come in one at a time, not the block in
   * one piece: a design reads line by line and so should arrive that way. */
  arrivalBase?: number;
}) {
  const [c1, c2, r1, r2] = block.area;
  const own = blockTone(block, tone);
  const gap = GAP[block.gap ?? "md"];
  const padding = block.panel && block.panel !== "none" ? SPACE.lg * 2 : 0;
  // Only the parts still in the block.
  //
  // An element the customer has placed on the frame is drawn over the design
  // from somewhere else, so this block neither draws it nor keeps room for it.
  // Leaving it in the reserve would hold a gap open where it used to be and
  // hand the headline less room than it now has, which is the opposite of what
  // moving something out of a block should do. The index each part came in at
  // is carried along, because that number is its place in the arrival order and
  // closing the gaps would renumber everything behind it.
  const staying = block.parts
    .map((part, index) => ({ part, index }))
    .filter(({ part }) => !elementAdjust(ctx, part.t));
  if (!staying.length) return null;
  // The terms are sized before anything is reserved, because how large they
  // are set decides how much room they take and therefore what is left for the
  // headline.
  const term = termSizeFor(
    termLines(
      staying.map((p) => p.part),
      ctx,
    ),
  );
  const reserved =
    staying.reduce((sum, { part }) => sum + reserveOf(part, ctx, term), 0) +
    gap * Math.max(0, staying.length - 1) +
    padding;
  const area = (r2 - r1) * rowHeight;
  const room = area - reserved;
  const ground = !!block.panel && block.panel !== "none";
  // Where the block is pinned is where it shrinks towards, so a foot stays on
  // the foot and a heading stays under the top margin.
  const originY =
    block.justify === "center" ? "center" : block.justify === "end" ? "bottom" : "top";
  const originX = block.align === "center" ? "center" : block.align === "end" ? "right" : "left";
  return (
    <FittedParts
      cap={px(area)}
      origin={`${originX} ${originY}`}
      ground={ground}
      frame={{
        gridColumn: `${c1} / ${c2}`,
        gridRow: `${r1} / ${r2}`,
        // A block is as tall as what it holds, capped at the area it was given
        // and pinned to that area's edge. Stretching instead left a panel
        // standing half empty whenever a post filled in less than the design
        // expected, and letting it grow past the cap put a long headline over
        // whatever sat below.
        alignSelf:
          block.justify === "center" ? "center" : block.justify === "end" ? "end" : "start",
        minHeight: 0,
        minWidth: 0,
        // The column lives on the frame as well as inside it, so that whatever
        // still does not fit after being taken down overflows the way it always
        // did - a foot block upwards, into the picture, rather than downwards
        // off the bottom of the card.
        display: "flex",
        flexDirection: "column",
        justifyContent:
          block.justify === "center"
            ? "center"
            : block.justify === "end"
              ? "flex-end"
              : "flex-start",
        ...panelStyle(block, ctx),
      }}
      column={{
        display: "flex",
        // A row reads across rather than down: a mark with a rule either side
        // of it, the way a printed poster signs itself off at the foot.
        flexDirection: block.row ? "row" : "column",
        ...(block.row ? { flexWrap: "wrap" as const } : {}),
        width: "100%",
        // Never squashed by the line it sits in: the block is taken down as a
        // whole instead, and a part shrunk under its own text is exactly what
        // used to let the writing carry on over whatever came next.
        flexShrink: 0,
        gap: px(gap),
        // `align` is always across the block and `justify` always down it, so a
        // design says where its parts sit without having to know which way they
        // happen to run. In a row those are the flex axes the other way round.
        alignItems: block.row
          ? block.justify === "center"
            ? "center"
            : block.justify === "end"
              ? "flex-end"
              : "flex-start"
          : block.align === "center"
            ? "center"
            : block.align === "end"
              ? "flex-end"
              : "flex-start",
        justifyContent: block.row
          ? block.align === "center"
            ? "center"
            : block.align === "end"
              ? "flex-end"
              : "flex-start"
          : block.justify === "center"
            ? "center"
            : block.justify === "end"
              ? "flex-end"
              : "flex-start",
        textAlign: block.align === "center" ? "center" : block.align === "end" ? "right" : "left",
        minWidth: 0,
      }}
    >
      {staying.map(({ part, index }) =>
        arrivalBase === undefined ? (
          renderPart(part, ctx, own, index, page, room, term)
        ) : (
          <Arriving key={index} at={arrivalBase + index}>
            {renderPart(part, ctx, own, index, page, room, term)}
          </Arriving>
        ),
      )}
    </FittedParts>
  );
}

/**
 * How far outside its own box a lifted line paints, in cqw.
 *
 * The shadow that lets type stand off a photograph reaches past the box the
 * text was laid out in, and the exporter has to know by how much: on a clip it
 * cuts each line out of the frame separately so the lines can arrive one at a
 * time, and a line cut at its own edge loses the soft outside of its shadow -
 * which does not read as a softer shadow, it reads as a faint rectangle around
 * the words, moving with the wipe.
 *
 * Big text needs more of this than small text, and the auto-fit boxes already
 * declare their own room, which the exporter reads. This covers the rest: the
 * plain lines - the terms, the dates, the phone number - which have no such box
 * and whose shadow reaches about half their own height.
 */
const LIFT_BLEED = 1.2;

/* ---------------------------------- design --------------------------------- */

/** Where a block's first line falls in the arrival order: everything the blocks
 * before it hold. Counted from the design rather than from the rendered tree so
 * it is the same number on every render. */
function arrivalOf(spec: DesignSpec, blockIndex: number): number {
  return spec.blocks.slice(0, blockIndex).reduce((n, b) => n + b.parts.length, 0);
}

/**
 * Every element the customer has taken out of the layout, drawn where they put
 * it.
 *
 * Over the design rather than inside it, for the same reason the mark is:
 * somebody who has deliberately placed something somewhere should not then find
 * a headline on top of it. Each one keeps the arrival number it had in its
 * block, so a clip still introduces the post in the order the design reads
 * rather than in the order things were moved.
 *
 * The tone is the design's own, not the block's. A part that sat on a painted
 * panel is now on the photograph; the panel stays where it was, so the ink has
 * to be the ink that works over a picture.
 */
function PlacedParts({
  spec,
  ctx,
  page,
  band,
}: {
  spec: DesignSpec;
  ctx: RenderCtx;
  page: number;
  band: Band;
}): React.ReactNode {
  const moved: { part: Part; adjust: ElementAdjust; at: number }[] = [];
  spec.blocks.forEach((block, bi) => {
    block.parts.forEach((part, pi) => {
      const adjust = elementAdjust(ctx, part.t);
      if (adjust) moved.push({ part, adjust, at: arrivalOf(spec, bi) + pi });
    });
  });
  if (!moved.length) return null;

  return (
    <>
      {moved.map(({ part, adjust, at }) => (
        <PlacedPart
          key={part.t}
          adjust={adjust}
          page={page}
          band={band}
          {...(ctx.animate ? { arrival: at } : {})}
        >
          {renderPart(
            part,
            ctx,
            spec.tone,
            at,
            page,
            undefined,
            termSizeFor(termLines([part], ctx)),
          )}
        </PlacedPart>
      ))}
    </>
  );
}

/** Draws one design. The page margin and the field are the same for every
 * design, which is most of what makes a set look like a set. */
export function renderDesign(spec: DesignSpec, outer: RenderCtx): React.ReactNode {
  // Whether the type is lifted is the design's decision, not the caller's, so
  // it is put on the context here rather than asked of every part separately.
  const ctx: RenderCtx = spec.lift ? { ...outer, lift: true } : outer;
  // One row of the field, in the same container relative unit everything else
  // is measured in. The canvas is 100 units wide whatever its pixel size, so
  // its height follows from its shape.
  const shape = ctx.canvas ? ctx.canvas.height / ctx.canvas.width : 1.25;
  const page = spec.page ?? SPACE.page;
  // The interface safe area comes off the field before it is divided.
  //
  // A full height clip keeps 14 units clear at the top and 28 at the bottom,
  // for the profile row and the caption Instagram draws over them, and the
  // stylesheet takes that room out of the grid. The row height did not know
  // that: it divided the whole frame by twelve, so on a 9:16 clip every block
  // was told its area was about a third taller than the row it was actually
  // given. A block reserves room for its parts against that area and is capped
  // at it, so the ones that filled their area did not shrink - they ran out of
  // their own row and over the block beneath, which on a full post put the
  // terms straight through the price.
  const safe = ctx.safe ?? { top: 0, bottom: 0 };
  const rowHeight = (100 * shape - safe.top - safe.bottom - page * 2) / GRID;
  // The same band the grid lives in, for everything pinned over the grid.
  const band = bandOf(ctx);
  const adjust = ctx.adjustments?.text;
  const x = clamp(adjust?.x ?? 0, -12, 12);
  const y = clamp(adjust?.y ?? 0, -12, 12);
  const scale = clamp(adjust?.scale ?? 1, 0.8, 1.25);
  return (
    <div
      // Set once, at the root, so every line of type the design writes onto the
      // photograph carries the same edge. The stylesheet takes it off again
      // wherever the design painted a ground of its own.
      {...(spec.lift ? { className: "krijo-lift", "data-krijo-bleed": String(LIFT_BLEED) } : {})}
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        fontFamily: font(ctx),
        color: ink(spec.tone, spec.lift).strong,
      }}
    >
      <Photo
        ctx={ctx}
        treatment={spec.photo.treatment}
        {...(spec.photo.strength !== undefined ? { strength: spec.photo.strength } : {})}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          padding: px(page),
          display: "grid",
          gridTemplateColumns: `repeat(${GRID}, 1fr)`,
          gridTemplateRows: `repeat(${GRID}, 1fr)`,
          columnGap: px(SPACE.sm),
          rowGap: px(SPACE.sm),
          transform: `translate(${x}cqw, ${y}cqw) scale(${scale})`,
          transformOrigin: "center",
        }}
      >
        {spec.blocks.map((block, i) => (
          <BlockNode
            key={i}
            block={block}
            ctx={ctx}
            tone={spec.tone}
            rowHeight={rowHeight}
            page={page}
            {...(ctx.animate ? { arrivalBase: arrivalOf(spec, i) } : {})}
          />
        ))}
      </div>
      <PlacedParts spec={spec} ctx={ctx} page={page} band={band} />
      {/* Last in, because a mark pinned over the design should settle onto a
          design that has already arrived. */}
      <FloatingLogo
        ctx={ctx}
        page={page}
        band={band}
        {...(ctx.animate ? { arrival: arrivalOf(spec, spec.blocks.length) } : {})}
      />
    </div>
  );
}
