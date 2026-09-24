import { fieldLabel, formatPrice, SCRIPT_FONT } from "../constants";
import { alpha, INK, luminance, RADIUS, shade, SPACE, TRACK, TYPE, WEIGHT } from "../tokens";
import { FitText } from "@/components/rafty/FitText";
import type { RenderCtx } from "../templates";
import type { LanguageCode } from "../types";
import type { Block, DesignSpec, Part, PhotoTreatment } from "./spec";
import { GRID } from "./spec";

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
function FloatingLogo({ ctx, page }: { ctx: RenderCtx; page: number }) {
  const logo = ctx.brand.logoDataUrl;
  const { place, scale, x, y } = logoAdjust(ctx);
  if (!logo || place === "design") return null;
  const top = place === "topLeft" || place === "topRight";
  const left = place === "topLeft" || place === "bottomLeft";
  const inset = (base: number) => px(Math.max(0, base));
  return (
    <div
      style={{
        position: "absolute",
        ...(top ? { top: inset(page + y) } : { bottom: inset(page - y) }),
        ...(left ? { left: inset(page + x) } : { right: inset(page - x) }),
        display: "flex",
      }}
    >
      <LogoMark src={logo} scale={scale} page={page} />
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

/** The ink a tone writes in, at the three strengths a design needs. */
const ink = (tone: Tone) => ({
  strong: tone === "light" ? INK.onDark : INK.strong,
  body: tone === "light" ? INK.onDarkBody : INK.body,
  muted: tone === "light" ? INK.onDarkMuted : INK.muted,
  faint: tone === "light" ? INK.onDarkFaint : INK.faint,
});

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
function reserveOf(part: Part, ctx: RenderCtx): number {
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
      const chars = rows.reduce((n, f) => n + f.label.length + f.value.length + 5, 0);
      return Math.max(1, Math.ceil(chars / 40)) * (TYPE.body * 1.5);
    }
    case "included": {
      const n = includedItems(ctx, part.limit).length;
      if (!n) return 0;
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
      return ctx.showContact ? TYPE.label * 1.5 : 0;
    case "rule":
      return 0.4;
    default:
      return 0;
  }
}

function Headline({
  ctx,
  tone,
  size,
  room,
}: {
  ctx: RenderCtx;
  tone: Tone;
  size: keyof typeof HEADLINE_SIZE;
  room?: number;
}) {
  const max = HEADLINE_SIZE[size];
  const lines = 3;
  // The floor gives way before the box does. A block whose other parts have
  // taken nearly everything leaves room for a line or two, and a headline held
  // to its usual minimum there is not shrunk, it is cut off by the box that
  // clips it. Better small and whole than large and halved.
  const floor = Math.max(TYPE.h4, max * 0.42);
  const min =
    room !== undefined && room > 0
      ? Math.max(TYPE.label, Math.min(floor, room / (lines * 1.02)))
      : floor;
  return (
    <FitText
      as="h2"
      text={ctx.content.title || "Your headline here"}
      maxSize={max}
      minSize={min}
      maxLines={lines}
      lineHeight={1.02}
      tightLineHeight={0.96}
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
        color: ink(tone).strong,
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

function Price({ ctx, tone, as }: { ctx: RenderCtx; tone: Tone; as: "plain" | "badge" | "block" }) {
  const { now, was, unit, from } = priceParts(ctx);
  if (!now) return null;
  // Badge and block are both the accent colour carrying white type; the pill
  // reads as something to press, the square corners read as a price sticker
  // stuck on the poster. Which one a design wants is a question of voice.
  const onBadge = as === "badge" || as === "block";
  const c = ink(tone);
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
    return <span style={{ ...shared, background: accent(ctx), color: INK.onDark }}>{label}</span>;
  }
  return (
    <span
      style={{
        ...shared,
        background: "transparent",
        border: `${px(0.25)} solid ${accent(ctx)}`,
        color: ink(tone).strong,
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
  const c = ink(tone);
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

function Facts({ ctx, tone, limit = FACTS_LIMIT }: { ctx: RenderCtx; tone: Tone; limit?: number }) {
  const rows = facts(ctx, limit);
  if (!rows.length) return null;
  const c = ink(tone);
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
}: {
  ctx: RenderCtx;
  tone: Tone;
  as: "line" | "ticks" | "chips";
  limit?: number;
}) {
  const items = includedItems(ctx, limit);
  if (!items.length) return null;
  const c = ink(tone);
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
        border: `1px solid ${ink(tone).muted}`,
        borderRadius: px(RADIUS.pill),
        color: ink(tone).strong,
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
            color: ink(tone).strong,
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
  const c = ctx.brand.contact;
  if (!c) return null;
  const parts = [c.phones.filter(Boolean)[0], c.website, c.address].filter(
    (v): v is string => !!v && v.trim().length > 0,
  );
  if (!parts.length) return null;
  return (
    <div
      style={{
        fontSize: px(TYPE.label),
        fontWeight: WEIGHT.medium,
        color: ink(tone).muted,
        fontFamily: fontSecondary(ctx),
      }}
    >
      {parts.join("  ·  ")}
    </div>
  );
}

function Rule({ ctx }: { ctx: RenderCtx }) {
  return <span style={{ width: px(10), height: px(0.4), background: accent(ctx) }} />;
}

function renderPart(
  part: Part,
  ctx: RenderCtx,
  tone: Tone,
  key: number,
  page: number,
  room?: number,
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
        <Facts key={key} ctx={ctx} tone={tone} {...(part.limit ? { limit: part.limit } : {})} />
      );
    case "included":
      return (
        <Included
          key={key}
          ctx={ctx}
          tone={tone}
          as={part.as}
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

function BlockNode({
  block,
  ctx,
  tone,
  rowHeight,
  page,
}: {
  block: Block;
  ctx: RenderCtx;
  tone: Tone;
  rowHeight: number;
  page: number;
}) {
  const [c1, c2, r1, r2] = block.area;
  const own = blockTone(block, tone);
  const gap = GAP[block.gap ?? "md"];
  const padding = block.panel && block.panel !== "none" ? SPACE.lg * 2 : 0;
  const reserved =
    block.parts.reduce((sum, part) => sum + reserveOf(part, ctx), 0) +
    gap * Math.max(0, block.parts.length - 1) +
    padding;
  const room = (r2 - r1) * rowHeight - reserved;
  return (
    <div
      style={{
        gridColumn: `${c1} / ${c2}`,
        gridRow: `${r1} / ${r2}`,
        // A block is as tall as what it holds, capped at the area it was given
        // and pinned to that area's edge. Stretching instead left a panel
        // standing half empty whenever a post filled in less than the design
        // expected, and letting it grow past the cap put a long headline over
        // whatever sat below.
        alignSelf:
          block.justify === "center" ? "center" : block.justify === "end" ? "end" : "start",
        maxHeight: "100%",
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        gap: px(gap),
        alignItems:
          block.align === "center" ? "center" : block.align === "end" ? "flex-end" : "flex-start",
        justifyContent:
          block.justify === "center"
            ? "center"
            : block.justify === "end"
              ? "flex-end"
              : "flex-start",
        textAlign: block.align === "center" ? "center" : block.align === "end" ? "right" : "left",
        minWidth: 0,
        ...panelStyle(block, ctx),
      }}
    >
      {block.parts.map((part, i) => renderPart(part, ctx, own, i, page, room))}
    </div>
  );
}

/* ---------------------------------- design --------------------------------- */

/** Draws one design. The page margin and the field are the same for every
 * design, which is most of what makes a set look like a set. */
export function renderDesign(spec: DesignSpec, ctx: RenderCtx): React.ReactNode {
  // One row of the field, in the same container relative unit everything else
  // is measured in. The canvas is 100 units wide whatever its pixel size, so
  // its height follows from its shape.
  const shape = ctx.canvas ? ctx.canvas.height / ctx.canvas.width : 1.25;
  const page = spec.page ?? SPACE.page;
  const rowHeight = (100 * shape - page * 2) / GRID;
  const adjust = ctx.adjustments?.text;
  const x = clamp(adjust?.x ?? 0, -12, 12);
  const y = clamp(adjust?.y ?? 0, -12, 12);
  const scale = clamp(adjust?.scale ?? 1, 0.8, 1.25);
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        fontFamily: font(ctx),
        color: ink(spec.tone).strong,
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
          />
        ))}
      </div>
      <FloatingLogo ctx={ctx} page={page} />
    </div>
  );
}
