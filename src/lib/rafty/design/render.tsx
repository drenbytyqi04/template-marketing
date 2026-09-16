import { formatPrice, labelledValue } from "../constants";
import { alpha, INK, RADIUS, shade, SPACE, TRACK, TYPE, WEIGHT } from "../tokens";
import { FitText } from "@/components/rafty/FitText";
import type { RenderCtx } from "../templates";
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

const font = (ctx: RenderCtx) =>
  `"${ctx.brand.fontFamily}", "Sora", ui-sans-serif, system-ui, sans-serif`;

const fontSecondary = (ctx: RenderCtx) =>
  `"${ctx.brand.fontSecondary || ctx.brand.fontFamily}", "Sora", ui-sans-serif, system-ui, sans-serif`;

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
            background: `linear-gradient(140deg, ${alpha(brand.primary, 0.25)}, ${alpha(deep, 0.5)})`,
          }}
        />
      )}
      {ramp ? <div style={{ position: "absolute", inset: 0, background: ramp }} /> : null}
    </>
  );
}

/* ---------------------------------- parts ---------------------------------- */

const HEADLINE_SIZE = { hero: TYPE.hero, large: TYPE.h1, medium: TYPE.h2 } as const;

function Kicker({ ctx, tone }: { ctx: RenderCtx; tone: Tone }) {
  const value = (ctx.content.subject || ctx.content.location).trim();
  if (!value) return null;
  return (
    <span
      style={{
        fontSize: px(TYPE.label),
        fontWeight: WEIGHT.bold,
        letterSpacing: TRACK.wider,
        textTransform: "uppercase",
        // The brand colour is only legible where the design put a ground under
        // it. Over a photograph the kicker keeps the design's own ink, and the
        // accent is spent on the price and the call to action instead.
        color: tone === "dark" ? accent(ctx) : INK.onDarkBody,
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
      return has(content.subject) || has(content.location) ? TYPE.label * 1.4 : 0;
    case "headline":
      return 0;
    case "price": {
      if (!formatPrice(content.price, ctx.brand.currency)) return 0;
      return part.as === "badge" ? TYPE.h3 * 1.2 + SPACE.sm * 2 : TYPE.h2 * 1.2;
    }
    case "facts": {
      const n = [content.location, content.meta1, content.date].filter(has).length;
      return n ? TYPE.body * 1.5 : 0;
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
    case "brand":
      return ctx.brand.logoDataUrl || (ctx.showBrandName && ctx.businessName) ? 5 : 0;
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
  size: "hero" | "large" | "medium";
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

function Price({ ctx, tone, as }: { ctx: RenderCtx; tone: Tone; as: "plain" | "badge" }) {
  const price = formatPrice(ctx.content.price, ctx.brand.currency);
  if (!price) return null;
  if (as === "badge") {
    return (
      <span
        style={{
          padding: `${px(SPACE.sm)} ${px(SPACE.lg)}`,
          borderRadius: px(RADIUS.pill),
          background: accent(ctx),
          color: INK.onDark,
          fontSize: px(TYPE.h3),
          fontWeight: WEIGHT.heavy,
          letterSpacing: TRACK.tight,
          whiteSpace: "nowrap",
          fontFamily: font(ctx),
        }}
      >
        {price}
      </span>
    );
  }
  return (
    <span
      style={{
        fontSize: px(TYPE.h2),
        fontWeight: WEIGHT.heavy,
        letterSpacing: TRACK.tight,
        whiteSpace: "nowrap",
        color: ink(tone).strong,
        fontFamily: font(ctx),
      }}
    >
      {price}
    </span>
  );
}

/** Where, how long, when: printed only where the post actually said something. */
function Facts({ ctx, tone, limit = 3 }: { ctx: RenderCtx; tone: Tone; limit?: number }) {
  const { content } = ctx;
  const values = [
    labelledValue(content.location, content.labels?.["location"]),
    labelledValue(content.meta1, content.labels?.["meta1"]),
    labelledValue(content.date, content.labels?.["date"]),
  ]
    .filter((v) => v && v.trim())
    .slice(0, limit);
  if (!values.length) return null;
  const c = ink(tone);
  return (
    <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: px(SPACE.md) }}>
      {values.map((value, i) => (
        <span key={value} style={{ display: "flex", alignItems: "center", gap: px(SPACE.md) }}>
          {i > 0 ? (
            <span
              style={{ width: px(0.6), height: px(0.6), borderRadius: "50%", background: c.faint }}
            />
          ) : null}
          <span
            style={{
              fontSize: px(TYPE.body),
              fontWeight: WEIGHT.medium,
              color: c.body,
              fontFamily: fontSecondary(ctx),
            }}
          >
            {value}
          </span>
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

function Brand({ ctx, tone }: { ctx: RenderCtx; tone: Tone }) {
  const showName = !!ctx.showBrandName && !!ctx.businessName;
  const logo = ctx.brand.logoDataUrl;
  // Always a box, even when empty: a block that spreads its parts between the
  // top and the foot of the frame loses that arrangement when a part vanishes.
  if (!showName && !logo) return <span aria-hidden style={{ display: "block" }} />;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: px(SPACE.md) }}>
      {logo ? (
        <img
          src={logo}
          alt=""
          crossOrigin="anonymous"
          style={{ height: px(5), width: "auto", objectFit: "contain" }}
        />
      ) : null}
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
  room?: number,
): React.ReactNode {
  switch (part.t) {
    case "kicker":
      return <Kicker key={key} ctx={ctx} tone={tone} />;
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
      return <Brand key={key} ctx={ctx} tone={tone} />;
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
}: {
  block: Block;
  ctx: RenderCtx;
  tone: Tone;
  rowHeight: number;
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
      {block.parts.map((part, i) => renderPart(part, ctx, own, i, room))}
    </div>
  );
}

/* ---------------------------------- design --------------------------------- */

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Draws one design. The page margin and the field are the same for every
 * design, which is most of what makes a set look like a set. */
export function renderDesign(spec: DesignSpec, ctx: RenderCtx): React.ReactNode {
  // One row of the field, in the same container relative unit everything else
  // is measured in. The canvas is 100 units wide whatever its pixel size, so
  // its height follows from its shape.
  const shape = ctx.canvas ? ctx.canvas.height / ctx.canvas.width : 1.25;
  const rowHeight = (100 * shape - SPACE.page * 2) / GRID;
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
          padding: px(SPACE.page),
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
          <BlockNode key={i} block={block} ctx={ctx} tone={spec.tone} rowHeight={rowHeight} />
        ))}
      </div>
    </div>
  );
}
