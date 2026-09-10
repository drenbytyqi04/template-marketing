import { formatPrice, FORMAT_SPECS, labelledValue } from "./constants";
import { alpha, ELEVATION, INK, shade, TRACK, WEIGHT } from "./tokens";
import { Briefcase, Building2, MapPin, Plane } from "lucide-react";
import { FitText } from "@/components/rafty/FitText";
import type {
  BrandProfile,
  BusinessType,
  ContentFormat,
  PostAdjustments,
  PostContent,
  Template,
  TemplateTag,
  TemplateCategory,
  TemplateCollection,
  TemplateVariant,
  TemplateZone,
  ZoneKey,
} from "./types";

/**
 * Deterministic template system.
 * Layout is owned 100 percent by these engines. AI only writes text.
 * Placeholders: title, subject, location, price, date, meta1, meta2,
 * services, additionalText, cta, image, logo, business name.
 */

export type RenderCtx = {
  content: PostContent;
  brand: BrandProfile;
  businessName: string;
  businessType: BusinessType;
  variant: TemplateVariant;
  showBrandName?: boolean;
  adjustments?: PostAdjustments;
  /** Renders the brand contact zone when a template opts in. */
  showContact?: boolean;
};

const px = (n: number) => `${n}cqw`;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const font = (brand: BrandProfile) =>
  `"${brand.fontFamily}", "Sora", ui-sans-serif, system-ui, sans-serif`;

const fontSecondary = (brand: BrandProfile) =>
  `"${brand.fontSecondary || brand.fontFamily}", "Sora", ui-sans-serif, system-ui, sans-serif`;

const accentColor = (ctx: RenderCtx) =>
  ctx.variant.accent === "secondary"
    ? ctx.brand.secondary
    : ctx.variant.accent === "accent"
      ? ctx.brand.accent
      : ctx.brand.primary;

/** Clamped translate/scale/align applied only to the dynamic content block. */
function AdjustBox({
  ctx,
  children,
  style,
}: {
  ctx: RenderCtx;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  const adjust = ctx.adjustments?.text;
  const x = clamp(adjust?.x ?? 0, -12, 12);
  const y = clamp(adjust?.y ?? 0, -12, 12);
  const scale = clamp(adjust?.scale ?? 1, 0.8, 1.25);
  const align = adjust?.align;
  return (
    <div
      style={{
        transform: `translate(${x}cqw, ${y}cqw) scale(${scale})`,
        transformOrigin:
          align === "right" ? "right center" : align === "center" ? "center" : "left center",
        textAlign: align,
        alignItems: align === "center" ? "center" : align === "right" ? "flex-end" : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Img({
  src,
  video,
  style,
}: {
  src: string | null;
  /** Uploaded footage. When present it replaces the still as the base layer,
   * so every template's design renders over the moving picture unchanged. */
  video?: string | null | undefined;
  style?: React.CSSProperties;
}) {
  const base: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    height: "100%",
    width: "100%",
    objectFit: "cover",
    ...style,
  };

  if (video)
    return (
      <video src={video} autoPlay loop muted playsInline crossOrigin="anonymous" style={base} />
    );

  if (!src)
    return (
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(140deg, #e9e4f7, #d6cbf3)",
          ...style,
        }}
      />
    );
  return <img src={src} alt="" crossOrigin="anonymous" style={base} />;
}

/** Logo only renders when a real logo file exists. Never fabricated marks. */
function Logo({ ctx }: { ctx: RenderCtx }) {
  const { brand } = ctx;
  if (!brand.logoDataUrl) return null;
  return (
    <img
      src={brand.logoDataUrl}
      alt=""
      crossOrigin="anonymous"
      style={{ height: px(7), width: "auto", objectFit: "contain" }}
    />
  );
}

/** Business type decides which secondary values appear on the design. */
export function metaItems(content: PostContent, type: BusinessType): string[] {
  const out: string[] = [];
  /** A bare number is printed with its own field wording: 4 -> "4 Nights". */
  const push = (key: "location" | "meta1" | "meta2" | "date") => {
    const v = labelledValue(content[key] ?? "", content.labels?.[key]);
    if (v) out.push(v);
  };
  if (type === "travel_agency") {
    push("location");
    push("meta1");
    push("date");
  } else if (type === "real_estate" || type === "car_dealership") {
    push("meta1");
    push("meta2");
    push("date");
  } else if (type === "restaurant") {
    push("location");
    push("date");
  } else {
    push("meta1");
    push("date");
  }
  return out;
}

function Chips({ items, tone }: { items: string[]; tone: "light" | "dark" }) {
  if (!items.length) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: px(1.2) }}>
      {items.slice(0, 6).map((s) => (
        <span
          key={s}
          style={{
            fontSize: px(2.2),
            fontWeight: 600,
            padding: `${px(0.8)} ${px(2.2)}`,
            borderRadius: px(9),
            color: tone === "light" ? "#fff" : "#221a33",
            background: tone === "light" ? "rgba(255,255,255,0.18)" : "rgba(24,12,45,0.06)",
            border: `1px solid ${tone === "light" ? "rgba(255,255,255,0.34)" : "rgba(24,12,45,0.08)"}`,
            backdropFilter: "blur(6px)",
          }}
        >
          {s}
        </span>
      ))}
    </div>
  );
}

function PriceBadge({ ctx, tone }: { ctx: RenderCtx; tone: "light" | "dark" }) {
  const price = formatPrice(ctx.content.price, ctx.brand.currency);
  if (!price) return null;
  const square = ctx.variant.badge === "square";
  return (
    <span
      style={{
        display: "inline-block",
        alignSelf: "flex-start",
        padding: `${px(1.8)} ${px(3.4)}`,
        borderRadius: square ? px(1.6) : px(10),
        fontWeight: 800,
        fontSize: px(4.2),
        letterSpacing: "-0.01em",
        fontFamily: font(ctx.brand),
        color: tone === "light" ? accentColor(ctx) : "#fff",
        background:
          tone === "light"
            ? "#fff"
            : `linear-gradient(135deg, ${ctx.brand.primary}, ${ctx.brand.secondary})`,
      }}
    >
      {price}
    </span>
  );
}

function CtaTag({ ctx, tone }: { ctx: RenderCtx; tone: "light" | "dark" }) {
  const cta = ctx.content.cta.trim();
  if (!cta) return null;
  return (
    <span
      style={{
        display: "inline-block",
        fontSize: px(2.6),
        fontWeight: 700,
        letterSpacing: "0.02em",
        padding: `${px(1.2)} ${px(2.6)}`,
        borderRadius: px(9),
        fontFamily: fontSecondary(ctx.brand),
        color: tone === "light" ? "#0f0a1a" : "#fff",
        background: tone === "light" ? "#fff" : accentColor(ctx),
      }}
    >
      {cta}
    </span>
  );
}

function Kicker({ ctx, color }: { ctx: RenderCtx; color: string }) {
  const value = ctx.content.subject.trim() || ctx.businessName;
  if (!value) return null;
  return (
    <span
      style={{
        fontSize: px(2.6),
        fontWeight: 700,
        letterSpacing: "0.2em",
        textTransform: "uppercase",
        fontFamily: fontSecondary(ctx.brand),
        color,
      }}
    >
      {value}
    </span>
  );
}

function Title({ ctx, size, color }: { ctx: RenderCtx; size: number; color: string }) {
  return (
    <FitText
      as="h2"
      text={ctx.content.title || "Your headline here"}
      maxSize={size}
      minSize={Math.max(3.2, size * 0.45)}
      maxLines={3}
      lineHeight={1.03}
      tightLineHeight={0.98}
      style={{
        fontWeight: 800,
        letterSpacing: "-0.03em",
        fontFamily: font(ctx.brand),
        color,
      }}
    />
  );
}

/** Shrinks to fit rather than clipping or overflowing its zone. */
function AdditionalText({
  ctx,
  size,
  opacity = 1,
  style,
}: {
  ctx: RenderCtx;
  size: number;
  opacity?: number;
  style?: React.CSSProperties;
}) {
  const text = ctx.content.additionalText;
  if (!text) return null;
  return (
    <FitText
      as="p"
      text={text}
      maxSize={size}
      minSize={Math.max(1.8, size * 0.65)}
      maxLines={3}
      lineHeight={1.4}
      tightLineHeight={1.25}
      style={{ opacity, fontFamily: fontSecondary(ctx.brand), ...style }}
    />
  );
}

/**
 * What the post says is included, as one quiet line.
 *
 * Designs built around a chip row print these among the chips. The sparser
 * layouts have no chip row at all, and used to drop the choice silently: a
 * customer ticked Breakfast and Transfers and nothing appeared anywhere. A
 * single separated line states them without loading up a minimal design.
 */
function ServiceLine({ ctx, tone }: { ctx: RenderCtx; tone: "light" | "dark" }) {
  const items = ctx.content.services.filter(Boolean).slice(0, 6);
  if (!items.length) return null;
  return (
    <div
      style={{
        fontSize: px(2.2),
        fontWeight: 600,
        lineHeight: 1.4,
        letterSpacing: "0.02em",
        fontFamily: fontSecondary(ctx.brand),
        color: tone === "light" ? "rgba(255,255,255,0.92)" : "rgba(20,16,32,0.72)",
      }}
    >
      {items.join("  ·  ")}
    </div>
  );
}

/** Compact contact line, only rendered when the post opts in. Tasteful and
 * small: never more than a single wrapped line of the brand's essentials. */
function ContactLine({ ctx, tone }: { ctx: RenderCtx; tone: "light" | "dark" }) {
  if (!ctx.showContact) return null;
  const { contact } = ctx.brand;
  if (!contact) return null;
  const parts = [
    contact.phones.filter(Boolean)[0],
    contact.email,
    contact.website,
    contact.address,
    contact.social,
  ].filter((v): v is string => !!v && v.trim().length > 0);
  if (!parts.length) return null;
  return (
    <div
      style={{
        fontSize: px(2.2),
        fontWeight: 500,
        lineHeight: 1.4,
        fontFamily: fontSecondary(ctx.brand),
        color: tone === "light" ? "rgba(255,255,255,0.85)" : "rgba(20,16,32,0.62)",
      }}
    >
      {parts.join("  ·  ")}
    </div>
  );
}

function BizRow({ ctx, tone }: { ctx: RenderCtx; tone: "light" | "dark" }) {
  const showName = !!ctx.showBrandName && !!ctx.businessName;
  const hasLogo = !!ctx.brand.logoDataUrl;
  // An empty row still has to occupy its place in the layout. Returning nothing
  // removed a flex item, and a column that spreads its children to the top and
  // the foot of the frame was then left with one child, which it put at the
  // top: a brand with no logo and its name switched off saw the whole design
  // slide up into the corner.
  if (!showName && !hasLogo) return <span aria-hidden style={{ display: "block" }} />;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: px(2.6) }}>
      <Logo ctx={ctx} />
      {showName ? (
        <span
          style={{
            fontSize: px(2.6),
            fontWeight: 700,
            fontFamily: fontSecondary(ctx.brand),
            color: tone === "light" ? "#fff" : "#1a1225",
          }}
        >
          {ctx.businessName}
        </span>
      ) : null}
    </div>
  );
}

/* ------------------------------ flight designs ----------------------------- */

/** A three letter code out of whatever the post names, the way a ticket prints
 * a destination. Falls back to the first letters it can find. */
const codeOf = (value: string, fallback: string) => {
  const clean = value.replace(/[^\p{L}\p{N} ]/gu, " ").trim();
  const words = clean.split(/\s+/).filter(Boolean);
  const source = words.length > 1 ? words.map((w) => w[0]).join("") : (words[0] ?? fallback);
  return (source || fallback).slice(0, 3).toUpperCase();
};

/** The torn edge of a ticket: a row of half circles punched out of the seam. */
function Perforation({ color, count = 22 }: { color: string; count?: number }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: `0 ${px(2)}` }}>
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          style={{ width: px(1.2), height: px(1.2), borderRadius: "50%", background: color }}
        />
      ))}
    </div>
  );
}

/** Departure to arrival, as a dotted line with a plane sitting on it. */
function RouteLine({ from, to, color }: { from: string; to: string; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: px(1.8), width: "100%" }}>
      <span style={{ fontSize: px(5.4), fontWeight: 800, letterSpacing: "-0.02em", color }}>
        {from}
      </span>
      <span
        style={{
          flex: 1,
          height: px(0.4),
          background: `repeating-linear-gradient(90deg, ${color} 0 ${px(1)}, transparent ${px(0.8)} ${px(1.8)})`,
        }}
      />
      <span
        style={{
          width: 0,
          height: 0,
          borderTop: `${px(1.2)} solid transparent`,
          borderBottom: `${px(1.2)} solid transparent`,
          borderLeft: `${px(2.6)} solid ${color}`,
        }}
      />
      <span
        style={{
          flex: 1,
          height: px(0.4),
          background: `repeating-linear-gradient(90deg, ${color} 0 ${px(1)}, transparent ${px(0.8)} ${px(1.8)})`,
        }}
      />
      <span style={{ fontSize: px(5.4), fontWeight: 800, letterSpacing: "-0.02em", color }}>
        {to}
      </span>
    </div>
  );
}

/** Uneven bars, the way a fare barcode prints under a ticket. */
function Barcode({ color, height = 6 }: { color: string; height?: number }) {
  const widths = [0.5, 0.9, 0.4, 1.3, 0.5, 0.7, 1.1, 0.4, 0.8, 0.5, 1.2, 0.6, 0.4, 1, 0.7, 0.5];
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: px(0.4), height: px(height) }}>
      {widths.map((w, i) => (
        <span key={i} style={{ width: px(w), height: "100%", background: color, opacity: 0.9 }} />
      ))}
    </div>
  );
}

/** One labelled cell of a ticket: GATE, SEAT, DATE. */
function TicketField({
  ctx,
  label,
  value,
  tone,
}: {
  ctx: RenderCtx;
  label: string;
  value: string;
  tone: "light" | "dark";
}) {
  if (!value) return null;
  const ink = tone === "light" ? "#fff" : "#191128";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: px(0.4) }}>
      <span
        style={{
          fontSize: px(1.8),
          fontWeight: 700,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          opacity: 0.6,
          fontFamily: fontSecondary(ctx.brand),
          color: ink,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: px(3.2),
          fontWeight: 800,
          fontFamily: font(ctx.brand),
          color: ink,
        }}
      >
        {value}
      </span>
    </div>
  );
}

/* ------------------------------- sea designs ------------------------------- */

/** A scalloped edge: overlapping discs that read as a wave where two colours
 * meet, or as snow where the colour is white. */
function Scallop({
  color,
  size = 6,
  flip = false,
  count = 9,
}: {
  color: string;
  size?: number;
  flip?: boolean;
  count?: number;
}) {
  return (
    <div
      style={{
        position: "relative",
        height: px(size / 2),
        display: "flex",
        justifyContent: "space-between",
        marginTop: flip ? 0 : `-${px(size / 2)}`,
        marginBottom: flip ? `-${px(size / 2)}` : 0,
      }}
    >
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          style={{
            width: `${100 / count}%`,
            height: px(size),
            borderRadius: "50%",
            background: color,
            marginTop: flip ? `-${px(size / 2)}` : 0,
          }}
        />
      ))}
    </div>
  );
}

/** The sun, as a plain disc the design can place where it likes. */
function SunDisc({
  color,
  size,
  style,
}: {
  color: string;
  size: number;
  style?: React.CSSProperties;
}) {
  return (
    <span
      style={{
        position: "absolute",
        width: px(size),
        height: px(size),
        borderRadius: "50%",
        background: color,
        ...style,
      }}
    />
  );
}

/* ------------------------- world and winter designs ------------------------ */

/** A passport stamp: a rotated dashed box with the destination inside it. */
function Stamp({
  ctx,
  color,
  rotate = -9,
  size = 22,
}: {
  ctx: RenderCtx;
  color: string;
  rotate?: number;
  size?: number;
}) {
  const word = (ctx.content.subject || ctx.content.location || ctx.businessName).toUpperCase();
  return (
    <span
      style={{
        width: px(size),
        height: px(size * 0.72),
        border: `${px(0.8)} dashed ${color}`,
        borderRadius: px(1.2),
        transform: `rotate(${rotate}deg)`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: px(0.4),
        color,
        textAlign: "center",
        padding: px(0.8),
      }}
    >
      <span style={{ fontSize: px(1.8), letterSpacing: "0.2em", opacity: 0.85 }}>VISITED</span>
      <span
        style={{
          fontSize: px(2.6),
          fontWeight: 800,
          letterSpacing: "0.06em",
          fontFamily: fontSecondary(ctx.brand),
          lineHeight: 1.05,
        }}
      >
        {word.slice(0, 12)}
      </span>
    </span>
  );
}

/** Pins joined by a dotted line, the way a route is drawn on a map. */
function DottedRoute({ color, stops = 4 }: { color: string; stops?: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", width: "100%" }}>
      {Array.from({ length: stops }, (_, i) => (
        <div
          key={i}
          style={{ display: "flex", alignItems: "center", flex: i === stops - 1 ? "0 0 auto" : 1 }}
        >
          <span style={{ width: px(2), height: px(2), borderRadius: "50%", background: color }} />
          {i < stops - 1 ? (
            <span
              style={{
                flex: 1,
                height: px(0.35),
                background: `repeating-linear-gradient(90deg, ${color} 0 ${px(0.8)}, transparent ${px(0.8)} ${px(1.8)})`,
              }}
            />
          ) : null}
        </div>
      ))}
    </div>
  );
}

/** The stops of a trip, numbered, taken from what the post says is included. */
function StopList({ ctx, tone }: { ctx: RenderCtx; tone: "light" | "dark" }) {
  const stops = ctx.content.services.filter(Boolean).slice(0, 5);
  if (!stops.length) return null;
  const ink = tone === "light" ? "#fff" : "#191128";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: px(1.2), width: "100%" }}>
      {stops.map((stop, i) => (
        <div key={stop} style={{ display: "flex", alignItems: "center", gap: px(1.8) }}>
          <span
            style={{
              width: px(4.4),
              height: px(4.4),
              borderRadius: "50%",
              border: `${px(0.4)} solid ${ink}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: px(2.2),
              fontWeight: 800,
              color: ink,
              opacity: 0.85,
              fontFamily: font(ctx.brand),
            }}
          >
            {i + 1}
          </span>
          <span
            style={{
              fontSize: px(2.6),
              fontWeight: 600,
              color: ink,
              fontFamily: fontSecondary(ctx.brand),
            }}
          >
            {stop}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Scattered dots that read as falling snow. Fixed positions, so the design
 * exports exactly as it previews. */
function Snowfall({
  count = 26,
  color = "rgba(255,255,255,0.85)",
}: {
  count?: number;
  color?: string;
}) {
  const flakes = Array.from({ length: count }, (_, i) => {
    const x = (i * 37) % 100;
    const y = (i * 61) % 100;
    const size = 0.6 + ((i * 13) % 10) / 10;
    return { x, y, size, key: i };
  });
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      {flakes.map((f) => (
        <span
          key={f.key}
          style={{
            position: "absolute",
            left: `${f.x}%`,
            top: `${f.y}%`,
            width: px(f.size),
            height: px(f.size),
            borderRadius: "50%",
            background: color,
            opacity: 0.5 + (f.size % 1) * 0.5,
          }}
        />
      ))}
    </div>
  );
}

/* ------------------------------ photo treatment ---------------------------- */

/** How a design treats the picture under it. */
export type PhotoTreatment =
  "plain" | "scrimBottom" | "scrimTop" | "scrimBoth" | "wash" | "duotone";

/**
 * One place that decides how a photograph is prepared.
 *
 * Every design used to roll its own gradient over the picture, so thirty odd
 * ramps existed for four intentions and no two dark posters darkened the same
 * way. Naming the intentions instead - carry the type at the bottom, at the
 * top, wash the whole thing, grade it to the brand - is what makes a set look
 * art directed rather than assembled, and it means a change to how pictures are
 * handled is one edit rather than thirty.
 *
 * The ramps are built from the brand's own primary pushed dark, so the shadow
 * over the picture belongs to the brand rather than being a neutral black.
 */
function PhotoLayer({
  ctx,
  treatment = "plain",
  strength = 1,
  grain = false,
  style,
}: {
  ctx: RenderCtx;
  treatment?: PhotoTreatment;
  strength?: number;
  grain?: boolean;
  style?: React.CSSProperties;
}) {
  const { content, brand } = ctx;
  const deep = shade(brand.primary, 0.72);
  const s = Math.min(1, Math.max(0, strength));
  const ramps: Record<PhotoTreatment, string | null> = {
    plain: null,
    scrimBottom: `linear-gradient(to top, ${alpha(deep, 0.92 * s)} 4%, ${alpha(deep, 0.5 * s)} 30%, ${alpha(deep, 0)} 64%)`,
    scrimTop: `linear-gradient(to bottom, ${alpha(deep, 0.8 * s)} 0%, ${alpha(deep, 0.28 * s)} 26%, ${alpha(deep, 0)} 52%)`,
    scrimBoth: `linear-gradient(to bottom, ${alpha(deep, 0.72 * s)} 0%, ${alpha(deep, 0)} 34%, ${alpha(deep, 0)} 52%, ${alpha(deep, 0.9 * s)} 96%)`,
    wash: `linear-gradient(150deg, ${alpha(brand.primary, 0.86 * s)}, ${alpha(deep, 0.94 * s)})`,
    duotone: `linear-gradient(150deg, ${alpha(brand.primary, 0.82 * s)}, ${alpha(deep, 0.9 * s)})`,
  };
  const ramp = ramps[treatment];
  return (
    <>
      <Img
        src={content.imageDataUrl}
        video={content.videoDataUrl}
        style={{
          // A graded picture reads as one image with the brand rather than a
          // photograph with a colour laid on top of it.
          ...(treatment === "duotone" ? { filter: "grayscale(1) contrast(1.08)" } : {}),
          ...style,
        }}
      />
      {ramp ? <div style={{ position: "absolute", inset: 0, background: ramp }} /> : null}
      {grain ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: 0.14,
            backgroundImage: `radial-gradient(${alpha("#ffffff", 0.9)} 0.5px, transparent 0.6px)`,
            backgroundSize: `${px(0.8)} ${px(0.8)}`,
          }}
        />
      ) : null}
    </>
  );
}

/* -------------------------------- video stage ------------------------------ */

/**
 * The skeleton every video design starts from: the footage, its scrim, and a
 * padded column over it that pins one block to the top of the frame and one to
 * the foot. A clip is 9:16 and the picture is the reason anyone stops on it, so
 * the middle is left alone and the design works at the two edges.
 */
function Stage({
  ctx,
  treatment = "plain",
  strength = 1,
  pad = 5,
  children,
}: {
  ctx: RenderCtx;
  treatment?: PhotoTreatment;
  strength?: number;
  pad?: number;
  children: React.ReactNode;
}) {
  return (
    <div style={{ ...base(ctx.brand), color: INK.onDark }}>
      <PhotoLayer ctx={ctx} treatment={treatment} strength={strength} />
      <div
        style={{
          position: "absolute",
          inset: 0,
          padding: px(pad),
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          gap: px(2.6),
        }}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * A band that runs the full width of the clip while still being drawn inside
 * the padded layer. A platform lays its caption and buttons over the top and
 * bottom of a vertical video, and the safe area is applied to that one layer,
 * so a band pinned to the frame's own edge would sit under them. Bleeding
 * sideways out of the layer keeps the full width look and the clear zone both.
 */
function Bleed({
  pad = 5,
  style,
  children,
}: {
  pad?: number;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginInline: `-${px(pad)}`, paddingInline: px(pad), ...style }}>{children}</div>
  );
}

/* ---------------------------- property listings ---------------------------- */

/**
 * The parts a property listing is built from.
 *
 * A listing sells on facts held quietly: what it is, where, how many rooms, how
 * much floor, and the number. So these designs are restrained by construction -
 * a wide tracked label over a plain figure, hairlines instead of boxes, one
 * accent - and the picture is given room rather than covered in badges.
 */

/** Rooms, area, floor: the figures a listing is read for, as labelled cells
 * divided by hairlines. */
function SpecRow({
  ctx,
  tone,
  align = "left",
}: {
  ctx: RenderCtx;
  tone: "light" | "dark";
  align?: "left" | "center";
}) {
  const { content } = ctx;
  const cells = [
    [content.meta1, ctx.content.labels?.["meta1"] ?? "Rooms"],
    [content.meta2, ctx.content.labels?.["meta2"] ?? "Area"],
    [content.date, ctx.content.labels?.["date"] ?? "Available"],
  ].filter(([value]) => !!value && String(value).trim()) as [string, string][];
  if (!cells.length) return null;
  const ink = tone === "light" ? INK.onDark : INK.strong;
  const rule = tone === "light" ? INK.onDarkFaint : INK.faint;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "stretch",
        justifyContent: align === "center" ? "center" : "flex-start",
        gap: px(2.6),
        width: "100%",
      }}
    >
      {cells.map(([value, label], i) => (
        <div
          key={label}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: px(0.4),
            paddingLeft: i === 0 ? 0 : px(2.6),
            borderLeft: i === 0 ? undefined : `1px solid ${rule}`,
          }}
        >
          <span
            style={{
              fontSize: px(1.8),
              fontWeight: WEIGHT.bold,
              letterSpacing: TRACK.wide,
              textTransform: "uppercase",
              color: tone === "light" ? INK.onDarkMuted : INK.muted,
              fontFamily: fontSecondary(ctx.brand),
            }}
          >
            {label}
          </span>
          <span
            style={{
              fontSize: px(3.2),
              fontWeight: WEIGHT.heavy,
              letterSpacing: TRACK.snug,
              whiteSpace: "nowrap",
              color: ink,
              fontFamily: font(ctx.brand),
            }}
          >
            {value}
          </span>
        </div>
      ))}
    </div>
  );
}

/** The asking price, stated rather than badged. */
function AskingPrice({
  ctx,
  tone,
  size = 7,
  align = "left",
}: {
  ctx: RenderCtx;
  tone: "light" | "dark";
  size?: number;
  align?: "left" | "center" | "right";
}) {
  const price = formatPrice(ctx.content.price, ctx.brand.currency);
  if (!price) return null;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: px(0.4),
        alignItems: align === "center" ? "center" : align === "right" ? "flex-end" : "flex-start",
      }}
    >
      <span
        style={{
          fontSize: px(1.8),
          fontWeight: WEIGHT.bold,
          letterSpacing: TRACK.wider,
          textTransform: "uppercase",
          color: tone === "light" ? INK.onDarkMuted : INK.muted,
          fontFamily: fontSecondary(ctx.brand),
        }}
      >
        {ctx.content.labels?.["price"] ?? "Asking price"}
      </span>
      <span
        style={{
          fontSize: px(size),
          fontWeight: WEIGHT.heavy,
          letterSpacing: TRACK.tight,
          whiteSpace: "nowrap",
          color: tone === "light" ? INK.onDark : INK.strong,
          fontFamily: font(ctx.brand),
        }}
      >
        {price}
      </span>
    </div>
  );
}

/** The status a listing carries: for sale, reserved, new. Taken from the post's
 * own wording so nothing is invented. */
function StatusTag({ ctx, tone, text }: { ctx: RenderCtx; tone: "light" | "dark"; text?: string }) {
  const value = (text ?? ctx.content.subject ?? "").trim();
  if (!value) return null;
  return (
    <span
      style={{
        alignSelf: "flex-start",
        padding: `${px(0.8)} ${px(1.8)}`,
        border: `1px solid ${tone === "light" ? INK.onDarkMuted : INK.faint}`,
        fontSize: px(1.8),
        fontWeight: WEIGHT.bold,
        letterSpacing: TRACK.wider,
        textTransform: "uppercase",
        color: tone === "light" ? INK.onDark : INK.strong,
        fontFamily: fontSecondary(ctx.brand),
      }}
    >
      {value}
    </span>
  );
}

/** The agency's line at the foot of a listing: who is selling it and how to
 * reach them. */
function AgentFoot({ ctx, tone }: { ctx: RenderCtx; tone: "light" | "dark" }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: px(0.8), width: "100%" }}>
      <span
        style={{
          height: 1,
          width: "100%",
          background: tone === "light" ? INK.onDarkFaint : INK.faint,
        }}
      />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: px(1.8),
          flexWrap: "wrap",
        }}
      >
        <BizRow ctx={ctx} tone={tone} />
        <ContactLine ctx={ctx} tone={tone} />
      </div>
    </div>
  );
}

/** The features of the property, as a quiet list rather than pills. */
function FeatureList({
  ctx,
  tone,
  columns = 2,
}: {
  ctx: RenderCtx;
  tone: "light" | "dark";
  columns?: number;
}) {
  const items = ctx.content.services.filter(Boolean).slice(0, 6);
  if (!items.length) return null;
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gap: `${px(0.8)} ${px(2.6)}`,
        width: "100%",
      }}
    >
      {items.map((item) => (
        <div key={item} style={{ display: "flex", alignItems: "center", gap: px(1.2) }}>
          <span
            style={{
              width: px(0.8),
              height: px(0.8),
              borderRadius: "50%",
              background: accentColor(ctx),
              flex: "0 0 auto",
            }}
          />
          <span
            style={{
              fontSize: px(2.2),
              fontWeight: WEIGHT.medium,
              color: tone === "light" ? INK.onDarkBody : INK.body,
              fontFamily: fontSecondary(ctx.brand),
            }}
          >
            {item}
          </span>
        </div>
      ))}
    </div>
  );
}

/** A serif headline, the voice these listings are written in. */
function ListingTitle({
  ctx,
  size,
  tone,
  align = "left",
}: {
  ctx: RenderCtx;
  size: number;
  tone: "light" | "dark";
  align?: "left" | "center";
}) {
  return (
    <FitText
      as="h2"
      text={ctx.content.title || "Your headline here"}
      maxSize={size}
      minSize={Math.max(3.2, size * 0.45)}
      maxLines={3}
      lineHeight={1.06}
      tightLineHeight={1}
      style={{
        fontWeight: WEIGHT.bold,
        letterSpacing: TRACK.tight,
        fontFamily: fontSecondary(ctx.brand),
        color: tone === "light" ? INK.onDark : INK.strong,
        textAlign: align,
      }}
    />
  );
}

/** Thin marks at the corners of a frame, the way a plan is cropped. */
function CornerMarks({
  color,
  inset = 3.6,
  len = 5,
}: {
  color: string;
  inset?: number;
  len?: number;
}) {
  const arm = (style: React.CSSProperties) => (
    <span style={{ position: "absolute", background: color, ...style }} />
  );
  return (
    <>
      {arm({ left: px(inset), top: px(inset), width: px(len), height: 1 })}
      {arm({ left: px(inset), top: px(inset), width: 1, height: px(len) })}
      {arm({ right: px(inset), top: px(inset), width: px(len), height: 1 })}
      {arm({ right: px(inset), top: px(inset), width: 1, height: px(len) })}
      {arm({ left: px(inset), bottom: px(inset), width: px(len), height: 1 })}
      {arm({ left: px(inset), bottom: px(inset), width: 1, height: px(len) })}
      {arm({ right: px(inset), bottom: px(inset), width: px(len), height: 1 })}
      {arm({ right: px(inset), bottom: px(inset), width: 1, height: px(len) })}
    </>
  );
}

/* ------------------------- flight poster vocabulary ------------------------ */

/**
 * The parts a travel agency flight post is actually built from.
 *
 * Working from real agency posts rather than from imagination: a deep navy
 * ground, a sky photograph, a headline whose tail turns italic, a row of small
 * reassurance boxes, one wide call to action and a contact strip along the
 * bottom. The brand still supplies every colour - the navy is the brand's own
 * primary pushed dark, so an orange agency and a blue one both look like
 * themselves.
 */
const deepGround = (brand: BrandProfile) =>
  `linear-gradient(0deg, rgba(7,12,30,0.82), rgba(7,12,30,0.82)), ${brand.primary}`;

/** A check mark drawn from two borders, so no icon font has to load. */
function Tick({ color, size = 2.2 }: { color: string; size?: number }) {
  return (
    <span
      style={{
        width: px(size),
        height: px(size * 1.7),
        borderRight: `${px(0.4)} solid ${color}`,
        borderBottom: `${px(0.4)} solid ${color}`,
        transform: "rotate(45deg)",
        marginTop: `-${px(size * 0.35)}`,
        flex: "0 0 auto",
      }}
    />
  );
}

/**
 * What the post says is included, as the reassurance boxes these posters put
 * under the headline - the "best fares, 24/7 support, safe booking" row.
 */
function FeatureBoxes({
  ctx,
  tone,
  columns = 2,
  limit = 4,
}: {
  ctx: RenderCtx;
  tone: "light" | "dark";
  columns?: number;
  limit?: number;
}) {
  const items = ctx.content.services.filter(Boolean).slice(0, limit);
  if (!items.length) return null;
  const ink = tone === "light" ? "#ffffff" : "#0f1731";
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gap: px(1.2),
        width: "100%",
      }}
    >
      {items.map((item) => (
        <div
          key={item}
          style={{
            display: "flex",
            alignItems: "center",
            gap: px(1.8),
            padding: `${px(1.2)} ${px(2)}`,
            borderRadius: px(1.2),
            background: tone === "light" ? "rgba(255,255,255,0.12)" : "rgba(15,23,49,0.06)",
            border: `1px solid ${tone === "light" ? "rgba(255,255,255,0.28)" : "rgba(15,23,49,0.12)"}`,
          }}
        >
          <Tick color={ctx.brand.accent} />
          <span
            style={{
              fontSize: px(2.2),
              fontWeight: 700,
              lineHeight: 1.2,
              color: ink,
              fontFamily: fontSecondary(ctx.brand),
            }}
          >
            {item}
          </span>
        </div>
      ))}
    </div>
  );
}

/** The wide call to action bar these posters close on. */
function CtaBar({ ctx, tone }: { ctx: RenderCtx; tone: "light" | "dark" }) {
  const label = ctx.content.cta.trim();
  const price = formatPrice(ctx.content.price, ctx.brand.currency);
  // The bar is where these designs carry the fare. With no call to action
  // written it becomes the price on its own rather than taking the price down
  // with it; only an offer with neither disappears.
  if (!label && !price) return null;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: px(2.6),
        width: "100%",
        padding: `${px(1.8)} ${px(3)}`,
        borderRadius: px(9),
        background: tone === "light" ? "#ffffff" : accentColor(ctx),
        color: tone === "light" ? accentColor(ctx) : "#ffffff",
      }}
    >
      {label ? (
        <span
          style={{
            fontSize: px(2.6),
            fontWeight: 800,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            fontFamily: fontSecondary(ctx.brand),
          }}
        >
          {label}
        </span>
      ) : null}
      {price ? (
        <span style={{ fontSize: px(3.2), fontWeight: 800, fontFamily: font(ctx.brand) }}>
          {price}
        </span>
      ) : null}
    </div>
  );
}

/** The contact strip along the very bottom of an agency poster. */
function ContactBar({ ctx, ground }: { ctx: RenderCtx; ground?: string }) {
  if (!ctx.showContact) return null;
  const { contact } = ctx.brand;
  if (!contact) return null;
  const parts = [contact.phones.filter(Boolean)[0], contact.website, contact.address].filter(
    (v): v is string => !!v && v.trim().length > 0,
  );
  if (!parts.length) return null;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: px(2.6),
        flexWrap: "wrap",
        padding: `${px(1.8)} ${px(3)}`,
        background: ground ?? "rgba(7,12,30,0.9)",
        width: "100%",
      }}
    >
      {parts.map((part) => (
        <span
          key={part}
          style={{
            fontSize: px(2.2),
            fontWeight: 600,
            color: INK.onDarkBody,
            fontFamily: fontSecondary(ctx.brand),
          }}
        >
          {part}
        </span>
      ))}
    </div>
  );
}

/**
 * The headline these posters run: bold sans, with the tail of the line turning
 * italic in the brand accent. Two blocks rather than one, so each half fits its
 * own box instead of one mixed run overflowing.
 */
function HeadlineTwoTone({
  ctx,
  size,
  color,
  accent,
  align = "left",
}: {
  ctx: RenderCtx;
  size: number;
  color: string;
  accent: string;
  align?: "left" | "center" | "right";
}) {
  const words = (ctx.content.title || "Your headline here").trim().split(/\s+/);
  const tail = words.length >= 3 ? words.slice(-2).join(" ") : "";
  const head = tail ? words.slice(0, -2).join(" ") : words.join(" ");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: px(0.4), width: "100%" }}>
      <FitText
        as="h2"
        text={head}
        maxSize={size}
        minSize={Math.max(3.4, size * 0.45)}
        maxLines={2}
        lineHeight={1.02}
        tightLineHeight={0.96}
        style={{
          fontWeight: 800,
          letterSpacing: "-0.03em",
          fontFamily: font(ctx.brand),
          color,
          textAlign: align,
        }}
      />
      {tail ? (
        <FitText
          as="div"
          text={tail}
          maxSize={size * 0.82}
          minSize={Math.max(3, size * 0.4)}
          maxLines={1}
          lineHeight={1.1}
          style={{
            fontStyle: "italic",
            fontWeight: 600,
            letterSpacing: "-0.01em",
            fontFamily: fontSecondary(ctx.brand),
            color: accent,
            textAlign: align,
          }}
        />
      ) : null}
    </div>
  );
}

/** A curved sweep, the shape these posters use to cut a colour block into the
 * photograph. */
function SweepArc({ color, height = 16 }: { color: string; height?: number }) {
  return (
    <div
      style={{
        position: "relative",
        height: px(height / 2),
        marginTop: `-${px(height / 2)}`,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: `-${px(6)}`,
          right: `-${px(6)}`,
          top: 0,
          height: px(height),
          background: color,
          borderRadius: "50% 50% 0 0 / 100% 100% 0 0",
        }}
      />
    </div>
  );
}

/** The dashed flight path, curved, with a plane sitting on it. */
function DashedArc({ color }: { color: string }) {
  return (
    <div style={{ position: "relative", height: px(7), width: "100%" }}>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: px(3),
          height: px(7),
          borderTop: `${px(0.4)} dashed ${color}`,
          borderRadius: "50% 50% 0 0 / 100% 100% 0 0",
        }}
      />
      <span
        style={{
          position: "absolute",
          left: "50%",
          top: px(1.4),
          marginLeft: `-${px(1.4)}`,
          width: 0,
          height: 0,
          borderTop: `${px(1.2)} solid transparent`,
          borderBottom: `${px(1.2)} solid transparent`,
          borderLeft: `${px(2.6)} solid ${color}`,
        }}
      />
    </div>
  );
}

/** Airline style route codes with the cities under them. */
function RouteCodes({ ctx, color, muted }: { ctx: RenderCtx; color: string; muted: string }) {
  const { content } = ctx;
  const from = codeOf(ctx.businessName, "OUT");
  const to = codeOf(content.subject || content.location, "DXB");
  const cell = (code: string, label: string, align: "flex-start" | "flex-end") => (
    <div style={{ display: "flex", flexDirection: "column", alignItems: align, gap: px(0.4) }}>
      <span
        style={{
          fontSize: px(7),
          fontWeight: 800,
          letterSpacing: "-0.02em",
          color,
          fontFamily: font(ctx.brand),
        }}
      >
        {code}
      </span>
      <span
        style={{
          fontSize: px(1.8),
          fontWeight: 600,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: muted,
          fontFamily: fontSecondary(ctx.brand),
        }}
      >
        {label}
      </span>
    </div>
  );
  return (
    <div style={{ display: "flex", alignItems: "center", gap: px(2.6), width: "100%" }}>
      {cell(from, ctx.businessName, "flex-start")}
      <div style={{ flex: 1 }}>
        <DashedArc color={muted} />
      </div>
      {cell(to, content.subject || content.location || "", "flex-end")}
    </div>
  );
}

/* ---------------------------- booking app parts ---------------------------- */

/**
 * The pieces of a travel booking app screen.
 *
 * A post built to look like an app is a real format agencies use, and it is
 * reproducible: the status row, the search field, the category strip, the deal
 * card, the destination cards and the tab bar are all boxes and type. What the
 * reference render adds around it - a hand, a photographed aircraft breaking
 * out of the screen, volumetric cloud - is photography, and nothing drawn in a
 * browser will stand in for it.
 */

/** The status row at the top of a phone screen. */
function PhoneStatus({ ctx, ink }: { ctx: RenderCtx; ink: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <span
        style={{
          fontSize: px(2.2),
          fontWeight: 700,
          color: ink,
          fontFamily: fontSecondary(ctx.brand),
        }}
      >
        9:41
      </span>
      <div style={{ display: "flex", alignItems: "flex-end", gap: px(0.4) }}>
        {[1, 1.5, 2, 2.5].map((h) => (
          <span
            key={h}
            style={{ width: px(0.6), height: px(h), borderRadius: px(0.3), background: ink }}
          />
        ))}
        <span
          style={{
            width: px(3),
            height: px(1.6),
            marginLeft: px(0.8),
            borderRadius: px(0.6),
            border: `${px(0.25)} solid ${ink}`,
          }}
        />
      </div>
    </div>
  );
}

/** The search field the screen opens with. */
function SearchField({ ctx }: { ctx: RenderCtx }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: px(1.8),
        background: "#fff",
        borderRadius: px(9),
        padding: `${px(1.8)} ${px(3)}`,
        boxShadow: `0 ${px(0.8)} ${px(2.6)} rgba(13,32,48,0.1)`,
      }}
    >
      <span
        style={{
          width: px(2.4),
          height: px(2.4),
          borderRadius: "50%",
          border: `${px(0.4)} solid ${ctx.brand.primary}`,
          flex: "0 0 auto",
        }}
      />
      <span
        style={{
          fontSize: px(2.2),
          fontWeight: 600,
          color: INK.muted,
          fontFamily: fontSecondary(ctx.brand),
        }}
      >
        {ctx.content.location || ctx.content.subject || "Kërko fluturime, hotele, vende…"}
      </span>
    </div>
  );
}

/** The row of category tiles, filled with what the post says is included. */
function CategoryRow({ ctx }: { ctx: RenderCtx }) {
  const items = ctx.content.services.filter(Boolean).slice(0, 4);
  if (!items.length) return null;
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`,
        gap: px(1.8),
      }}
    >
      {items.map((item) => (
        <div
          key={item}
          style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: px(0.8) }}
        >
          <span
            style={{
              width: px(8),
              height: px(8),
              borderRadius: px(2.4),
              background: `${ctx.brand.primary}1f`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {(() => {
              // A different mark per tile, cycled by position: the labels are
              // free text in any language, so reading meaning out of them would
              // be guesswork.
              const Icon = [Plane, Building2, Briefcase, MapPin][items.indexOf(item) % 4]!;
              return (
                <Icon
                  color={ctx.brand.primary}
                  strokeWidth={2.2}
                  style={{ width: px(4), height: px(4) }}
                />
              );
            })()}
          </span>
          <span
            style={{
              fontSize: px(1.8),
              fontWeight: 600,
              textAlign: "center",
              lineHeight: 1.15,
              color: INK.body,
              fontFamily: fontSecondary(ctx.brand),
            }}
          >
            {item}
          </span>
        </div>
      ))}
    </div>
  );
}

/** The hero deal card, the one the screen sells with. */
function DealCard({ ctx, heading }: { ctx: RenderCtx; heading: string }) {
  const { content, brand } = ctx;
  const price = formatPrice(content.price, brand.currency);
  return (
    <div
      style={{
        position: "relative",
        flex: 1,
        borderRadius: px(2.4),
        overflow: "hidden",
        minHeight: px(30),
      }}
    >
      <Img src={content.imageDataUrl} video={content.videoDataUrl} />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(100deg, ${brand.primary}f2 34%, ${brand.primary}55 62%, transparent)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          padding: px(2.6),
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: px(0.8),
          width: "62%",
        }}
      >
        <span
          style={{
            fontSize: px(2.2),
            fontStyle: "italic",
            fontWeight: 600,
            color: brand.accent,
            fontFamily: fontSecondary(brand),
          }}
        >
          {content.subject || ctx.businessName}
        </span>
        <FitText
          as="div"
          text={heading}
          maxSize={4.6}
          minSize={2.6}
          maxLines={2}
          lineHeight={1.05}
          style={{
            fontWeight: 800,
            color: INK.onDark,
            fontFamily: font(brand),
            letterSpacing: "-0.02em",
          }}
        />
        {content.additionalText ? (
          <span
            style={{
              fontSize: px(1.8),
              color: INK.onDarkBody,
              lineHeight: 1.3,
              fontFamily: fontSecondary(brand),
            }}
          >
            {content.additionalText}
          </span>
        ) : null}
        {price ? (
          <span
            style={{
              fontSize: px(4.2),
              fontWeight: 800,
              letterSpacing: TRACK.snug,
              color: INK.onDark,
              fontFamily: font(brand),
            }}
          >
            {price}
          </span>
        ) : null}
        {content.cta ? (
          <span
            style={{
              alignSelf: "flex-start",
              marginTop: px(0.8),
              padding: `${px(1.2)} ${px(2.4)}`,
              borderRadius: px(9),
              background: "#0d2030",
              color: INK.onDark,
              fontSize: px(1.8),
              fontWeight: 700,
              fontFamily: fontSecondary(brand),
            }}
          >
            {content.cta}
          </span>
        ) : null}
      </div>
    </div>
  );
}

/** The destination cards under the deal, priced the way a listing prints them. */
function DestinationCards({ ctx }: { ctx: RenderCtx }) {
  const { content, brand } = ctx;
  const meta = metaItems(content, ctx.businessType);
  const cards = [
    {
      where: content.subject || content.location,
      note: meta[0] ?? "",
      price: true,
      pos: "left center",
    },
    { where: meta[0] || content.location, note: meta[1] ?? "", price: false, pos: "center" },
    { where: meta[1] || content.date, note: meta[2] ?? "", price: false, pos: "right center" },
  ].filter((c, i, all) => !!c.where && all.findIndex((x) => x.where === c.where) === i);
  if (!cards.length) return null;
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${cards.length}, minmax(0, 1fr))`,
        gap: px(1.8),
      }}
    >
      {cards.map((card, i) => (
        <div
          key={`${card.where}-${i}`}
          style={{ display: "flex", flexDirection: "column", gap: px(0.8) }}
        >
          <div
            style={{
              position: "relative",
              height: px(14),
              borderRadius: px(2.4),
              overflow: "hidden",
            }}
          >
            <Img
              src={content.imageDataUrl}
              video={content.videoDataUrl}
              style={{ objectPosition: card.pos }}
            />
          </div>
          <span
            style={{
              fontSize: px(1.8),
              fontWeight: 700,
              color: INK.strong,
              fontFamily: fontSecondary(brand),
            }}
          >
            {card.where}
          </span>
          {card.price ? (
            <span
              style={{
                fontSize: px(2.2),
                fontWeight: 800,
                color: brand.primary,
                fontFamily: font(brand),
              }}
            >
              {formatPrice(content.price, brand.currency)}
            </span>
          ) : null}
          {card.note ? (
            <span
              style={{
                fontSize: px(1.8),
                color: INK.muted,
                fontFamily: fontSecondary(brand),
              }}
            >
              {card.note}
            </span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

/** The tab bar the screen sits on. */
function TabBar({ ctx }: { ctx: RenderCtx }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: `${px(1.8)} ${px(4)}`,
        borderTop: "1px solid rgba(13,32,48,0.08)",
        background: "#fff",
      }}
    >
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          style={{
            width: px(3),
            height: px(3),
            borderRadius: i === 0 ? px(0.8) : "50%",
            background: i === 0 ? ctx.brand.primary : "rgba(13,32,48,0.18)",
          }}
        />
      ))}
    </div>
  );
}

/** The whole screen, so both the flat design and the one inside a drawn phone
 * are the same layout rather than two that drift apart. */
function AppScreen({ ctx, compact = false }: { ctx: RenderCtx; compact?: boolean }) {
  const { content, brand } = ctx;
  return (
    <div
      style={{
        position: "relative",
        flex: 1,
        display: "flex",
        flexDirection: "column",
        gap: px(compact ? 1.6 : 2.4),
        padding: `${px(compact ? 2.6 : 4)} ${px(compact ? 2.6 : 4.5)} 0`,
        background: `linear-gradient(180deg, ${brand.primary}14, #ffffff 42%)`,
        overflow: "hidden",
      }}
    >
      <PhoneStatus ctx={ctx} ink="#0d2030" />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <BizRow ctx={ctx} tone="dark" />
        <span
          style={{
            fontSize: px(1.8),
            fontWeight: 600,
            color: INK.muted,
            fontFamily: fontSecondary(brand),
          }}
        >
          {content.date}
        </span>
      </div>
      <HeadlineTwoTone
        ctx={ctx}
        size={compact ? 5.2 : 6.4}
        color={INK.strong}
        accent={brand.primary}
      />
      <SearchField ctx={ctx} />
      <CategoryRow ctx={ctx} />
      <DealCard ctx={ctx} heading={content.location || content.subject || content.title} />
      {compact ? null : <DestinationCards ctx={ctx} />}
      <div
        style={{
          marginTop: "auto",
          marginLeft: `-${px(compact ? 2.6 : 4.5)}`,
          marginRight: `-${px(compact ? 2.6 : 4.5)}`,
        }}
      >
        <TabBar ctx={ctx} />
      </div>
    </div>
  );
}

/**
 * The offer block every design ends up needing: what it is, what it costs, what
 * is included and how to reach the business, in the order a reader scans them.
 *
 * The category designs differ in their staging - a boarding pass, a wave, a
 * stamp - not in how an offer reads, so the wording lives here once and each
 * engine spends its lines on the picture it is making.
 */
function OfferStack({
  ctx,
  tone,
  titleSize,
  align = "left",
  titleColor,
  kickerColor,
  chips = true,
  extra = true,
  contact = true,
  gap = 1.8,
}: {
  ctx: RenderCtx;
  tone: "light" | "dark";
  titleSize: number;
  align?: "left" | "center" | "right";
  titleColor?: string;
  kickerColor?: string;
  chips?: boolean;
  extra?: boolean;
  contact?: boolean;
  gap?: number;
}) {
  const { content } = ctx;
  const ink = titleColor ?? (tone === "light" ? "#ffffff" : "#181026");
  return (
    <AdjustBox
      ctx={ctx}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: px(gap),
        alignItems: align === "center" ? "center" : align === "right" ? "flex-end" : "flex-start",
        textAlign: align,
        width: "100%",
      }}
    >
      <Kicker
        ctx={ctx}
        color={kickerColor ?? (tone === "light" ? "rgba(255,255,255,0.9)" : accentColor(ctx))}
      />
      <Title ctx={ctx} size={titleSize} color={ink} />
      {extra ? <AdditionalText ctx={ctx} size={2.5} opacity={0.78} /> : null}
      {chips ? (
        <Chips items={[...metaItems(content, ctx.businessType), ...content.services]} tone={tone} />
      ) : (
        <ServiceLine ctx={ctx} tone={tone} />
      )}
      <div
        style={{
          display: "flex",
          gap: px(1.8),
          alignItems: "center",
          flexWrap: "wrap",
          justifyContent: align === "center" ? "center" : undefined,
        }}
      >
        <PriceBadge ctx={ctx} tone={tone} />
        <CtaTag ctx={ctx} tone={tone} />
      </div>
      {contact ? <ContactLine ctx={ctx} tone={tone} /> : null}
    </AdjustBox>
  );
}

type Engine = {
  id: string;
  label: string;
  tags: TemplateTag[];
  render: (ctx: RenderCtx) => React.ReactNode;
};

const base = (brand: BrandProfile): React.CSSProperties => ({
  position: "absolute",
  inset: 0,
  fontFamily: font(brand),
  overflow: "hidden",
});

const bgOr = (brand: BrandProfile, fallback: string) => brand.background || fallback;

const engines: Engine[] = [
  {
    id: "aurora",
    label: "Aurora",
    tags: ["image_first", "gradient", "bold"],
    render: (ctx) => {
      const { content, brand, variant } = ctx;
      const align = variant.align === "center" ? "center" : "flex-start";
      return (
        <div style={{ ...base(brand), color: INK.onDark }}>
          <Img src={content.imageDataUrl} video={content.videoDataUrl} />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `linear-gradient(to top, ${brand.primary}f2 4%, ${brand.primary}55 40%, transparent 68%)`,
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              padding: px(5),
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              alignItems: align,
              textAlign: variant.align,
            }}
          >
            <div style={{ display: "flex", width: "100%", alignItems: "center", gap: px(2.6) }}>
              <BizRow ctx={ctx} tone="light" />
            </div>
            <AdjustBox
              ctx={ctx}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: px(2.6),
                alignItems: align,
                width: "100%",
              }}
            >
              <Kicker ctx={ctx} color="rgba(255,255,255,0.92)" />
              <Title ctx={ctx} size={9.4} color={INK.onDark} />
              <AdditionalText ctx={ctx} size={2.9} opacity={0.9} />
              <Chips
                items={[...metaItems(content, ctx.businessType), ...content.services]}
                tone="light"
              />
              <div
                style={{ display: "flex", gap: px(1.8), alignItems: "center", flexWrap: "wrap" }}
              >
                <PriceBadge ctx={ctx} tone="light" />
                <CtaTag ctx={ctx} tone="light" />
              </div>
              <ContactLine ctx={ctx} tone="light" />
            </AdjustBox>
          </div>
        </div>
      );
    },
  },
  {
    id: "editorial",
    label: "Editorial",
    tags: ["editorial", "image_first", "light"],
    render: (ctx) => {
      const { content, brand, variant } = ctx;
      return (
        <div
          style={{
            ...base(brand),
            background: bgOr(brand, "#fff"),
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ position: "relative", flex: "0 1 58%", minHeight: 0 }}>
            <Img src={content.imageDataUrl} video={content.videoDataUrl} />
          </div>
          <AdjustBox
            ctx={ctx}
            style={{
              flex: 1,
              padding: px(5),
              display: "flex",
              flexDirection: "column",
              gap: px(1.8),
              color: INK.strong,
              textAlign: variant.align,
              alignItems: variant.align === "center" ? "center" : "flex-start",
            }}
          >
            <Kicker ctx={ctx} color={accentColor(ctx)} />
            <Title ctx={ctx} size={7.4} color={INK.strong} />
            <AdditionalText ctx={ctx} size={2.8} opacity={0.62} />
            <Chips
              items={[...metaItems(content, ctx.businessType), ...content.services]}
              tone="dark"
            />
            <div
              style={{
                marginTop: "auto",
                display: "flex",
                width: "100%",
                alignItems: "center",
                gap: px(2.6),
              }}
            >
              <BizRow ctx={ctx} tone="dark" />
              <span
                style={{ marginLeft: "auto", display: "flex", gap: px(1.8), alignItems: "center" }}
              >
                <CtaTag ctx={ctx} tone="dark" />
                <PriceBadge ctx={ctx} tone="dark" />
              </span>
            </div>
            <ContactLine ctx={ctx} tone="dark" />
          </AdjustBox>
        </div>
      );
    },
  },
  {
    id: "glass",
    label: "Glass Panel",
    tags: ["glass", "blur", "luxury"],
    render: (ctx) => {
      const { content, brand } = ctx;
      return (
        <div style={{ ...base(brand), background: brand.primary }}>
          <Img
            src={content.imageDataUrl}
            style={{ filter: "blur(3px) saturate(115%)", transform: "scale(1.1)" }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `linear-gradient(160deg, ${brand.primary}88, ${brand.secondary}99)`,
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              padding: px(5),
              display: "flex",
              flexDirection: "column",
              gap: px(3.6),
            }}
          >
            <BizRow ctx={ctx} tone="light" />
            <div
              style={{
                position: "relative",
                flex: 1,
                borderRadius: px(4),
                overflow: "hidden",
                boxShadow: "0 30px 60px -30px rgba(0,0,0,.5)",
              }}
            >
              <Img src={content.imageDataUrl} video={content.videoDataUrl} />
            </div>
            <AdjustBox
              ctx={ctx}
              style={{
                borderRadius: px(4),
                padding: px(5),
                background: "rgba(255,255,255,0.85)",
                border: "1px solid rgba(255,255,255,0.6)",
                backdropFilter: "blur(20px)",
                display: "flex",
                flexDirection: "column",
                gap: px(1.8),
                color: INK.strong,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: px(1.8) }}>
                <Kicker ctx={ctx} color={accentColor(ctx)} />
                <span style={{ marginLeft: "auto" }}>
                  <PriceBadge ctx={ctx} tone="dark" />
                </span>
              </div>
              <Title ctx={ctx} size={6.2} color={INK.strong} />
              <AdditionalText ctx={ctx} size={2.6} opacity={0.62} />
              <Chips
                items={[...metaItems(content, ctx.businessType), ...content.services]}
                tone="dark"
              />
            </AdjustBox>
          </div>
        </div>
      );
    },
  },
  {
    id: "split",
    label: "Split",
    tags: ["split", "gradient", "bold"],
    render: (ctx) => {
      const { content, brand } = ctx;
      return (
        <div style={{ ...base(brand), display: "flex" }}>
          <div
            style={{
              flex: "0 1 46%",
              minHeight: 0,
              padding: px(5),
              display: "flex",
              flexDirection: "column",
              gap: px(1.8),
              color: INK.onDark,
              background: `linear-gradient(170deg, ${brand.primary}, ${brand.secondary})`,
            }}
          >
            <BizRow ctx={ctx} tone="light" />
            <AdjustBox
              ctx={ctx}
              style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: px(1.8) }}
            >
              <Kicker ctx={ctx} color="rgba(255,255,255,0.85)" />
              <Title ctx={ctx} size={6.6} color={INK.onDark} />
              <AdditionalText ctx={ctx} size={2.5} opacity={0.85} />
              <PriceBadge ctx={ctx} tone="light" />
              <CtaTag ctx={ctx} tone="light" />
            </AdjustBox>
          </div>
          <div style={{ position: "relative", flex: 1 }}>
            <Img src={content.imageDataUrl} video={content.videoDataUrl} />
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "linear-gradient(to top, rgba(10,4,24,.55), transparent 55%)",
              }}
            />
            <div
              style={{
                position: "absolute",
                inset: 0,
                padding: px(3.6),
                display: "flex",
                alignItems: "flex-end",
              }}
            >
              <Chips
                items={[...metaItems(content, ctx.businessType), ...content.services]}
                tone="light"
              />
            </div>
          </div>
        </div>
      );
    },
  },
  {
    id: "frame",
    label: "Frame",
    tags: ["editorial", "centered", "light"],
    render: (ctx) => {
      const { content, brand } = ctx;
      return (
        <div
          style={{
            ...base(brand),
            background: bgOr(brand, "#faf8ff"),
            padding: px(5),
            display: "flex",
            flexDirection: "column",
            gap: px(2.6),
          }}
        >
          <div
            style={{
              position: "relative",
              flex: 1,
              borderRadius: px(4),
              overflow: "hidden",
              border: `${px(0.8)} solid ${brand.primary}`,
            }}
          >
            <Img src={content.imageDataUrl} video={content.videoDataUrl} />
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: `linear-gradient(to top, ${brand.primary}aa, transparent 60%)`,
              }}
            />
            <AdjustBox
              ctx={ctx}
              style={{
                position: "absolute",
                left: px(4),
                right: px(4),
                bottom: px(4),
                display: "flex",
                flexDirection: "column",
                gap: px(1.8),
              }}
            >
              <Kicker ctx={ctx} color="rgba(255,255,255,0.9)" />
              <Title ctx={ctx} size={7} color={INK.onDark} />
            </AdjustBox>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: px(2.6), color: INK.strong }}>
            <BizRow ctx={ctx} tone="dark" />
            <span style={{ marginLeft: "auto" }}>
              <PriceBadge ctx={ctx} tone="dark" />
            </span>
          </div>
          <Chips
            items={[...metaItems(content, ctx.businessType), ...content.services]}
            tone="dark"
          />
        </div>
      );
    },
  },
  {
    id: "duotone",
    label: "Duotone",
    tags: ["gradient", "bold", "dark"],
    render: (ctx) => {
      const { content, brand, variant } = ctx;
      return (
        <div style={{ ...base(brand), background: brand.primary, color: INK.onDark }}>
          <Img
            src={content.imageDataUrl}
            video={content.videoDataUrl}
            style={{ mixBlendMode: "luminosity", opacity: 0.9 }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `linear-gradient(210deg, ${brand.secondary}66, ${brand.primary}dd)`,
            }}
          />
          <AdjustBox
            ctx={ctx}
            style={{
              position: "absolute",
              inset: 0,
              padding: px(5),
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              gap: px(2.6),
              textAlign: variant.align,
              alignItems: variant.align === "center" ? "center" : "flex-start",
            }}
          >
            <Kicker ctx={ctx} color="rgba(255,255,255,0.8)" />
            <Title ctx={ctx} size={10.5} color={INK.onDark} />
            <AdditionalText ctx={ctx} size={2.9} opacity={0.86} />
            <Chips
              items={[...metaItems(content, ctx.businessType), ...content.services]}
              tone="light"
            />
            <PriceBadge ctx={ctx} tone="light" />
          </AdjustBox>
          <div style={{ position: "absolute", left: px(6), bottom: px(6) }}>
            <BizRow ctx={ctx} tone="light" />
          </div>
        </div>
      );
    },
  },
  {
    id: "ticket",
    label: "Ticket",
    tags: ["dense", "offer", "light"],
    render: (ctx) => {
      const { content, brand } = ctx;
      return (
        <div
          style={{
            ...base(brand),
            background: bgOr(brand, "#fff"),
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ position: "relative", flex: "0 1 52%", minHeight: 0 }}>
            <Img src={content.imageDataUrl} video={content.videoDataUrl} />
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: `linear-gradient(to top, ${brand.primary}55, transparent 55%)`,
              }}
            />
            <div style={{ position: "absolute", left: px(4.5), top: px(4.5) }}>
              <BizRow ctx={ctx} tone="light" />
            </div>
          </div>
          <div style={{ height: 0, borderTop: `${px(0.4)} dashed ${brand.primary}55` }} />
          <AdjustBox
            ctx={ctx}
            style={{
              flex: 1,
              padding: px(5),
              display: "flex",
              flexDirection: "column",
              gap: px(1.8),
              color: INK.strong,
            }}
          >
            <Kicker ctx={ctx} color={accentColor(ctx)} />
            <Title ctx={ctx} size={6.8} color={INK.strong} />
            <Chips
              items={[...metaItems(content, ctx.businessType), ...content.services]}
              tone="dark"
            />
            <div style={{ marginTop: "auto", display: "flex", alignItems: "flex-end" }}>
              <AdditionalText ctx={ctx} size={2.5} opacity={0.6} style={{ maxWidth: "62%" }} />
              <span style={{ marginLeft: "auto" }}>
                <PriceBadge ctx={ctx} tone="dark" />
              </span>
            </div>
          </AdjustBox>
        </div>
      );
    },
  },
  {
    id: "minimal",
    label: "Minimal",
    tags: ["minimal", "whitespace", "light"],
    render: (ctx) => {
      const { content, brand } = ctx;
      return (
        <div
          style={{
            ...base(brand),
            background: bgOr(brand, "#fff"),
            padding: px(7),
            display: "flex",
            flexDirection: "column",
            gap: px(3.6),
          }}
        >
          <BizRow ctx={ctx} tone="dark" />
          <div
            style={{
              position: "relative",
              flex: "0 1 44%",
              minHeight: 0,
              borderRadius: px(2.4),
              overflow: "hidden",
            }}
          >
            <Img src={content.imageDataUrl} video={content.videoDataUrl} />
          </div>
          <AdjustBox
            ctx={ctx}
            style={{ display: "flex", flexDirection: "column", gap: px(1.8), color: INK.strong }}
          >
            <Kicker ctx={ctx} color={accentColor(ctx)} />
            <Title ctx={ctx} size={7.2} color={INK.strong} />
            <AdditionalText ctx={ctx} size={2.7} opacity={0.55} />
          </AdjustBox>
          <div style={{ marginTop: "auto", display: "flex", alignItems: "center", gap: px(1.8) }}>
            <Chips
              items={[...metaItems(content, ctx.businessType), ...content.services]}
              tone="dark"
            />
            <span style={{ marginLeft: "auto" }}>
              <PriceBadge ctx={ctx} tone="dark" />
            </span>
          </div>
          <ContactLine ctx={ctx} tone="dark" />
        </div>
      );
    },
  },
  {
    id: "poster",
    label: "Poster",
    tags: ["bold", "type_first", "dark"],
    render: (ctx) => {
      const { content, brand } = ctx;
      return (
        <div style={{ ...base(brand), color: INK.onDark }}>
          <Img src={content.imageDataUrl} video={content.videoDataUrl} />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `linear-gradient(to bottom, ${brand.primary}e6 0%, ${brand.primary}33 45%, rgba(8,4,20,.6) 100%)`,
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              padding: px(5),
              display: "flex",
              flexDirection: "column",
            }}
          >
            <AdjustBox ctx={ctx} style={{ display: "flex", flexDirection: "column", gap: px(1.8) }}>
              <Kicker ctx={ctx} color="rgba(255,255,255,0.88)" />
              <Title ctx={ctx} size={10} color={INK.onDark} />
              <AdditionalText ctx={ctx} size={2.9} opacity={0.9} />
            </AdjustBox>
            <div
              style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: px(2.6) }}
            >
              <Chips
                items={[...metaItems(content, ctx.businessType), ...content.services]}
                tone="light"
              />
              <div style={{ display: "flex", alignItems: "center", gap: px(2.6) }}>
                <BizRow ctx={ctx} tone="light" />
                <span style={{ marginLeft: "auto" }}>
                  <PriceBadge ctx={ctx} tone="light" />
                </span>
              </div>
              <ContactLine ctx={ctx} tone="light" />
            </div>
          </div>
        </div>
      );
    },
  },
  {
    id: "banner",
    label: "Banner",
    tags: ["split", "gradient", "dark"],
    render: (ctx) => {
      const { content, brand } = ctx;
      return (
        <div
          style={{
            ...base(brand),
            display: "flex",
            flexDirection: "column",
            background: "#0e0820",
          }}
        >
          <div
            style={{
              flex: "0 1 42%",
              minHeight: 0,
              padding: px(5),
              display: "flex",
              flexDirection: "column",
              gap: px(1.8),
              color: INK.onDark,
              background: `linear-gradient(120deg, ${brand.primary}, ${brand.secondary})`,
            }}
          >
            <BizRow ctx={ctx} tone="light" />
            <AdjustBox ctx={ctx} style={{ display: "flex", flexDirection: "column", gap: px(1.8) }}>
              <Title ctx={ctx} size={7.4} color={INK.onDark} />
              <Kicker ctx={ctx} color="rgba(255,255,255,0.82)" />
            </AdjustBox>
          </div>
          <div style={{ position: "relative", flex: 1 }}>
            <Img src={content.imageDataUrl} video={content.videoDataUrl} />
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "linear-gradient(to top, rgba(8,4,20,.7), transparent 60%)",
              }}
            />
            <div
              style={{
                position: "absolute",
                inset: 0,
                padding: px(5),
                display: "flex",
                flexDirection: "column",
                justifyContent: "flex-end",
                gap: px(1.8),
              }}
            >
              <Chips
                items={[...metaItems(content, ctx.businessType), ...content.services]}
                tone="light"
              />
              <div style={{ display: "flex", alignItems: "center" }}>
                <AdditionalText
                  ctx={ctx}
                  size={2.5}
                  opacity={0.85}
                  style={{ maxWidth: "60%", color: INK.onDark }}
                />
                <span style={{ marginLeft: "auto" }}>
                  <PriceBadge ctx={ctx} tone="light" />
                </span>
              </div>
            </div>
          </div>
        </div>
      );
    },
  },
  {
    id: "spotlight",
    label: "Spotlight",
    tags: ["centered", "whitespace", "light"],
    render: (ctx) => {
      const { content, brand } = ctx;
      return (
        <div
          style={{
            ...base(brand),
            background: bgOr(
              brand,
              `radial-gradient(120% 80% at 50% 0%, ${brand.secondary}33, #ffffff 62%)`,
            ),
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              padding: px(5),
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              textAlign: "center",
              gap: px(2.6),
            }}
          >
            <BizRow ctx={ctx} tone="dark" />
            <div
              style={{
                position: "relative",
                width: "78%",
                aspectRatio: "1 / 1",
                borderRadius: "50%",
                overflow: "hidden",
                boxShadow: `0 ${px(3.6)} ${px(12)} -${px(3.6)} ${brand.primary}66`,
                border: `${px(0.8)} solid #fff`,
              }}
            >
              <Img src={content.imageDataUrl} video={content.videoDataUrl} />
            </div>
            <AdjustBox
              ctx={ctx}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: px(2.6),
              }}
            >
              <Kicker ctx={ctx} color={accentColor(ctx)} />
              <Title ctx={ctx} size={7} color={INK.strong} />
              <Chips
                items={[...metaItems(content, ctx.businessType), ...content.services]}
                tone="dark"
              />
            </AdjustBox>
            <div style={{ marginTop: "auto" }}>
              <PriceBadge ctx={ctx} tone="dark" />
            </div>
          </div>
        </div>
      );
    },
  },
  {
    id: "stack",
    label: "Stack",
    tags: ["dense", "editorial", "light"],
    render: (ctx) => {
      const { content, brand } = ctx;
      return (
        <div
          style={{
            ...base(brand),
            display: "flex",
            flexDirection: "column",
            background: bgOr(brand, "#fff"),
          }}
        >
          <AdjustBox
            ctx={ctx}
            style={{
              padding: px(5),
              display: "flex",
              flexDirection: "column",
              gap: px(1.8),
              color: INK.strong,
            }}
          >
            <Kicker ctx={ctx} color={accentColor(ctx)} />
            <Title ctx={ctx} size={6.6} color={INK.strong} />
          </AdjustBox>
          <div
            style={{
              position: "relative",
              flex: 1,
              margin: `0 ${px(5.5)}`,
              borderRadius: px(4),
              overflow: "hidden",
            }}
          >
            <Img src={content.imageDataUrl} video={content.videoDataUrl} />
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: `linear-gradient(to top, ${brand.primary}66, transparent 55%)`,
              }}
            />
            <div style={{ position: "absolute", right: px(3.4), top: px(3.4) }}>
              <PriceBadge ctx={ctx} tone="light" />
            </div>
          </div>
          <div style={{ padding: px(5), display: "flex", flexDirection: "column", gap: px(1.8) }}>
            <Chips
              items={[...metaItems(content, ctx.businessType), ...content.services]}
              tone="dark"
            />
            <div style={{ display: "flex", alignItems: "center", gap: px(2.6) }}>
              <BizRow ctx={ctx} tone="dark" />
              <AdditionalText
                ctx={ctx}
                size={2.4}
                opacity={0.55}
                style={{ maxWidth: "55%", textAlign: "right", marginLeft: "auto" }}
              />
            </div>
          </div>
        </div>
      );
    },
  },
  {
    id: "darkluxury",
    label: "Dark Luxury",
    tags: ["luxury", "dark", "centered"],
    render: (ctx) => {
      const { content, brand, variant } = ctx;
      return (
        <div style={{ ...base(brand), background: "#0b0810" }}>
          <Img src={content.imageDataUrl} video={content.videoDataUrl} style={{ opacity: 0.55 }} />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(to top, #0b0810 20%, rgba(11,8,16,.35) 60%, rgba(11,8,16,.75))",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              padding: px(7),
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              alignItems: variant.align === "center" ? "center" : "flex-start",
              textAlign: variant.align,
            }}
          >
            <BizRow ctx={ctx} tone="light" />
            <AdjustBox ctx={ctx} style={{ display: "flex", flexDirection: "column", gap: px(2.6) }}>
              <Kicker ctx={ctx} color={brand.accent} />
              <Title ctx={ctx} size={8.4} color="#f6f1ff" />
              <AdditionalText ctx={ctx} size={2.6} opacity={0.7} />
              <ServiceLine ctx={ctx} tone="light" />
              <PriceBadge ctx={ctx} tone="light" />
            </AdjustBox>
          </div>
        </div>
      );
    },
  },
  {
    id: "lightluxury",
    label: "Light Luxury",
    tags: ["luxury", "light", "whitespace"],
    render: (ctx) => {
      const { content, brand } = ctx;
      return (
        <div
          style={{
            ...base(brand),
            background: bgOr(brand, "#faf7f2"),
            display: "flex",
            flexDirection: "column",
            padding: px(7),
            gap: px(3.6),
          }}
        >
          <BizRow ctx={ctx} tone="dark" />
          <div style={{ position: "relative", flex: 1, borderRadius: px(2.4), overflow: "hidden" }}>
            <Img src={content.imageDataUrl} video={content.videoDataUrl} />
          </div>
          <AdjustBox
            ctx={ctx}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              textAlign: "center",
              gap: px(1.8),
            }}
          >
            <Kicker ctx={ctx} color={accentColor(ctx)} />
            <Title ctx={ctx} size={6.4} color={INK.strong} />
            <ServiceLine ctx={ctx} tone="dark" />
            <PriceBadge ctx={ctx} tone="dark" />
          </AdjustBox>
        </div>
      );
    },
  },
  {
    id: "typeblast",
    label: "Type Blast",
    tags: ["type_first", "bold", "dark"],
    render: (ctx) => {
      const { content, brand, variant } = ctx;
      // Type first, but never blind to an upload: with no picture the wash is the
      // design, with one it becomes a scrim so the shot still reads underneath.
      const hasMedia = !!(content.videoDataUrl || content.imageDataUrl);
      return (
        <div
          style={{
            ...base(brand),
            background: `linear-gradient(155deg, ${brand.primary}, #0c0716)`,
            color: INK.onDark,
          }}
        >
          {hasMedia ? (
            <>
              <Img src={content.imageDataUrl} video={content.videoDataUrl} />
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: `linear-gradient(155deg, ${brand.primary}b3, #0c0716e0)`,
                }}
              />
            </>
          ) : null}
          <div
            style={{
              position: "absolute",
              inset: 0,
              padding: px(7),
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              gap: px(2.6),
              textAlign: variant.align,
              alignItems: variant.align === "center" ? "center" : "flex-start",
            }}
          >
            <BizRow ctx={ctx} tone="light" />
            <AdjustBox ctx={ctx} style={{ display: "flex", flexDirection: "column", gap: px(2.6) }}>
              <Kicker ctx={ctx} color={brand.accent} />
              <Title ctx={ctx} size={13} color={INK.onDark} />
              <Chips
                items={[...metaItems(content, ctx.businessType), ...content.services]}
                tone="light"
              />
              <div style={{ display: "flex", gap: px(1.8) }}>
                <PriceBadge ctx={ctx} tone="light" />
                <CtaTag ctx={ctx} tone="light" />
              </div>
            </AdjustBox>
          </div>
        </div>
      );
    },
  },
  {
    id: "whitespacepanel",
    label: "Whitespace Panel",
    tags: ["whitespace", "minimal", "asymmetric"],
    render: (ctx) => {
      const { content, brand } = ctx;
      return (
        <div style={{ ...base(brand), background: bgOr(brand, "#ffffff"), display: "flex" }}>
          <div
            style={{
              flex: "0 1 62%",
              minHeight: 0,
              padding: px(7),
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              gap: px(2.6),
            }}
          >
            <BizRow ctx={ctx} tone="dark" />
            <AdjustBox ctx={ctx} style={{ display: "flex", flexDirection: "column", gap: px(2.6) }}>
              <Kicker ctx={ctx} color={accentColor(ctx)} />
              <Title ctx={ctx} size={7.6} color={INK.strong} />
              <AdditionalText ctx={ctx} size={2.6} opacity={0.6} />
              <ServiceLine ctx={ctx} tone="dark" />
              <PriceBadge ctx={ctx} tone="dark" />
              <ContactLine ctx={ctx} tone="dark" />
            </AdjustBox>
          </div>
          <div style={{ position: "relative", flex: "0 1 38%", minHeight: 0 }}>
            <Img src={content.imageDataUrl} video={content.videoDataUrl} />
          </div>
        </div>
      );
    },
  },
  {
    id: "densegrid",
    label: "Dense Grid",
    tags: ["dense", "offer", "light"],
    render: (ctx) => {
      const { content, brand } = ctx;
      return (
        <div
          style={{
            ...base(brand),
            background: bgOr(brand, "#fff"),
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ position: "relative", flex: "0 1 40%", minHeight: 0 }}>
            <Img src={content.imageDataUrl} video={content.videoDataUrl} />
          </div>
          <AdjustBox
            ctx={ctx}
            style={{
              flex: 1,
              padding: px(5),
              display: "flex",
              flexDirection: "column",
              gap: px(1.8),
              color: INK.strong,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: px(1.8) }}>
              <Kicker ctx={ctx} color={accentColor(ctx)} />
              <span style={{ marginLeft: "auto" }}>
                <PriceBadge ctx={ctx} tone="dark" />
              </span>
            </div>
            <Title ctx={ctx} size={6} color={INK.strong} />
            <Chips
              items={[...metaItems(content, ctx.businessType), ...content.services]}
              tone="dark"
            />
            <AdditionalText ctx={ctx} size={2.4} opacity={0.6} />
            <div
              style={{
                marginTop: "auto",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <BizRow ctx={ctx} tone="dark" />
              <CtaTag ctx={ctx} tone="dark" />
            </div>
          </AdjustBox>
        </div>
      );
    },
  },
  {
    id: "asymmetricoffer",
    label: "Asymmetric Offer",
    tags: ["asymmetric", "offer", "bold"],
    render: (ctx) => {
      const { content, brand } = ctx;
      return (
        <div style={{ ...base(brand), background: "#100a1c" }}>
          <div
            style={{
              position: "absolute",
              inset: 0,
              clipPath: "polygon(0 0, 62% 0, 46% 100%, 0 100%)",
            }}
          >
            <Img src={content.imageDataUrl} video={content.videoDataUrl} />
          </div>
          <div
            style={{
              position: "absolute",
              inset: 0,
              padding: px(5),
              display: "flex",
              justifyContent: "flex-end",
            }}
          >
            <AdjustBox
              ctx={ctx}
              style={{
                width: "56%",
                display: "flex",
                flexDirection: "column",
                gap: px(2.6),
                color: INK.onDark,
                justifyContent: "center",
              }}
            >
              <BizRow ctx={ctx} tone="light" />
              <Kicker ctx={ctx} color={brand.accent} />
              <Title ctx={ctx} size={7.6} color={INK.onDark} />
              <ServiceLine ctx={ctx} tone="light" />
              <PriceBadge ctx={ctx} tone="light" />
              <CtaTag ctx={ctx} tone="light" />
            </AdjustBox>
          </div>
        </div>
      );
    },
  },
  {
    id: "fullbleed",
    label: "Full Bleed",
    tags: ["image_first", "gradient", "bold"],
    render: (ctx) => {
      const { content, brand, variant } = ctx;
      const align = variant.align === "center" ? "center" : "flex-start";
      return (
        <div style={{ ...base(brand), color: INK.onDark }}>
          <Img src={content.imageDataUrl} video={content.videoDataUrl} />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `linear-gradient(to top, rgba(6,3,14,.92) 6%, rgba(6,3,14,.5) 34%, transparent 62%)`,
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              padding: px(5),
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <BizRow ctx={ctx} tone="light" />
            <AdjustBox
              ctx={ctx}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: px(2.6),
                alignItems: align,
                textAlign: variant.align,
                width: "100%",
              }}
            >
              <Kicker ctx={ctx} color={brand.accent} />
              <Title ctx={ctx} size={9.8} color={INK.onDark} />
              <AdditionalText ctx={ctx} size={2.8} opacity={0.88} />
              <Chips
                items={[...metaItems(content, ctx.businessType), ...content.services]}
                tone="light"
              />
              <div style={{ display: "flex", gap: px(1.8), alignItems: "center" }}>
                <PriceBadge ctx={ctx} tone="light" />
                <CtaTag ctx={ctx} tone="light" />
              </div>
              <ContactLine ctx={ctx} tone="light" />
            </AdjustBox>
          </div>
        </div>
      );
    },
  },
  {
    id: "blurbackdrop",
    label: "Blur Backdrop",
    tags: ["image_first", "blur", "gradient"],
    render: (ctx) => {
      const { content, brand } = ctx;
      return (
        <div style={{ ...base(brand), background: "#0c0916" }}>
          <Img
            src={content.imageDataUrl}
            style={{ filter: "blur(18px) saturate(120%) brightness(.6)", transform: "scale(1.25)" }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              padding: px(5),
              display: "flex",
              flexDirection: "column",
              gap: px(2.6),
            }}
          >
            <BizRow ctx={ctx} tone="light" />
            <div
              style={{
                position: "relative",
                flex: 1,
                borderRadius: px(2.4),
                overflow: "hidden",
                boxShadow: "0 40px 70px -30px rgba(0,0,0,.65)",
              }}
            >
              <Img src={content.imageDataUrl} video={content.videoDataUrl} />
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "linear-gradient(to top, rgba(6,3,14,.85), transparent 45%)",
                }}
              />
              <AdjustBox
                ctx={ctx}
                style={{
                  position: "absolute",
                  left: px(4),
                  right: px(4),
                  bottom: px(4),
                  display: "flex",
                  flexDirection: "column",
                  gap: px(1.8),
                }}
              >
                <Kicker ctx={ctx} color="rgba(255,255,255,0.88)" />
                <Title ctx={ctx} size={7.4} color={INK.onDark} />
                <Chips
                  items={[...metaItems(content, ctx.businessType), ...content.services]}
                  tone="light"
                />
                <div style={{ display: "flex", gap: px(1.8), alignItems: "center" }}>
                  <PriceBadge ctx={ctx} tone="light" />
                  <CtaTag ctx={ctx} tone="light" />
                </div>
              </AdjustBox>
            </div>
          </div>
        </div>
      );
    },
  },
  {
    id: "diagonalslash",
    label: "Diagonal Slash",
    tags: ["asymmetric", "image_first", "bold"],
    render: (ctx) => {
      const { content, brand } = ctx;
      return (
        <div style={{ ...base(brand), background: "#0e0a1a" }}>
          <Img src={content.imageDataUrl} video={content.videoDataUrl} />
          <div
            style={{
              position: "absolute",
              inset: 0,
              clipPath: "polygon(0 0, 100% 0, 100% 38%, 0 68%)",
              background: `linear-gradient(120deg, ${brand.primary}f0, ${brand.secondary}e6)`,
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              padding: px(5),
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <AdjustBox
              ctx={ctx}
              style={{ display: "flex", flexDirection: "column", gap: px(1.8), color: INK.onDark }}
            >
              <BizRow ctx={ctx} tone="light" />
              <Kicker ctx={ctx} color="rgba(255,255,255,0.85)" />
              <Title ctx={ctx} size={8.4} color={INK.onDark} />
            </AdjustBox>
            <div
              style={{ display: "flex", flexDirection: "column", gap: px(1.8), color: INK.onDark }}
            >
              <Chips
                items={[...metaItems(content, ctx.businessType), ...content.services]}
                tone="light"
              />
              <div style={{ display: "flex", gap: px(1.8), alignItems: "center" }}>
                <PriceBadge ctx={ctx} tone="light" />
                <CtaTag ctx={ctx} tone="light" />
              </div>
            </div>
          </div>
        </div>
      );
    },
  },
  {
    id: "serifcolumn",
    label: "Serif Column",
    tags: ["editorial", "image_first", "light"],
    render: (ctx) => {
      const { content, brand } = ctx;
      return (
        <div
          style={{
            ...base(brand),
            background: bgOr(brand, "#fff"),
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ position: "relative", flex: "0 1 62%", minHeight: 0 }}>
            <Img src={content.imageDataUrl} video={content.videoDataUrl} />
          </div>
          <AdjustBox
            ctx={ctx}
            style={{
              flex: 1,
              padding: px(5),
              display: "flex",
              gap: px(3.6),
              color: INK.strong,
            }}
          >
            <div style={{ width: px(0.4), background: accentColor(ctx), alignSelf: "stretch" }} />
            <div style={{ display: "flex", flexDirection: "column", gap: px(1.8), flex: 1 }}>
              <Kicker ctx={ctx} color={accentColor(ctx)} />
              <Title ctx={ctx} size={6.8} color={INK.strong} />
              <AdditionalText ctx={ctx} size={2.6} opacity={0.6} />
              <ServiceLine ctx={ctx} tone="dark" />
              <div
                style={{ marginTop: "auto", display: "flex", alignItems: "center", gap: px(1.8) }}
              >
                <BizRow ctx={ctx} tone="dark" />
                <span style={{ marginLeft: "auto" }}>
                  <PriceBadge ctx={ctx} tone="dark" />
                </span>
              </div>
              <ContactLine ctx={ctx} tone="dark" />
            </div>
          </AdjustBox>
        </div>
      );
    },
  },
  {
    id: "letterbox",
    label: "Letterbox",
    tags: ["dark", "image_first", "bold"],
    render: (ctx) => {
      const { content, brand, variant } = ctx;
      return (
        <div style={{ ...base(brand), background: "#000" }}>
          <Img
            src={content.imageDataUrl}
            video={content.videoDataUrl}
            style={{ top: "12%", height: "76%" }}
          />
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: 0,
              height: "12%",
              background: "#000",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              height: "12%",
              background: "#000",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(to top, rgba(0,0,0,.55), transparent 40%, transparent 60%, rgba(0,0,0,.35))",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              padding: px(5),
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: variant.align === "center" ? "center" : "flex-start",
              textAlign: variant.align,
            }}
          >
            <AdjustBox
              ctx={ctx}
              style={{ display: "flex", flexDirection: "column", gap: px(1.8), color: INK.onDark }}
            >
              <Kicker ctx={ctx} color="rgba(255,255,255,0.85)" />
              <Title ctx={ctx} size={8.6} color={INK.onDark} />
              <ServiceLine ctx={ctx} tone="light" />
              <div style={{ display: "flex", gap: px(1.8), alignItems: "center" }}>
                <PriceBadge ctx={ctx} tone="light" />
                <CtaTag ctx={ctx} tone="light" />
              </div>
            </AdjustBox>
          </div>
          <div style={{ position: "absolute", left: px(6), bottom: px(3) }}>
            <BizRow ctx={ctx} tone="light" />
          </div>
        </div>
      );
    },
  },
  {
    id: "colorwash",
    label: "Color Wash",
    tags: ["gradient", "image_first", "dark"],
    render: (ctx) => {
      const { content, brand } = ctx;
      return (
        <div style={{ ...base(brand), color: INK.onDark }}>
          <Img src={content.imageDataUrl} video={content.videoDataUrl} />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `linear-gradient(25deg, ${brand.primary}f2 32%, ${brand.primary}55 55%, transparent 78%)`,
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              padding: px(5),
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <BizRow ctx={ctx} tone="light" />
            <AdjustBox
              ctx={ctx}
              style={{ display: "flex", flexDirection: "column", gap: px(2.6), width: "58%" }}
            >
              <Kicker ctx={ctx} color="rgba(255,255,255,0.88)" />
              <Title ctx={ctx} size={8} color={INK.onDark} />
              <AdditionalText ctx={ctx} size={2.7} opacity={0.85} />
              <Chips
                items={[...metaItems(content, ctx.businessType), ...content.services]}
                tone="light"
              />
              <PriceBadge ctx={ctx} tone="light" />
            </AdjustBox>
          </div>
        </div>
      );
    },
  },
  {
    id: "thinframe",
    label: "Thin Frame",
    tags: ["minimal", "image_first", "light"],
    render: (ctx) => {
      const { content, brand } = ctx;
      return (
        <div style={{ ...base(brand), background: "#0a0714" }}>
          <Img src={content.imageDataUrl} video={content.videoDataUrl} />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(to top, rgba(6,3,14,.82), transparent 50%)",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: px(3.4),
              border: "1px solid rgba(255,255,255,0.55)",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              padding: px(5),
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <BizRow ctx={ctx} tone="light" />
            <AdjustBox
              ctx={ctx}
              style={{ display: "flex", flexDirection: "column", gap: px(1.8), color: INK.onDark }}
            >
              <Kicker ctx={ctx} color={brand.accent} />
              <Title ctx={ctx} size={7.6} color={INK.onDark} />
              <Chips
                items={[...metaItems(content, ctx.businessType), ...content.services]}
                tone="light"
              />
              <div style={{ display: "flex", gap: px(1.8), alignItems: "center" }}>
                <PriceBadge ctx={ctx} tone="light" />
                <CtaTag ctx={ctx} tone="light" />
              </div>
            </AdjustBox>
          </div>
        </div>
      );
    },
  },
  {
    id: "offerblock",
    label: "Offer Block",
    tags: ["dense", "offer", "bold"],
    render: (ctx) => {
      const { content, brand } = ctx;
      return (
        <div style={{ ...base(brand), display: "flex" }}>
          <div style={{ position: "relative", flex: "0 1 50%", minHeight: 0 }}>
            <Img src={content.imageDataUrl} video={content.videoDataUrl} />
          </div>
          <AdjustBox
            ctx={ctx}
            style={{
              flex: "0 1 50%",
              minHeight: 0,
              padding: px(5),
              display: "flex",
              flexDirection: "column",
              gap: px(1.8),
              color: INK.onDark,
              background: `linear-gradient(165deg, ${brand.primary}, ${brand.secondary})`,
            }}
          >
            <BizRow ctx={ctx} tone="light" />
            <Kicker ctx={ctx} color="rgba(255,255,255,0.85)" />
            <Title ctx={ctx} size={5.8} color={INK.onDark} />
            <AdditionalText ctx={ctx} size={2.3} opacity={0.85} />
            <Chips
              items={[...metaItems(content, ctx.businessType), ...content.services]}
              tone="light"
            />
            <div
              style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: px(1.2) }}
            >
              <PriceBadge ctx={ctx} tone="light" />
              <CtaTag ctx={ctx} tone="light" />
              <ContactLine ctx={ctx} tone="light" />
            </div>
          </AdjustBox>
        </div>
      );
    },
  },
  {
    id: "glassstrip",
    label: "Glass Strip",
    tags: ["glass", "blur", "image_first"],
    render: (ctx) => {
      const { content, brand } = ctx;
      return (
        <div style={{ ...base(brand) }}>
          <Img src={content.imageDataUrl} video={content.videoDataUrl} />
          <div style={{ position: "absolute", left: 0, right: 0, top: 0, padding: px(5) }}>
            <BizRow ctx={ctx} tone="light" />
          </div>
          <AdjustBox
            ctx={ctx}
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              padding: px(5),
              display: "flex",
              flexDirection: "column",
              gap: px(1.8),
              background: "rgba(12,8,22,0.42)",
              backdropFilter: "blur(18px)",
              borderTop: "1px solid rgba(255,255,255,0.25)",
              color: INK.onDark,
            }}
          >
            <Kicker ctx={ctx} color="rgba(255,255,255,0.85)" />
            <Title ctx={ctx} size={6.6} color={INK.onDark} />
            <Chips
              items={[...metaItems(content, ctx.businessType), ...content.services]}
              tone="light"
            />
            <div style={{ display: "flex", gap: px(1.8), alignItems: "center" }}>
              <PriceBadge ctx={ctx} tone="light" />
              <CtaTag ctx={ctx} tone="light" />
            </div>
          </AdjustBox>
        </div>
      );
    },
  },
  {
    id: "quietwhite",
    label: "Quiet White",
    tags: ["whitespace", "light", "image_first"],
    render: (ctx) => {
      const { content, brand } = ctx;
      return (
        <div
          style={{
            ...base(brand),
            background: bgOr(brand, "#ffffff"),
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ position: "relative", flex: "0 1 58%", minHeight: 0 }}>
            <Img src={content.imageDataUrl} video={content.videoDataUrl} />
          </div>
          <AdjustBox
            ctx={ctx}
            style={{
              flex: 1,
              padding: px(5),
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              textAlign: "center",
              justifyContent: "center",
              gap: px(1.8),
              color: INK.strong,
            }}
          >
            <Kicker ctx={ctx} color={accentColor(ctx)} />
            <Title ctx={ctx} size={6.2} color={INK.strong} />
            <ServiceLine ctx={ctx} tone="dark" />
            <PriceBadge ctx={ctx} tone="dark" />
          </AdjustBox>
        </div>
      );
    },
  },
  {
    id: "duskframe",
    label: "Dusk Frame",
    tags: ["luxury", "dark", "centered"],
    render: (ctx) => {
      const { content, brand } = ctx;
      return (
        <div style={{ ...base(brand), background: "#0a0712" }}>
          <PhotoLayer ctx={ctx} treatment="duotone" strength={0.86} grain />
          <div
            style={{ position: "absolute", inset: px(4.2), border: `1px solid ${brand.accent}88` }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              padding: px(7),
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              textAlign: "center",
              justifyContent: "space-between",
            }}
          >
            <BizRow ctx={ctx} tone="light" />
            <AdjustBox
              ctx={ctx}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: px(2.6),
              }}
            >
              <Kicker ctx={ctx} color={brand.accent} />
              <Title ctx={ctx} size={7.6} color="#f7f2ff" />
              <AdditionalText ctx={ctx} size={2.5} opacity={0.7} />
              <ServiceLine ctx={ctx} tone="light" />
              <PriceBadge ctx={ctx} tone="light" />
            </AdjustBox>
            <div style={{ height: px(1) }} />
          </div>
        </div>
      );
    },
  },
  {
    id: "typeoffer",
    label: "Type Offer",
    tags: ["type_first", "bold", "offer"],
    render: (ctx) => {
      const { content, brand } = ctx;
      return (
        <div style={{ ...base(brand), color: INK.onDark }}>
          <Img src={content.imageDataUrl} video={content.videoDataUrl} />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(to top, rgba(5,2,12,.92) 10%, rgba(5,2,12,.25) 55%, transparent 75%)",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              padding: px(5),
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <BizRow ctx={ctx} tone="light" />
              <CtaTag ctx={ctx} tone="light" />
            </div>
            <AdjustBox ctx={ctx} style={{ display: "flex", flexDirection: "column", gap: px(1.8) }}>
              <Kicker ctx={ctx} color={brand.accent} />
              <Title ctx={ctx} size={13.5} color={INK.onDark} />
              <ServiceLine ctx={ctx} tone="light" />
              <PriceBadge ctx={ctx} tone="light" />
            </AdjustBox>
          </div>
        </div>
      );
    },
  },
  {
    id: "splitstack",
    label: "Split Stack",
    tags: ["split", "image_first", "bold"],
    render: (ctx) => {
      const { content, brand } = ctx;
      return (
        <div style={{ ...base(brand), display: "flex", flexDirection: "column" }}>
          <div style={{ position: "relative", flex: "0 1 72%", minHeight: 0 }}>
            <Img src={content.imageDataUrl} video={content.videoDataUrl} />
            <div style={{ position: "absolute", left: px(4), top: px(4) }}>
              <BizRow ctx={ctx} tone="light" />
            </div>
          </div>
          <AdjustBox
            ctx={ctx}
            style={{
              flex: 1,
              padding: `${px(3.6)} ${px(5)}`,
              display: "flex",
              alignItems: "center",
              gap: px(2.6),
              color: INK.onDark,
              background: `linear-gradient(120deg, ${brand.primary}, ${brand.secondary})`,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: px(0.8), flex: 1 }}>
              <Kicker ctx={ctx} color="rgba(255,255,255,0.85)" />
              <Title ctx={ctx} size={5.2} color={INK.onDark} />
              <ServiceLine ctx={ctx} tone="light" />
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: px(0.8),
                alignItems: "flex-end",
              }}
            >
              <PriceBadge ctx={ctx} tone="light" />
              <CtaTag ctx={ctx} tone="light" />
            </div>
          </AdjustBox>
        </div>
      );
    },
  },
  /* ---- content forward engines: the picture stays the hero ---- */
  {
    id: "clearcenter",
    label: "Clear Center",
    tags: ["image_first", "minimal"],
    render: (ctx) => {
      const { content, brand } = ctx;
      return (
        <div style={{ ...base(brand), color: INK.onDark }}>
          <Img src={content.imageDataUrl} video={content.videoDataUrl} />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "radial-gradient(120% 80% at 50% 50%, rgba(0,0,0,0.34) 0%, rgba(0,0,0,0) 62%)",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              padding: px(5),
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "space-between",
              textAlign: "center",
            }}
          >
            <Logo ctx={ctx} />
            <AdjustBox
              ctx={ctx}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: px(2.6),
                width: "100%",
              }}
            >
              <Kicker ctx={ctx} color="rgba(255,255,255,0.9)" />
              <Title ctx={ctx} size={9} color={INK.onDark} />
              <div style={{ display: "flex", justifyContent: "center", width: "100%" }}>
                <PriceBadge ctx={ctx} tone="light" />
              </div>
            </AdjustBox>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: px(1.8),
              }}
            >
              <Chips
                items={[...metaItems(content, ctx.businessType), ...content.services]}
                tone="light"
              />
              <ContactLine ctx={ctx} tone="light" />
            </div>
          </div>
        </div>
      );
    },
  },
  {
    id: "bottombar",
    label: "Bottom Bar",
    tags: ["image_first", "minimal"],
    render: (ctx) => {
      const { content, brand } = ctx;
      return (
        <div style={{ ...base(brand), color: INK.onDark }}>
          <Img src={content.imageDataUrl} video={content.videoDataUrl} />
          <div
            style={{
              position: "absolute",
              inset: 0,
              padding: px(5),
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-end",
              gap: px(2.6),
            }}
          >
            <AdjustBox
              ctx={ctx}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: px(1.8),
                borderRadius: px(2.4),
                padding: px(3.6),
                background: `${brand.primary}e6`,
                backdropFilter: "blur(10px)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: px(2.6) }}>
                <Logo ctx={ctx} />
                <div style={{ marginLeft: "auto" }}>
                  <PriceBadge ctx={ctx} tone="light" />
                </div>
              </div>
              <Title ctx={ctx} size={7} color={INK.onDark} />
              <Chips
                items={[...metaItems(content, ctx.businessType), ...content.services]}
                tone="light"
              />
              <ContactLine ctx={ctx} tone="light" />
            </AdjustBox>
          </div>
        </div>
      );
    },
  },
  {
    id: "cornerprice",
    label: "Corner Price",
    tags: ["image_first", "minimal"],
    render: (ctx) => {
      const { content, brand } = ctx;
      return (
        <div style={{ ...base(brand), color: INK.onDark }}>
          <Img src={content.imageDataUrl} video={content.videoDataUrl} />
          <div
            style={{
              position: "absolute",
              inset: 0,
              padding: px(5),
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start" }}>
              <Logo ctx={ctx} />
            </div>
            <AdjustBox
              ctx={ctx}
              style={{ display: "flex", alignItems: "flex-end", gap: px(2.6), width: "100%" }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: px(1.2), flex: 1 }}>
                <Title ctx={ctx} size={6.4} color={INK.onDark} />
                <ServiceLine ctx={ctx} tone="light" />
                <Kicker ctx={ctx} color="rgba(255,255,255,0.88)" />
                <ContactLine ctx={ctx} tone="light" />
              </div>
              <PriceBadge ctx={ctx} tone="dark" />
            </AdjustBox>
          </div>
        </div>
      );
    },
  },
  {
    id: "archway",
    label: "Archway",
    tags: ["editorial", "light", "image_first"],
    render: (ctx) => {
      const { content, brand, variant } = ctx;
      const align = variant.align === "center" ? "center" : "flex-start";
      return (
        <div
          style={{
            ...base(brand),
            background: bgOr(brand, "#f6f2ff"),
            padding: px(5),
            display: "flex",
            flexDirection: "column",
            gap: px(3.6),
          }}
        >
          <BizRow ctx={ctx} tone="dark" />
          <div
            style={{
              position: "relative",
              flex: "0 1 52%",
              minHeight: 0,
              overflow: "hidden",
              // An arch instead of a rectangle: a half ellipse across the top,
              // square at the base, so the picture reads as a window. The radius
              // is a percentage of the box, so the curve holds at every size.
              borderRadius: "50% 50% 4% 4% / 34% 34% 3% 3%",
            }}
          >
            <Img src={content.imageDataUrl} video={content.videoDataUrl} />
          </div>
          <AdjustBox
            ctx={ctx}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              gap: px(1.8),
              alignItems: align,
              textAlign: variant.align,
              color: INK.strong,
            }}
          >
            <Kicker ctx={ctx} color={accentColor(ctx)} />
            <Title ctx={ctx} size={7} color={INK.strong} />
            <Chips
              items={[...metaItems(content, ctx.businessType), ...content.services]}
              tone="dark"
            />
            <div style={{ display: "flex", gap: px(1.8), alignItems: "center", flexWrap: "wrap" }}>
              <PriceBadge ctx={ctx} tone="dark" />
              <CtaTag ctx={ctx} tone="dark" />
            </div>
            <ContactLine ctx={ctx} tone="dark" />
          </AdjustBox>
        </div>
      );
    },
  },
  {
    id: "softcard",
    label: "Soft Card",
    tags: ["minimal", "light", "whitespace"],
    render: (ctx) => {
      const { content, brand } = ctx;
      return (
        <div
          style={{
            ...base(brand),
            background: bgOr(brand, `linear-gradient(160deg, ${brand.primary}1f, #ffffff 62%)`),
            padding: px(5),
            display: "flex",
            flexDirection: "column",
            gap: px(3.6),
          }}
        >
          <BizRow ctx={ctx} tone="dark" />
          <div
            style={{
              position: "relative",
              flex: "0 1 48%",
              minHeight: 0,
              overflow: "hidden",
              borderRadius: px(4),
              boxShadow: `0 ${px(2.6)} ${px(5)} rgba(24,16,44,0.16)`,
            }}
          >
            <Img src={content.imageDataUrl} video={content.videoDataUrl} />
          </div>
          <AdjustBox
            ctx={ctx}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              gap: px(1.8),
              justifyContent: "center",
              color: INK.strong,
            }}
          >
            <Kicker ctx={ctx} color={accentColor(ctx)} />
            <Title ctx={ctx} size={6.6} color={INK.strong} />
            <AdditionalText ctx={ctx} size={2.6} opacity={0.66} />
            <ServiceLine ctx={ctx} tone="dark" />
            <div style={{ display: "flex", gap: px(1.8), alignItems: "center", flexWrap: "wrap" }}>
              <PriceBadge ctx={ctx} tone="dark" />
              <CtaTag ctx={ctx} tone="dark" />
            </div>
            <ContactLine ctx={ctx} tone="dark" />
          </AdjustBox>
        </div>
      );
    },
  },
  {
    id: "marquee",
    label: "Marquee",
    tags: ["bold", "type_first", "gradient"],
    render: (ctx) => {
      const { content, brand } = ctx;
      // The kicker repeated as a running band, top and bottom, the way a poster
      // or a shop window prints one word across its whole width.
      const word = (content.subject.trim() || ctx.businessName || "krijo24").toUpperCase();
      const band = Array.from({ length: 6 }, () => word).join("  ·  ");
      const Band = () => (
        <div
          style={{
            // A fixed band height rather than one grown by the line box: the
            // strip is a design constant, and letting font metrics set it made
            // the export sit a few percent off the preview.
            height: px(6.4),
            flex: "0 0 auto",
            display: "flex",
            alignItems: "center",
            background: accentColor(ctx),
            color: INK.onDark,
            overflow: "hidden",
            whiteSpace: "nowrap",
          }}
        >
          <span
            style={{
              fontSize: px(2.6),
              fontWeight: 800,
              letterSpacing: "0.22em",
              fontFamily: fontSecondary(brand),
            }}
          >
            {band}
          </span>
        </div>
      );
      return (
        <div
          style={{
            ...base(brand),
            background: "#100a1c",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <Band />
          <div style={{ position: "relative", flex: 1 }}>
            <Img src={content.imageDataUrl} video={content.videoDataUrl} />
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: `linear-gradient(to top, ${brand.primary}f0 6%, ${brand.primary}40 46%, transparent 72%)`,
              }}
            />
            <div
              style={{
                position: "absolute",
                inset: 0,
                padding: px(5),
                display: "flex",
                flexDirection: "column",
                justifyContent: "flex-end",
              }}
            >
              <AdjustBox
                ctx={ctx}
                style={{ display: "flex", flexDirection: "column", gap: px(1.8) }}
              >
                <Title ctx={ctx} size={9} color={INK.onDark} />
                <Chips
                  items={[...metaItems(content, ctx.businessType), ...content.services]}
                  tone="light"
                />
                <div
                  style={{ display: "flex", gap: px(1.8), alignItems: "center", flexWrap: "wrap" }}
                >
                  <PriceBadge ctx={ctx} tone="light" />
                  <CtaTag ctx={ctx} tone="light" />
                </div>
                <ContactLine ctx={ctx} tone="light" />
              </AdjustBox>
            </div>
          </div>
          <Band />
        </div>
      );
    },
  },
  {
    id: "halfmoon",
    label: "Half Moon",
    tags: ["bold", "gradient", "centered"],
    render: (ctx) => {
      const { content, brand } = ctx;
      return (
        <div style={{ ...base(brand), background: brand.primary }}>
          <div style={{ position: "absolute", inset: 0, height: "58%", overflow: "hidden" }}>
            <Img src={content.imageDataUrl} video={content.videoDataUrl} />
          </div>
          {/* The colour block rises into the picture as a wide dome, so the
              headline sits in the curve rather than on a straight edge. */}
          <div
            style={{
              position: "absolute",
              left: `-${px(6)}`,
              right: `-${px(6)}`,
              top: "42%",
              bottom: 0,
              background: `linear-gradient(180deg, ${brand.primary}, ${brand.secondary})`,
              borderRadius: "50% 50% 0 0 / 26% 26% 0 0",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              padding: px(5),
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              alignItems: "center",
              textAlign: "center",
            }}
          >
            <BizRow ctx={ctx} tone="light" />
            <AdjustBox
              ctx={ctx}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: px(1.8),
                paddingTop: px(7),
              }}
            >
              <Kicker ctx={ctx} color="rgba(255,255,255,0.9)" />
              <Title ctx={ctx} size={7.8} color={INK.onDark} />
              <AdditionalText ctx={ctx} size={2.6} opacity={0.82} />
              <ServiceLine ctx={ctx} tone="light" />
              <div style={{ display: "flex", gap: px(1.8), alignItems: "center" }}>
                <PriceBadge ctx={ctx} tone="light" />
                <CtaTag ctx={ctx} tone="light" />
              </div>
            </AdjustBox>
            <ContactLine ctx={ctx} tone="light" />
          </div>
        </div>
      );
    },
  },
  {
    id: "gridlines",
    label: "Grid Lines",
    tags: ["dense", "dark", "image_first"],
    render: (ctx) => {
      const { content, brand, variant } = ctx;
      const rule = "rgba(255,255,255,0.32)";
      return (
        <div style={{ ...base(brand), background: "#0d0b14" }}>
          <Img src={content.imageDataUrl} video={content.videoDataUrl} style={{ opacity: 0.9 }} />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(to top, rgba(10,8,16,.9) 12%, rgba(10,8,16,.15) 55%)",
            }}
          />
          {/* Survey rules: two thin lines and their tick marks, the drafting
              language a property or a car listing is measured in. */}
          <div
            style={{
              position: "absolute",
              left: px(5),
              right: px(5),
              top: "34%",
              height: 1,
              background: rule,
            }}
          />
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: px(5),
              bottom: px(5),
              width: 1,
              background: rule,
            }}
          />
          <div style={{ position: "absolute", inset: px(5), border: `1px solid ${rule}` }} />
          <div
            style={{
              position: "absolute",
              inset: 0,
              padding: px(7),
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              alignItems: variant.align === "center" ? "center" : "flex-start",
              textAlign: variant.align,
            }}
          >
            <BizRow ctx={ctx} tone="light" />
            <AdjustBox ctx={ctx} style={{ display: "flex", flexDirection: "column", gap: px(1.8) }}>
              <Kicker ctx={ctx} color={brand.accent} />
              <Title ctx={ctx} size={7.4} color={INK.onDark} />
              <div
                style={{
                  display: "flex",
                  gap: px(2.6),
                  flexWrap: "wrap",
                  fontSize: px(2.2),
                  fontWeight: 600,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  fontFamily: fontSecondary(brand),
                  color: INK.onDarkBody,
                }}
              >
                {[...metaItems(content, ctx.businessType), ...content.services]
                  .slice(0, 5)
                  .map((item) => (
                    <span key={item}>{item}</span>
                  ))}
              </div>
              <div
                style={{ display: "flex", gap: px(1.8), alignItems: "center", flexWrap: "wrap" }}
              >
                <PriceBadge ctx={ctx} tone="light" />
                <CtaTag ctx={ctx} tone="light" />
              </div>
              <ContactLine ctx={ctx} tone="light" />
            </AdjustBox>
          </div>
        </div>
      );
    },
  },
  {
    id: "stickerprice",
    label: "Sticker",
    tags: ["bold", "light", "image_first"],
    render: (ctx) => {
      const { content, brand } = ctx;
      const price = formatPrice(content.price, brand.currency);
      return (
        <div
          style={{
            ...base(brand),
            background: bgOr(brand, "#fbf7f2"),
            padding: px(5),
            display: "flex",
            flexDirection: "column",
            gap: px(2.6),
          }}
        >
          <div
            style={{
              position: "relative",
              flex: "0 1 60%",
              minHeight: 0,
              overflow: "hidden",
              borderRadius: px(2.4),
            }}
          >
            <Img src={content.imageDataUrl} video={content.videoDataUrl} />
            {/* The price as a stuck-on tag rather than a badge in the flow. */}
            {price ? (
              <span
                style={{
                  position: "absolute",
                  right: px(4),
                  top: px(4),
                  transform: "rotate(-8deg)",
                  padding: `${px(1.8)} ${px(3.2)}`,
                  borderRadius: px(2.4),
                  background: accentColor(ctx),
                  color: INK.onDark,
                  fontWeight: 800,
                  fontSize: px(4.2),
                  letterSpacing: "-0.02em",
                  fontFamily: font(brand),
                  boxShadow: `0 ${px(1.2)} ${px(2.6)} rgba(20,12,36,0.28)`,
                }}
              >
                {price}
              </span>
            ) : null}
          </div>
          <AdjustBox
            ctx={ctx}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              gap: px(1.8),
              justifyContent: "center",
              color: INK.strong,
            }}
          >
            <Kicker ctx={ctx} color={accentColor(ctx)} />
            <Title ctx={ctx} size={7.2} color={INK.strong} />
            <Chips
              items={[...metaItems(content, ctx.businessType), ...content.services]}
              tone="dark"
            />
            <div style={{ display: "flex", gap: px(1.8), alignItems: "center", flexWrap: "wrap" }}>
              <CtaTag ctx={ctx} tone="dark" />
              <BizRow ctx={ctx} tone="dark" />
            </div>
            <ContactLine ctx={ctx} tone="dark" />
          </AdjustBox>
        </div>
      );
    },
  },
  {
    id: "skycall",
    label: "Sky Call",
    tags: ["image_first", "bold", "light"],
    render: (ctx) => {
      const { content, brand } = ctx;
      return (
        <div
          style={{
            ...base(brand),
            background: deepGround(brand),
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ position: "absolute", inset: 0 }}>
            <PhotoLayer ctx={ctx} treatment="scrimBoth" />
          </div>
          <div
            style={{
              position: "relative",
              flex: 1,
              padding: `${px(5)} ${px(5)} 0`,
              display: "flex",
              flexDirection: "column",
              gap: px(2.6),
            }}
          >
            <BizRow ctx={ctx} tone="light" />
            <HeadlineTwoTone ctx={ctx} size={8.6} color={INK.onDark} accent={brand.accent} />
            <AdditionalText ctx={ctx} size={2.6} opacity={0.85} style={{ color: INK.onDark }} />
            <div
              style={{
                marginTop: "auto",
                display: "flex",
                flexDirection: "column",
                gap: px(1.8),
                paddingBottom: px(3.6),
              }}
            >
              <FeatureBoxes ctx={ctx} tone="light" columns={2} />
              <CtaBar ctx={ctx} tone="light" />
            </div>
          </div>
          <ContactBar ctx={ctx} />
        </div>
      );
    },
  },
  {
    id: "agencysweep",
    label: "Agency Sweep",
    tags: ["dense", "dark", "luxury"],
    render: (ctx) => {
      const { content, brand } = ctx;
      return (
        <div
          style={{
            ...base(brand),
            background: deepGround(brand),
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ position: "relative", flex: "0 1 42%", minHeight: 0 }}>
            <Img src={content.imageDataUrl} video={content.videoDataUrl} />
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "linear-gradient(to bottom, rgba(7,12,30,0.55), rgba(7,12,30,0.1))",
              }}
            />
            <div
              style={{
                position: "absolute",
                left: px(5),
                top: px(4.5),
                right: px(5),
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <BizRow ctx={ctx} tone="light" />
              <span
                style={{
                  fontSize: px(1.8),
                  fontWeight: 700,
                  letterSpacing: "0.22em",
                  color: brand.accent,
                  fontFamily: fontSecondary(brand),
                }}
              >
                {(content.date || "").toUpperCase()}
              </span>
            </div>
          </div>
          <SweepArc color={brand.accent} height={14} />
          <div
            style={{
              background: brand.accent,
              padding: `0 ${px(5)} ${px(2.6)}`,
              display: "flex",
              justifyContent: "center",
            }}
          >
            <span
              style={{
                fontSize: px(2.2),
                fontWeight: 800,
                letterSpacing: "0.3em",
                color: INK.strong,
                fontFamily: fontSecondary(brand),
              }}
            >
              {(content.subject || "FLIGHT").toUpperCase()}
            </span>
          </div>
          <div
            style={{
              flex: 1,
              padding: `${px(3.6)} ${px(5)} 0`,
              display: "flex",
              flexDirection: "column",
              gap: px(2.6),
            }}
          >
            <HeadlineTwoTone
              ctx={ctx}
              size={7.6}
              color={INK.onDark}
              accent={brand.accent}
              align="center"
            />
            <FeatureBoxes ctx={ctx} tone="light" columns={2} />
            <div style={{ marginTop: "auto", paddingBottom: px(3.6) }}>
              <CtaBar ctx={ctx} tone="dark" />
            </div>
          </div>
          <ContactBar ctx={ctx} ground="rgba(255,255,255,0.08)" />
        </div>
      );
    },
  },
  {
    id: "fareupdate",
    label: "Fare Update",
    tags: ["dense", "light", "image_first"],
    render: (ctx) => {
      const { content, brand } = ctx;
      const rows = [
        [content.date, content.subject || content.location],
        [content.meta1, content.location],
        [content.meta2, content.subject],
      ].filter(([when]) => !!when) as [string, string][];
      return (
        <div
          style={{
            ...base(brand),
            background: "#eaf2fb",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ position: "relative", flex: "0 1 46%", minHeight: 0 }}>
            <Img src={content.imageDataUrl} video={content.videoDataUrl} />
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "linear-gradient(to bottom, rgba(9,16,38,0.45), rgba(234,242,251,0.9))",
              }}
            />
            <div
              style={{
                position: "absolute",
                left: px(5),
                top: px(4.5),
                right: px(5),
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <BizRow ctx={ctx} tone="light" />
            </div>
            <div style={{ position: "absolute", left: px(5), right: px(5), bottom: px(3) }}>
              <HeadlineTwoTone ctx={ctx} size={7.4} color={INK.strong} accent={accentColor(ctx)} />
            </div>
          </div>
          <div
            style={{
              flex: 1,
              padding: `${px(2.6)} ${px(5)} 0`,
              display: "flex",
              flexDirection: "column",
              gap: px(1.8),
            }}
          >
            {rows.slice(0, 3).map(([when, where], i) => (
              <div
                key={`${when}-${i}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: px(1.8),
                  background: "#fff",
                  borderRadius: px(2.4),
                  padding: `${px(1.8)} ${px(2.6)}`,
                  boxShadow: `0 ${px(0.8)} ${px(1.8)} rgba(13,23,51,0.08)`,
                }}
              >
                <span
                  style={{
                    fontSize: px(2.2),
                    fontWeight: 800,
                    color: brand.primary,
                    fontFamily: font(brand),
                    minWidth: px(16),
                  }}
                >
                  {when}
                </span>
                <span style={{ flex: 1, height: px(0.3), background: "rgba(13,23,51,0.15)" }} />
                <span
                  style={{
                    fontSize: px(2.2),
                    fontWeight: 700,
                    color: INK.strong,
                    fontFamily: fontSecondary(brand),
                  }}
                >
                  {where}
                </span>
                <span
                  style={{
                    fontSize: px(3.2),
                    fontWeight: 800,
                    color: accentColor(ctx),
                    fontFamily: font(brand),
                  }}
                >
                  {formatPrice(content.price, brand.currency)}
                </span>
              </div>
            ))}
            <div style={{ marginTop: "auto", paddingBottom: px(3.6) }}>
              <CtaBar ctx={ctx} tone="dark" />
            </div>
          </div>
          <ContactBar ctx={ctx} ground={brand.primary} />
        </div>
      );
    },
  },
  {
    id: "ticketcut",
    label: "Ticket",
    tags: ["dark", "bold", "image_first"],
    render: (ctx) => {
      const { content, brand } = ctx;
      return (
        <div style={{ ...base(brand), background: deepGround(brand) }}>
          <PhotoLayer ctx={ctx} treatment="wash" strength={0.92} />
          <div
            style={{
              position: "absolute",
              inset: 0,
              padding: px(5),
              display: "flex",
              flexDirection: "column",
              gap: px(2.6),
            }}
          >
            <BizRow ctx={ctx} tone="light" />
            <HeadlineTwoTone ctx={ctx} size={7.8} color={INK.onDark} accent={brand.accent} />
            {/* the ticket itself, tilted the way these posters lay it on the sky */}
            <div
              style={{
                marginTop: "auto",
                marginBottom: px(1.8),
                transform: "rotate(-2.5deg)",
                background: "#fff",
                borderRadius: px(2.4),
                overflow: "hidden",
                boxShadow: `0 ${px(1.8)} ${px(5)} rgba(0,0,0,0.35)`,
              }}
            >
              <div style={{ padding: `${px(2.6)} ${px(3.6)} ${px(2)}` }}>
                <RouteCodes ctx={ctx} color={INK.strong} muted="rgba(13,23,51,0.45)" />
              </div>
              <Perforation color={deepGround(brand)} count={24} />
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: px(2.6),
                  padding: `${px(1.8)} ${px(3.6)} ${px(3)}`,
                }}
              >
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span
                    style={{
                      fontSize: px(1.8),
                      fontWeight: 700,
                      letterSpacing: "0.18em",
                      color: INK.muted,
                      fontFamily: fontSecondary(brand),
                    }}
                  >
                    {(content.date || "DATE").toUpperCase()}
                  </span>
                  <span
                    style={{
                      fontSize: px(4.2),
                      fontWeight: 800,
                      color: accentColor(ctx),
                      fontFamily: font(brand),
                    }}
                  >
                    {formatPrice(content.price, brand.currency)}
                  </span>
                </div>
                <span style={{ marginLeft: "auto" }}>
                  <Barcode color={INK.strong} height={7} />
                </span>
              </div>
            </div>
            <CtaBar ctx={ctx} tone="dark" />
          </div>
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0 }}>
            <ContactBar ctx={ctx} />
          </div>
        </div>
      );
    },
  },
  {
    id: "cabinwindow",
    label: "Cabin Window",
    tags: ["luxury", "dark", "image_first"],
    render: (ctx) => {
      const { content, brand } = ctx;
      return (
        <div
          style={{
            ...base(brand),
            background: deepGround(brand),
            padding: px(5),
            display: "flex",
            flexDirection: "column",
            gap: px(2.6),
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <BizRow ctx={ctx} tone="light" />
            <span
              style={{
                fontSize: px(1.8),
                fontWeight: 700,
                letterSpacing: "0.24em",
                color: brand.accent,
                fontFamily: fontSecondary(brand),
              }}
            >
              {(content.subject || "").toUpperCase()}
            </span>
          </div>
          <div
            style={{
              position: "relative",
              flex: "0 1 44%",
              minHeight: 0,
              borderRadius: "44% 44% 44% 44% / 30% 30% 30% 30%",
              overflow: "hidden",
              border: `${px(1.2)} solid rgba(255,255,255,0.9)`,
              boxShadow: `0 ${px(1.8)} ${px(5)} rgba(0,0,0,0.4)`,
            }}
          >
            <Img src={content.imageDataUrl} video={content.videoDataUrl} />
          </div>
          <HeadlineTwoTone
            ctx={ctx}
            size={7.2}
            color={INK.onDark}
            accent={brand.accent}
            align="center"
          />
          <FeatureBoxes ctx={ctx} tone="light" columns={2} limit={2} />
          <div
            style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: px(1.8) }}
          >
            <CtaBar ctx={ctx} tone="light" />
            <ContactLine ctx={ctx} tone="light" />
          </div>
        </div>
      );
    },
  },
  {
    id: "lesssearching",
    label: "Less Searching",
    tags: ["light", "type_first", "whitespace"],
    render: (ctx) => {
      const { content, brand } = ctx;
      return (
        <div
          style={{
            ...base(brand),
            background: "#f4f1ea",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              padding: `${px(5)} ${px(5)} ${px(3)}`,
              display: "flex",
              flexDirection: "column",
              gap: px(1.8),
            }}
          >
            <BizRow ctx={ctx} tone="dark" />
            <HeadlineTwoTone ctx={ctx} size={8.4} color={INK.strong} accent={accentColor(ctx)} />
          </div>
          <div style={{ position: "relative", flex: 1 }}>
            <Img src={content.imageDataUrl} video={content.videoDataUrl} />
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "linear-gradient(to top, rgba(7,12,30,0.8) 18%, transparent 55%)",
              }}
            />
            <div
              style={{
                position: "absolute",
                left: px(5.5),
                right: px(5.5),
                bottom: px(4),
                display: "flex",
                flexDirection: "column",
                gap: px(1.8),
              }}
            >
              <FeatureBoxes ctx={ctx} tone="light" columns={2} limit={2} />
              <CtaBar ctx={ctx} tone="light" />
            </div>
          </div>
          <ContactBar ctx={ctx} ground={brand.primary} />
        </div>
      );
    },
  },
  {
    id: "bluepanel",
    label: "Blue Panel",
    tags: ["light", "minimal", "image_first"],
    render: (ctx) => {
      const { content, brand } = ctx;
      return (
        <div
          style={{
            ...base(brand),
            background: brand.primary,
            padding: px(5),
            display: "flex",
            flexDirection: "column",
            gap: px(2.6),
          }}
        >
          <BizRow ctx={ctx} tone="light" />
          <div
            style={{
              background: "#fff",
              borderRadius: px(4),
              padding: px(3.6),
              display: "flex",
              flexDirection: "column",
              gap: px(2.6),
            }}
          >
            <HeadlineTwoTone ctx={ctx} size={6.8} color={INK.strong} accent={accentColor(ctx)} />
            <div
              style={{
                position: "relative",
                height: px(46),
                overflow: "hidden",
                borderRadius: px(2.4),
              }}
            >
              <Img src={content.imageDataUrl} video={content.videoDataUrl} />
            </div>
            <FeatureBoxes ctx={ctx} tone="dark" columns={2} />
          </div>
          <div
            style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: px(1.8) }}
          >
            <CtaBar ctx={ctx} tone="light" />
            <ContactLine ctx={ctx} tone="light" />
          </div>
        </div>
      );
    },
  },
  {
    id: "onewayticket",
    label: "One Way",
    tags: ["dark", "image_first", "editorial"],
    render: (ctx) => {
      const { content, brand } = ctx;
      return (
        <div style={{ ...base(brand), background: "#08101f" }}>
          <PhotoLayer ctx={ctx} treatment="scrimBoth" />
          <div
            style={{
              position: "absolute",
              inset: 0,
              padding: px(5),
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                paddingBottom: px(2.6),
                borderBottom: "1px solid rgba(255,255,255,0.25)",
              }}
            >
              <BizRow ctx={ctx} tone="light" />
              <span
                style={{
                  fontSize: px(1.8),
                  fontWeight: 700,
                  letterSpacing: "0.2em",
                  color: INK.onDarkMuted,
                  fontFamily: fontSecondary(brand),
                }}
              >
                {(content.date || "").toUpperCase()}
              </span>
            </div>
            <div
              style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: px(2.6) }}
            >
              <span
                style={{
                  fontSize: px(2.2),
                  fontWeight: 700,
                  letterSpacing: "0.3em",
                  color: brand.accent,
                  fontFamily: fontSecondary(brand),
                }}
              >
                ONE WAY TICKET
              </span>
              <RouteCodes ctx={ctx} color={INK.onDark} muted="rgba(255,255,255,0.6)" />
              <HeadlineTwoTone ctx={ctx} size={6.6} color={INK.onDark} accent={brand.accent} />
              <CtaBar ctx={ctx} tone="dark" />
              <ContactLine ctx={ctx} tone="light" />
            </div>
          </div>
        </div>
      );
    },
  },
  {
    id: "bookflight",
    label: "Book Now",
    tags: ["bold", "centered", "gradient"],
    render: (ctx) => {
      const { content, brand } = ctx;
      return (
        <div
          style={{
            ...base(brand),
            background: deepGround(brand),
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ position: "absolute", inset: 0 }}>
            <Img
              src={content.imageDataUrl}
              video={content.videoDataUrl}
              style={{ opacity: 0.95 }}
            />
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: `linear-gradient(180deg, rgba(7,12,30,0.72) 0%, ${brand.primary}aa 46%, rgba(7,12,30,0.9) 100%)`,
              }}
            />
          </div>
          <div
            style={{
              position: "relative",
              flex: 1,
              padding: px(5),
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "space-between",
              gap: px(2.6),
              textAlign: "center",
            }}
          >
            <BizRow ctx={ctx} tone="light" />
            <DashedArc color="rgba(255,255,255,0.75)" />
            <HeadlineTwoTone
              ctx={ctx}
              size={9}
              color={INK.onDark}
              accent={brand.accent}
              align="center"
            />
            <AdditionalText
              ctx={ctx}
              size={2.6}
              opacity={0.85}
              style={{ color: INK.onDark, textAlign: "center" }}
            />
            <FeatureBoxes ctx={ctx} tone="light" columns={2} limit={2} />
            <CtaBar ctx={ctx} tone="light" />
          </div>
          <ContactBar ctx={ctx} ground={brand.primary} />
        </div>
      );
    },
  },
  {
    id: "goldroute",
    label: "Gold Route",
    tags: ["luxury", "dark", "image_first"],
    render: (ctx) => {
      const { content, brand } = ctx;
      return (
        <div style={{ ...base(brand), background: "#070c1e" }}>
          <PhotoLayer ctx={ctx} treatment="duotone" grain />
          <div
            style={{
              position: "absolute",
              inset: px(3.6),
              border: `${px(0.4)} solid ${brand.accent}88`,
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              padding: px(7),
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: px(0.8),
              }}
            >
              <BizRow ctx={ctx} tone="light" />
              <span
                style={{
                  fontSize: px(1.8),
                  fontWeight: 700,
                  letterSpacing: "0.34em",
                  color: brand.accent,
                  fontFamily: fontSecondary(brand),
                }}
              >
                FLIGHT TICKET
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: px(2.6) }}>
              <RouteCodes ctx={ctx} color={INK.onDark} muted={`${brand.accent}cc`} />
              <HeadlineTwoTone ctx={ctx} size={7} color={INK.onDark} accent={brand.accent} />
              <ServiceLine ctx={ctx} tone="light" />
              <div
                style={{ display: "flex", alignItems: "center", gap: px(2.6), flexWrap: "wrap" }}
              >
                <PriceBadge ctx={ctx} tone="light" />
                <CtaTag ctx={ctx} tone="dark" />
              </div>
              <ContactLine ctx={ctx} tone="light" />
            </div>
          </div>
        </div>
      );
    },
  },
  {
    id: "wavecut",
    label: "Wave",
    tags: ["light", "image_first", "gradient"],
    render: (ctx) => {
      const { content, brand } = ctx;
      const sand = bgOr(brand, "#fdf3e3");
      return (
        <div style={{ ...base(brand), background: sand, display: "flex", flexDirection: "column" }}>
          <div style={{ position: "relative", flex: "0 1 56%", minHeight: 0 }}>
            <Img src={content.imageDataUrl} video={content.videoDataUrl} />
            <div style={{ position: "absolute", left: px(5), top: px(5) }}>
              <BizRow ctx={ctx} tone="light" />
            </div>
          </div>
          <Scallop color={sand} size={7} />
          <div style={{ flex: 1, padding: `${px(1.8)} ${px(5)} ${px(5)}` }}>
            <OfferStack ctx={ctx} tone="dark" titleSize={7.2} />
          </div>
        </div>
      );
    },
  },
  {
    id: "sunarc",
    label: "Sun",
    tags: ["gradient", "centered", "bold"],
    render: (ctx) => {
      const { content, brand } = ctx;
      return (
        <div
          style={{
            ...base(brand),
            background: `linear-gradient(180deg, #ffd79a, ${brand.primary} 78%)`,
          }}
        >
          <SunDisc
            color="#fff1cd"
            size={52}
            style={{ left: "50%", top: "16%", marginLeft: `-${px(26)}` }}
          />
          <div
            style={{
              position: "absolute",
              left: px(6),
              right: px(6),
              top: "34%",
              bottom: 0,
              overflow: "hidden",
              borderRadius: `${px(24)} ${px(24)} 0 0`,
            }}
          >
            <Img src={content.imageDataUrl} video={content.videoDataUrl} />
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: `linear-gradient(to top, ${brand.primary}f0 18%, transparent 62%)`,
              }}
            />
          </div>
          <div
            style={{
              position: "absolute",
              inset: 0,
              padding: px(5),
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <BizRow ctx={ctx} tone="light" />
            <OfferStack ctx={ctx} tone="light" titleSize={7.6} align="center" />
          </div>
        </div>
      );
    },
  },
  {
    id: "beachlabel",
    label: "Beach Label",
    tags: ["image_first", "light", "minimal"],
    render: (ctx) => {
      const { content, brand } = ctx;
      return (
        <div style={{ ...base(brand), background: "#0d1a24" }}>
          <Img src={content.imageDataUrl} video={content.videoDataUrl} />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(to bottom, rgba(6,20,28,.35), transparent 40%)",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              padding: px(5),
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <BizRow ctx={ctx} tone="light" />
            <div
              style={{
                background: "rgba(255,255,255,0.94)",
                borderRadius: px(4),
                padding: px(5),
                boxShadow: `0 ${px(1.8)} ${px(5)} rgba(6,20,28,0.22)`,
              }}
            >
              <OfferStack ctx={ctx} tone="dark" titleSize={6.4} />
            </div>
          </div>
        </div>
      );
    },
  },
  {
    id: "seahorizon",
    label: "Horizon",
    tags: ["image_first", "bold", "gradient"],
    render: (ctx) => {
      const { content, brand } = ctx;
      return (
        <div
          style={{
            ...base(brand),
            background: "#08303f",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ position: "relative", flex: "0 1 38%", minHeight: 0 }}>
            <Img src={content.imageDataUrl} video={content.videoDataUrl} />
          </div>
          <div
            style={{
              flex: 1,
              padding: px(5),
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              background: `linear-gradient(180deg, ${brand.primary}, #06222c)`,
            }}
          >
            <OfferStack ctx={ctx} tone="light" titleSize={7.8} />
          </div>
          <div style={{ position: "relative", flex: "0 1 16%", minHeight: 0 }}>
            <Img
              src={content.imageDataUrl}
              video={content.videoDataUrl}
              style={{ opacity: 0.55 }}
            />
          </div>
        </div>
      );
    },
  },
  {
    id: "sunsetbands",
    label: "Sunset",
    tags: ["gradient", "bold", "light"],
    render: (ctx) => {
      const { content, brand } = ctx;
      const bands = ["#ffd08a", "#ffb07c", "#f08a7d", brand.secondary, brand.primary];
      return (
        <div style={{ ...base(brand), display: "flex", flexDirection: "column" }}>
          {bands.map((c, i) => (
            <div key={c + i} style={{ flex: 1, background: c }} />
          ))}
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "8%",
              width: px(40),
              height: px(40),
              marginLeft: `-${px(20)}`,
              borderRadius: "50%",
              overflow: "hidden",
              border: `${px(0.8)} solid rgba(255,255,255,0.8)`,
            }}
          >
            <Img src={content.imageDataUrl} video={content.videoDataUrl} />
          </div>
          <div
            style={{
              position: "absolute",
              inset: 0,
              padding: px(5),
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <BizRow ctx={ctx} tone="light" />
            <OfferStack ctx={ctx} tone="light" titleSize={7.4} align="center" />
          </div>
        </div>
      );
    },
  },
  {
    id: "poolside",
    label: "Poolside",
    tags: ["light", "whitespace", "minimal"],
    render: (ctx) => {
      const { content, brand } = ctx;
      return (
        <div
          style={{
            ...base(brand),
            background: bgOr(brand, "linear-gradient(160deg, #dff4f7, #ffffff 65%)"),
            padding: px(5),
            display: "flex",
            flexDirection: "column",
            gap: px(2.6),
          }}
        >
          <BizRow ctx={ctx} tone="dark" />
          <div
            style={{
              position: "relative",
              flex: "0 1 46%",
              minHeight: 0,
              overflow: "hidden",
              borderRadius: px(4),
            }}
          >
            <Img src={content.imageDataUrl} video={content.videoDataUrl} />
            <span
              style={{
                position: "absolute",
                right: px(3),
                bottom: px(3),
                width: px(16),
                height: px(16),
                borderRadius: "50%",
                background: brand.primary,
                color: INK.onDark,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 800,
                fontSize: px(3.2),
                fontFamily: font(brand),
              }}
            >
              {formatPrice(content.price, brand.currency)}
            </span>
          </div>
          <OfferStack ctx={ctx} tone="dark" titleSize={6.6} />
        </div>
      );
    },
  },
  {
    id: "postcard",
    label: "Postcard",
    tags: ["editorial", "light", "whitespace"],
    render: (ctx) => {
      const { content, brand } = ctx;
      return (
        <div
          style={{
            ...base(brand),
            background: bgOr(brand, "#f2ede2"),
            padding: px(3.6),
            display: "flex",
          }}
        >
          <div
            style={{
              flex: 1,
              background: "#fff",
              padding: px(2.6),
              display: "flex",
              flexDirection: "column",
              gap: px(2.6),
              boxShadow: `0 ${px(1.2)} ${px(3.6)} rgba(20,16,32,0.12)`,
            }}
          >
            <div
              style={{ position: "relative", flex: "0 1 52%", minHeight: 0, overflow: "hidden" }}
            >
              <Img src={content.imageDataUrl} video={content.videoDataUrl} />
              {/* the stamp corner of a card sent home */}
              <span
                style={{
                  position: "absolute",
                  right: px(2.4),
                  top: px(2.4),
                  width: px(11),
                  height: px(13),
                  border: `${px(0.4)} dashed rgba(255,255,255,0.9)`,
                  borderRadius: px(1.2),
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: INK.onDark,
                  fontSize: px(1.8),
                  fontWeight: 800,
                  letterSpacing: "0.12em",
                  textAlign: "center",
                  fontFamily: fontSecondary(brand),
                }}
              >
                {(content.subject || "TRAVEL").slice(0, 8).toUpperCase()}
              </span>
            </div>
            <div style={{ flex: 1, paddingLeft: px(1.5) }}>
              <OfferStack ctx={ctx} tone="dark" titleSize={6.2} chips={false} />
            </div>
            <BizRow ctx={ctx} tone="dark" />
          </div>
        </div>
      );
    },
  },
  {
    id: "shellbadge",
    label: "Shell Badge",
    tags: ["image_first", "bold", "centered"],
    render: (ctx) => {
      const { content, brand } = ctx;
      return (
        <div style={{ ...base(brand), background: "#0a2430" }}>
          <Img src={content.imageDataUrl} video={content.videoDataUrl} />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `radial-gradient(90% 70% at 50% 62%, ${brand.primary}d9, rgba(8,30,40,0.55))`,
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              padding: px(5),
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <BizRow ctx={ctx} tone="light" />
            <div
              style={{
                width: px(34),
                height: px(34),
                borderRadius: "50%",
                border: `${px(0.8)} solid rgba(255,255,255,0.75)`,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: px(0.4),
                color: INK.onDark,
                fontFamily: font(brand),
              }}
            >
              <span style={{ fontSize: px(1.8), letterSpacing: "0.2em", opacity: 0.8 }}>NGA</span>
              <span style={{ fontSize: px(7), fontWeight: 800 }}>
                {formatPrice(content.price, brand.currency)}
              </span>
            </div>
            <OfferStack ctx={ctx} tone="light" titleSize={7} align="center" />
          </div>
        </div>
      );
    },
  },
  {
    id: "azuredeep",
    label: "Azure",
    tags: ["dark", "luxury", "image_first"],
    render: (ctx) => {
      const { content, brand } = ctx;
      return (
        <div style={{ ...base(brand), background: "#04222e" }}>
          <Img src={content.imageDataUrl} video={content.videoDataUrl} style={{ opacity: 0.7 }} />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(to top, rgba(4,34,46,.95) 22%, rgba(4,34,46,.25) 62%)",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: px(4.5),
              border: `1px solid rgba(255,255,255,0.35)`,
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              padding: px(7),
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-end",
              gap: px(2.6),
            }}
          >
            <OfferStack ctx={ctx} tone="light" titleSize={8.2} chips={false} />
            <BizRow ctx={ctx} tone="light" />
          </div>
        </div>
      );
    },
  },
  {
    id: "sandnote",
    label: "Sand Note",
    tags: ["editorial", "light", "whitespace"],
    render: (ctx) => {
      const { content, brand } = ctx;
      return (
        <div
          style={{
            ...base(brand),
            background: bgOr(brand, "#f6ecdc"),
            padding: px(5),
            display: "flex",
            flexDirection: "column",
            gap: px(2.6),
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <BizRow ctx={ctx} tone="dark" />
            <span
              style={{
                height: px(0.4),
                flex: 1,
                marginLeft: px(3),
                background: `${brand.primary}55`,
              }}
            />
          </div>
          <OfferStack ctx={ctx} tone="dark" titleSize={7.6} chips={false} contact={false} />
          <div style={{ position: "relative", flex: 1, overflow: "hidden", borderRadius: px(2.4) }}>
            <Img src={content.imageDataUrl} video={content.videoDataUrl} />
          </div>
          <ContactLine ctx={ctx} tone="dark" />
        </div>
      );
    },
  },
  {
    id: "passportstamp",
    label: "Passport",
    tags: ["editorial", "light", "image_first"],
    render: (ctx) => {
      const { content, brand } = ctx;
      return (
        <div
          style={{
            ...base(brand),
            background: bgOr(brand, "#f4f1e9"),
            padding: px(5),
            display: "flex",
            flexDirection: "column",
            gap: px(2.6),
          }}
        >
          <div
            style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}
          >
            <BizRow ctx={ctx} tone="dark" />
            <Stamp ctx={ctx} color={`${brand.primary}cc`} />
          </div>
          <div
            style={{
              position: "relative",
              flex: "0 1 38%",
              minHeight: 0,
              overflow: "hidden",
              borderRadius: px(2.4),
            }}
          >
            <Img src={content.imageDataUrl} video={content.videoDataUrl} />
          </div>
          <OfferStack ctx={ctx} tone="dark" titleSize={6.4} />
        </div>
      );
    },
  },
  {
    id: "maproute",
    label: "Map Route",
    tags: ["image_first", "bold", "dense"],
    render: (ctx) => {
      const { content, brand } = ctx;
      return (
        <div style={{ ...base(brand), background: "#101426" }}>
          <Img src={content.imageDataUrl} video={content.videoDataUrl} style={{ opacity: 0.85 }} />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `linear-gradient(to top, ${brand.primary}f2 14%, rgba(16,20,38,0.3) 60%)`,
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              padding: px(5),
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <BizRow ctx={ctx} tone="light" />
            <div style={{ display: "flex", flexDirection: "column", gap: px(2.6) }}>
              <DottedRoute color="rgba(255,255,255,0.9)" stops={4} />
              <OfferStack ctx={ctx} tone="light" titleSize={7.8} />
            </div>
          </div>
        </div>
      );
    },
  },
  {
    id: "itinerary",
    label: "Itinerary",
    tags: ["dense", "light", "editorial"],
    render: (ctx) => {
      const { content, brand } = ctx;
      return (
        <div
          style={{
            ...base(brand),
            background: bgOr(brand, "#ffffff"),
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ position: "relative", flex: "0 1 38%", minHeight: 0 }}>
            <Img src={content.imageDataUrl} video={content.videoDataUrl} />
            <div style={{ position: "absolute", left: px(5), bottom: px(4) }}>
              <BizRow ctx={ctx} tone="light" />
            </div>
          </div>
          <div
            style={{
              flex: 1,
              padding: px(5),
              display: "flex",
              flexDirection: "column",
              gap: px(2.6),
            }}
          >
            <OfferStack
              ctx={ctx}
              tone="dark"
              titleSize={6.8}
              chips={false}
              extra={false}
              contact={false}
            />
            <StopList ctx={ctx} tone="dark" />
            <ContactLine ctx={ctx} tone="dark" />
          </div>
        </div>
      );
    },
  },
  {
    id: "globering",
    label: "Globe",
    tags: ["centered", "gradient", "bold"],
    render: (ctx) => {
      const { content, brand } = ctx;
      return (
        <div
          style={{
            ...base(brand),
            background: `linear-gradient(170deg, ${brand.primary}, #0d0a1e)`,
            padding: px(5),
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <BizRow ctx={ctx} tone="light" />
          <div
            style={{
              position: "relative",
              width: px(56),
              height: px(56),
              borderRadius: "50%",
              overflow: "hidden",
              border: `${px(0.8)} solid ${brand.accent}`,
            }}
          >
            <Img src={content.imageDataUrl} video={content.videoDataUrl} />
          </div>
          <OfferStack ctx={ctx} tone="light" titleSize={7.2} align="center" />
        </div>
      );
    },
  },
  {
    id: "stampgrid",
    label: "Stamp Grid",
    tags: ["dense", "light", "editorial"],
    render: (ctx) => {
      const { content, brand } = ctx;
      return (
        <div
          style={{
            ...base(brand),
            background: bgOr(brand, "#f7f4ee"),
            padding: px(5),
            display: "flex",
            flexDirection: "column",
            gap: px(2.6),
          }}
        >
          <div style={{ display: "flex", gap: px(1.8), justifyContent: "space-between" }}>
            <Stamp ctx={ctx} color={`${brand.primary}aa`} rotate={-7} size={17} />
            <Stamp ctx={ctx} color={`${brand.secondary}aa`} rotate={6} size={17} />
            <Stamp ctx={ctx} color={`${brand.accent}dd`} rotate={-3} size={17} />
          </div>
          <div
            style={{
              position: "relative",
              flex: "0 1 40%",
              minHeight: 0,
              overflow: "hidden",
              borderRadius: px(2.4),
            }}
          >
            <Img src={content.imageDataUrl} video={content.videoDataUrl} />
          </div>
          <OfferStack ctx={ctx} tone="dark" titleSize={6.6} />
        </div>
      );
    },
  },
  {
    id: "compassrose",
    label: "Compass",
    tags: ["dark", "minimal", "image_first"],
    render: (ctx) => {
      const { content, brand } = ctx;
      const ring = "rgba(255,255,255,0.5)";
      return (
        <div style={{ ...base(brand), background: "#0c1020" }}>
          <Img src={content.imageDataUrl} video={content.videoDataUrl} style={{ opacity: 0.8 }} />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(to top, rgba(12,16,32,.95) 20%, rgba(12,16,32,.2) 66%)",
            }}
          />
          {/* the cross of a compass, drawn as two rules and a ring */}
          <span
            style={{
              position: "absolute",
              left: px(6),
              right: px(6),
              top: "32%",
              height: 1,
              background: ring,
            }}
          />
          <span
            style={{
              position: "absolute",
              top: "18%",
              bottom: "44%",
              left: "50%",
              width: 1,
              background: ring,
            }}
          />
          <span
            style={{
              position: "absolute",
              left: "50%",
              top: "32%",
              width: px(14),
              height: px(14),
              marginLeft: `-${px(7)}`,
              marginTop: `-${px(7)}`,
              borderRadius: "50%",
              border: `1px solid ${ring}`,
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              padding: px(5),
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <BizRow ctx={ctx} tone="light" />
            <OfferStack ctx={ctx} tone="light" titleSize={7.6} chips={false} />
          </div>
        </div>
      );
    },
  },
  {
    id: "triptych",
    label: "Triptych",
    tags: ["editorial", "dense", "image_first"],
    render: (ctx) => {
      const { content, brand } = ctx;
      return (
        <div
          style={{
            ...base(brand),
            background: bgOr(brand, "#101018"),
            display: "flex",
            flexDirection: "column",
            gap: px(0.8),
          }}
        >
          <div style={{ display: "flex", gap: px(0.8), flex: "0 1 46%", minHeight: 0 }}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ position: "relative", flex: 1, overflow: "hidden" }}>
                <Img
                  src={content.imageDataUrl}
                  video={content.videoDataUrl}
                  style={{ objectPosition: ["left center", "center", "right center"][i] }}
                />
              </div>
            ))}
          </div>
          <div
            style={{
              flex: 1,
              padding: px(5),
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              gap: px(2.6),
            }}
          >
            <OfferStack ctx={ctx} tone="light" titleSize={7.4} />
          </div>
        </div>
      );
    },
  },
  {
    id: "journal",
    label: "Journal",
    tags: ["editorial", "light", "whitespace"],
    render: (ctx) => {
      const { content, brand } = ctx;
      return (
        <div
          style={{
            ...base(brand),
            background: bgOr(brand, "#fbf8f1"),
            padding: px(5),
            display: "flex",
            flexDirection: "column",
            gap: px(2.6),
          }}
        >
          <BizRow ctx={ctx} tone="dark" />
          <span style={{ height: px(0.3), background: `${brand.primary}44` }} />
          <OfferStack ctx={ctx} tone="dark" titleSize={7.8} chips={false} contact={false} />
          <div style={{ position: "relative", flex: 1, overflow: "hidden", borderRadius: px(1.2) }}>
            <Img src={content.imageDataUrl} video={content.videoDataUrl} />
          </div>
          <DottedRoute color={`${brand.primary}88`} stops={5} />
          <ContactLine ctx={ctx} tone="dark" />
        </div>
      );
    },
  },
  {
    id: "coordinates",
    label: "Coordinates",
    tags: ["type_first", "dark", "minimal"],
    render: (ctx) => {
      const { content, brand } = ctx;
      const word = (content.subject || content.location || "").toUpperCase();
      return (
        <div style={{ ...base(brand), background: "#0e0b18" }}>
          <Img src={content.imageDataUrl} video={content.videoDataUrl} style={{ opacity: 0.42 }} />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `linear-gradient(160deg, ${brand.primary}bb, rgba(14,11,24,0.92))`,
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              padding: px(5),
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <BizRow ctx={ctx} tone="light" />
            {word ? (
              <FitText
                as="div"
                text={word}
                maxSize={11}
                minSize={5}
                maxLines={2}
                lineHeight={0.98}
                style={{
                  fontWeight: 800,
                  letterSpacing: "-0.02em",
                  color: INK.onDarkFaint,
                  fontFamily: font(brand),
                }}
              />
            ) : null}
            <OfferStack ctx={ctx} tone="light" titleSize={7.4} />
          </div>
        </div>
      );
    },
  },
  {
    id: "atlasgrid",
    label: "Atlas",
    tags: ["dense", "dark", "image_first"],
    render: (ctx) => {
      const { content, brand } = ctx;
      const line = "rgba(255,255,255,0.16)";
      return (
        <div style={{ ...base(brand), background: "#0a1220" }}>
          <Img src={content.imageDataUrl} video={content.videoDataUrl} style={{ opacity: 0.8 }} />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(to top, rgba(10,18,32,.94) 18%, rgba(10,18,32,.25) 64%)",
            }}
          />
          {/* a map grid laid over the picture */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `repeating-linear-gradient(0deg, ${line} 0 1px, transparent 1px 12%), repeating-linear-gradient(90deg, ${line} 0 1px, transparent 1px 20%)`,
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              padding: px(5),
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <BizRow ctx={ctx} tone="light" />
              <Stamp ctx={ctx} color="rgba(255,255,255,0.7)" rotate={8} size={16} />
            </div>
            <OfferStack ctx={ctx} tone="light" titleSize={7.6} />
          </div>
        </div>
      );
    },
  },
  {
    id: "snowfall",
    label: "Snowfall",
    tags: ["image_first", "dark", "gradient"],
    render: (ctx) => {
      const { content, brand } = ctx;
      return (
        <div style={{ ...base(brand), background: "#0b1626" }}>
          <Img src={content.imageDataUrl} video={content.videoDataUrl} style={{ opacity: 0.9 }} />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(to top, rgba(9,20,36,.95) 16%, rgba(9,20,36,.2) 62%)",
            }}
          />
          <Snowfall count={30} />
          <div
            style={{
              position: "absolute",
              inset: 0,
              padding: px(5),
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <BizRow ctx={ctx} tone="light" />
            <OfferStack ctx={ctx} tone="light" titleSize={8} />
          </div>
        </div>
      );
    },
  },
  {
    id: "frostpanel",
    label: "Frost",
    tags: ["glass", "light", "image_first"],
    render: (ctx) => {
      const { content, brand } = ctx;
      return (
        <div style={{ ...base(brand), background: "#16324d" }}>
          <Img src={content.imageDataUrl} video={content.videoDataUrl} />
          <div
            style={{
              position: "absolute",
              inset: 0,
              padding: px(5),
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <BizRow ctx={ctx} tone="light" />
            <div
              style={{
                background: "rgba(226,240,255,0.82)",
                border: "1px solid rgba(255,255,255,0.7)",
                borderRadius: px(4),
                padding: px(5),
                backdropFilter: "blur(8px)",
              }}
            >
              <OfferStack ctx={ctx} tone="dark" titleSize={6.6} />
            </div>
          </div>
        </div>
      );
    },
  },
  {
    id: "alpine",
    label: "Alpine",
    tags: ["light", "minimal", "image_first"],
    render: (ctx) => {
      const { content, brand } = ctx;
      const snow = bgOr(brand, "#eef5fb");
      return (
        <div style={{ ...base(brand), background: snow, display: "flex", flexDirection: "column" }}>
          <div style={{ position: "relative", flex: "0 1 52%", minHeight: 0 }}>
            <Img src={content.imageDataUrl} video={content.videoDataUrl} />
            <Snowfall count={18} color="rgba(255,255,255,0.9)" />
          </div>
          {/* a snow line running under the picture */}
          <Scallop color={snow} size={8} count={7} />
          <div style={{ flex: 1, padding: `${px(2.6)} ${px(5)} ${px(5)}` }}>
            <OfferStack ctx={ctx} tone="dark" titleSize={7} />
          </div>
        </div>
      );
    },
  },
  {
    id: "icebadge",
    label: "Ice",
    tags: ["centered", "gradient", "bold"],
    render: (ctx) => {
      const { content, brand } = ctx;
      return (
        <div
          style={{
            ...base(brand),
            background: `linear-gradient(170deg, #9fd3f2, ${brand.primary} 72%)`,
          }}
        >
          <Snowfall count={22} color="rgba(255,255,255,0.7)" />
          <div
            style={{
              position: "absolute",
              left: px(6),
              right: px(6),
              top: "17%",
              height: "36%",
              overflow: "hidden",
              borderRadius: px(4),
            }}
          >
            <Img src={content.imageDataUrl} video={content.videoDataUrl} />
          </div>
          <div
            style={{
              position: "absolute",
              inset: 0,
              padding: px(5),
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <BizRow ctx={ctx} tone="light" />
            <span
              style={{
                marginTop: "auto",
                padding: `${px(0.8)} ${px(3)}`,
                borderRadius: px(9),
                background: "rgba(255,255,255,0.9)",
                color: brand.primary,
                fontWeight: 800,
                fontSize: px(2.2),
                letterSpacing: "0.16em",
                fontFamily: fontSecondary(brand),
              }}
            >
              OFERTA DIMËRORE
            </span>
            <OfferStack ctx={ctx} tone="light" titleSize={7.2} align="center" />
          </div>
        </div>
      );
    },
  },
  {
    id: "festivenight",
    label: "Festive",
    tags: ["luxury", "dark", "centered"],
    render: (ctx) => {
      const { content, brand } = ctx;
      return (
        <div style={{ ...base(brand), background: "#0a1430" }}>
          <Img src={content.imageDataUrl} video={content.videoDataUrl} style={{ opacity: 0.5 }} />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "radial-gradient(110% 80% at 50% 30%, rgba(20,40,90,.5), rgba(6,12,30,.96))",
            }}
          />
          <Snowfall count={26} color={`${brand.accent}cc`} />
          <div
            style={{ position: "absolute", inset: px(4), border: `1px solid ${brand.accent}77` }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              padding: px(7),
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "space-between",
              textAlign: "center",
            }}
          >
            <BizRow ctx={ctx} tone="light" />
            <OfferStack
              ctx={ctx}
              tone="light"
              titleSize={7.8}
              align="center"
              kickerColor={brand.accent}
              chips={false}
            />
          </div>
        </div>
      );
    },
  },
  {
    id: "snowcap",
    label: "Snow Cap",
    tags: ["light", "image_first", "whitespace"],
    render: (ctx) => {
      const { content, brand } = ctx;
      return (
        <div
          style={{
            ...base(brand),
            background: bgOr(brand, "#ffffff"),
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ padding: `${px(5)} ${px(5)} ${px(2.5)}` }}>
            <BizRow ctx={ctx} tone="dark" />
          </div>
          <div
            style={{
              position: "relative",
              flex: "0 1 46%",
              minHeight: 0,
              margin: `0 ${px(5)}`,
              overflow: "hidden",
              borderRadius: px(2.4),
            }}
          >
            <Img src={content.imageDataUrl} video={content.videoDataUrl} />
            <div style={{ position: "absolute", left: 0, right: 0, top: 0 }}>
              <Scallop color={INK.onDark} size={6} count={8} flip />
            </div>
          </div>
          <div style={{ flex: 1, padding: `${px(3.6)} ${px(5)} ${px(5)}` }}>
            <OfferStack ctx={ctx} tone="dark" titleSize={6.8} />
          </div>
        </div>
      );
    },
  },
  {
    id: "skipass",
    label: "Ski Pass",
    tags: ["dense", "light", "bold"],
    render: (ctx) => {
      const { content, brand } = ctx;
      return (
        <div
          style={{
            ...base(brand),
            background: bgOr(brand, "#e8f1f8"),
            padding: px(5),
            display: "flex",
          }}
        >
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              background: "#fff",
              borderRadius: px(2.4),
              overflow: "hidden",
              boxShadow: `0 ${px(1.8)} ${px(5)} rgba(12,32,54,0.16)`,
            }}
          >
            <div
              style={{
                background: brand.primary,
                padding: `${px(2.6)} ${px(4)}`,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <BizRow ctx={ctx} tone="light" />
              <span
                style={{
                  fontSize: px(2.2),
                  fontWeight: 800,
                  letterSpacing: "0.2em",
                  color: INK.onDarkBody,
                  fontFamily: fontSecondary(brand),
                }}
              >
                SEASON PASS
              </span>
            </div>
            <div style={{ position: "relative", flex: "0 1 40%", minHeight: 0 }}>
              <Img src={content.imageDataUrl} video={content.videoDataUrl} />
              <Snowfall count={14} />
            </div>
            <div
              style={{
                padding: `${px(3.6)} ${px(4)}`,
                display: "flex",
                flexDirection: "column",
                gap: px(2.6),
              }}
            >
              <OfferStack
                ctx={ctx}
                tone="dark"
                titleSize={6.2}
                chips={false}
                extra={false}
                contact={false}
              />
              <div style={{ display: "flex", gap: px(3.6), flexWrap: "wrap" }}>
                <TicketField ctx={ctx} label="Datat" value={content.date} tone="dark" />
                <TicketField ctx={ctx} label="Netë" value={content.meta1} tone="dark" />
                <TicketField ctx={ctx} label="Hotel" value={content.location} tone="dark" />
              </div>
              <ContactLine ctx={ctx} tone="dark" />
            </div>
          </div>
        </div>
      );
    },
  },
  {
    id: "nordicband",
    label: "Nordic",
    tags: ["editorial", "light", "dense"],
    render: (ctx) => {
      const { content, brand } = ctx;
      const band = `repeating-linear-gradient(135deg, ${brand.primary} 0 ${px(1.6)}, transparent ${px(1.8)} ${px(3.6)})`;
      return (
        <div
          style={{
            ...base(brand),
            background: bgOr(brand, "#f7fbff"),
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ height: px(4), background: band }} />
          <div style={{ position: "relative", flex: "0 1 46%", minHeight: 0 }}>
            <Img src={content.imageDataUrl} video={content.videoDataUrl} />
          </div>
          <div style={{ flex: 1, padding: px(5) }}>
            <OfferStack ctx={ctx} tone="dark" titleSize={7} />
          </div>
          <div style={{ height: px(4), background: band }} />
        </div>
      );
    },
  },
  {
    id: "frozenframe",
    label: "Frozen Frame",
    tags: ["minimal", "dark", "image_first"],
    render: (ctx) => {
      const { content, brand } = ctx;
      return (
        <div style={{ ...base(brand), background: "#0d1c2e" }}>
          <Img src={content.imageDataUrl} video={content.videoDataUrl} style={{ opacity: 0.86 }} />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(to top, rgba(10,22,38,.92) 18%, transparent 58%)",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: px(4.5),
              border: `${px(0.4)} solid rgba(255,255,255,0.85)`,
              borderRadius: px(1.2),
            }}
          />
          <Snowfall count={16} />
          <div
            style={{
              position: "absolute",
              inset: 0,
              padding: px(7),
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <BizRow ctx={ctx} tone="light" />
            <OfferStack ctx={ctx} tone="light" titleSize={7.6} chips={false} />
          </div>
        </div>
      );
    },
  },
  {
    id: "newyear",
    label: "New Year",
    tags: ["bold", "dark", "type_first"],
    render: (ctx) => {
      const { content, brand } = ctx;
      return (
        <div
          style={{
            ...base(brand),
            background: `linear-gradient(165deg, #101a3a, ${brand.primary})`,
          }}
        >
          <Img src={content.imageDataUrl} video={content.videoDataUrl} style={{ opacity: 0.35 }} />
          <Snowfall count={34} color={`${brand.accent}bb`} />
          <div
            style={{
              position: "absolute",
              inset: 0,
              padding: px(5),
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <BizRow ctx={ctx} tone="light" />
              <span
                style={{
                  padding: `${px(0.8)} ${px(2.6)}`,
                  borderRadius: px(1.2),
                  border: `1px solid ${brand.accent}`,
                  color: brand.accent,
                  fontWeight: 800,
                  fontSize: px(2.2),
                  letterSpacing: "0.18em",
                  fontFamily: fontSecondary(brand),
                }}
              >
                {content.date || "SEZONI"}
              </span>
            </div>
            <OfferStack
              ctx={ctx}
              tone="light"
              titleSize={9.4}
              gap={2.2}
              kickerColor={brand.accent}
            />
          </div>
        </div>
      );
    },
  },
  {
    id: "appscreen",
    label: "App Screen",
    tags: ["light", "dense", "minimal"],
    render: (ctx) => (
      <div
        style={{ ...base(ctx.brand), background: "#fff", display: "flex", flexDirection: "column" }}
      >
        <AppScreen ctx={ctx} />
      </div>
    ),
  },
  {
    id: "phonemock",
    label: "Phone",
    tags: ["light", "image_first", "whitespace"],
    render: (ctx) => {
      const { content, brand } = ctx;
      return (
        <div
          style={{
            ...base(brand),
            background: `linear-gradient(165deg, ${brand.primary}26, ${brand.secondary}14 46%, #ffffff)`,
            padding: `${px(5)} ${px(5)} 0`,
            display: "flex",
            flexDirection: "column",
            gap: px(2.6),
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <BizRow ctx={ctx} tone="dark" />
            <span
              style={{
                fontSize: px(1.8),
                fontWeight: 700,
                letterSpacing: "0.2em",
                color: brand.primary,
                fontFamily: fontSecondary(brand),
              }}
            >
              {(content.date || "").toUpperCase()}
            </span>
          </div>
          <HeadlineTwoTone ctx={ctx} size={7.2} color={INK.strong} accent={brand.primary} />
          <ServiceLine ctx={ctx} tone="dark" />
          {/* the handset itself: bezel, notch and a screen with the same layout */}
          <div
            style={{
              position: "relative",
              flex: 1,
              margin: `0 ${px(7)}`,
              marginBottom: `-${px(6)}`,
              background: "#0d1218",
              borderRadius: `${px(7)} ${px(7)} 0 0`,
              padding: px(0.8),
              paddingBottom: 0,
              boxShadow: `0 ${px(2.6)} ${px(7)} rgba(13,32,48,0.32)`,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "relative",
                height: "100%",
                background: "#fff",
                borderRadius: `${px(7)} ${px(7)} 0 0`,
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <span
                style={{
                  position: "absolute",
                  left: "50%",
                  top: px(1.2),
                  marginLeft: `-${px(6)}`,
                  width: px(12),
                  height: px(2.6),
                  borderRadius: px(9),
                  background: "#0d1218",
                  zIndex: 2,
                }}
              />
              <AppScreen ctx={ctx} compact />
            </div>
          </div>
        </div>
      );
    },
  },
  {
    id: "re_editorial",
    label: "Editorial",
    tags: ["editorial", "light", "whitespace"],
    render: (ctx) => (
      <div
        style={{
          ...base(ctx.brand),
          background: bgOr(ctx.brand, "#f7f5f1"),
          padding: px(5),
          display: "flex",
          flexDirection: "column",
          gap: px(2.6),
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <BizRow ctx={ctx} tone="dark" />
          <StatusTag ctx={ctx} tone="dark" />
        </div>
        <div style={{ position: "relative", flex: "0 1 48%", minHeight: 0, overflow: "hidden" }}>
          <PhotoLayer ctx={ctx} />
        </div>
        <ListingTitle ctx={ctx} size={6.4} tone="dark" />
        <SpecRow ctx={ctx} tone="dark" />
        <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: px(1.8) }}>
          <AskingPrice ctx={ctx} tone="dark" size={7} />
          <AgentFoot ctx={ctx} tone="dark" />
        </div>
      </div>
    ),
  },
  {
    id: "re_sidebar",
    label: "Sidebar",
    tags: ["editorial", "light", "dense"],
    render: (ctx) => (
      <div style={{ ...base(ctx.brand), background: bgOr(ctx.brand, "#efece6"), display: "flex" }}>
        <div style={{ position: "relative", flex: "0 1 56%", minHeight: 0 }}>
          <PhotoLayer ctx={ctx} />
        </div>
        <div
          style={{
            flex: 1,
            padding: px(3.6),
            display: "flex",
            flexDirection: "column",
            gap: px(1.8),
          }}
        >
          <BizRow ctx={ctx} tone="dark" />
          <ListingTitle ctx={ctx} size={4.2} tone="dark" />
          <FeatureList ctx={ctx} tone="dark" columns={1} />
          <div
            style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: px(1.8) }}
          >
            <SpecRow ctx={ctx} tone="dark" />
            <AskingPrice ctx={ctx} tone="dark" size={5.4} />
            <ContactLine ctx={ctx} tone="dark" />
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "re_darkluxe",
    label: "Dark Luxe",
    tags: ["luxury", "dark", "centered"],
    render: (ctx) => (
      <div style={{ ...base(ctx.brand), background: shade(ctx.brand.primary, 0.82) }}>
        <PhotoLayer ctx={ctx} treatment="scrimBoth" />
        <div
          style={{
            position: "absolute",
            inset: px(3.6),
            border: `1px solid ${alpha(ctx.brand.accent, 0.55)}`,
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            padding: px(7),
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "space-between",
            textAlign: "center",
          }}
        >
          <BizRow ctx={ctx} tone="light" />
          <div
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: px(1.8) }}
          >
            <StatusTag ctx={ctx} tone="light" />
            <ListingTitle ctx={ctx} size={6.4} tone="light" align="center" />
            <SpecRow ctx={ctx} tone="light" align="center" />
          </div>
          <AskingPrice ctx={ctx} tone="light" size={7} align="center" />
        </div>
      </div>
    ),
  },
  {
    id: "re_specband",
    label: "Spec Band",
    tags: ["dense", "light", "image_first"],
    render: (ctx) => (
      <div
        style={{
          ...base(ctx.brand),
          background: "#ffffff",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ position: "relative", flex: "0 1 52%", minHeight: 0 }}>
          <PhotoLayer ctx={ctx} treatment="scrimTop" strength={0.6} />
          <div
            style={{
              position: "absolute",
              left: px(3.6),
              top: px(3.6),
              right: px(3.6),
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <BizRow ctx={ctx} tone="light" />
            <StatusTag ctx={ctx} tone="light" />
          </div>
        </div>
        <div style={{ background: ctx.brand.primary, padding: `${px(2.6)} ${px(3.6)}` }}>
          <SpecRow ctx={ctx} tone="light" />
        </div>
        <div
          style={{
            flex: 1,
            padding: px(3.6),
            display: "flex",
            flexDirection: "column",
            gap: px(1.8),
          }}
        >
          <ListingTitle ctx={ctx} size={5.4} tone="dark" />
          <FeatureList ctx={ctx} tone="dark" />
          <div
            style={{
              marginTop: "auto",
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
              gap: px(1.8),
            }}
          >
            <AskingPrice ctx={ctx} tone="dark" size={5.4} />
            <ContactLine ctx={ctx} tone="dark" />
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "re_floatcard",
    label: "Float Card",
    tags: ["image_first", "light", "minimal"],
    render: (ctx) => (
      <div style={{ ...base(ctx.brand), background: bgOr(ctx.brand, "#eeeae3") }}>
        <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: "62%" }}>
          <PhotoLayer ctx={ctx} />
        </div>
        <div
          style={{
            position: "absolute",
            left: px(5),
            right: px(5),
            bottom: px(5),
            background: "#ffffff",
            padding: px(3.6),
            display: "flex",
            flexDirection: "column",
            gap: px(1.8),
            boxShadow: ELEVATION.mid(px),
          }}
        >
          <StatusTag ctx={ctx} tone="dark" />
          <ListingTitle ctx={ctx} size={5.4} tone="dark" />
          <SpecRow ctx={ctx} tone="dark" />
          <AskingPrice ctx={ctx} tone="dark" size={5.4} />
          <AgentFoot ctx={ctx} tone="dark" />
        </div>
      </div>
    ),
  },
  {
    id: "re_bonecard",
    label: "Bone",
    tags: ["whitespace", "light", "minimal"],
    render: (ctx) => (
      <div
        style={{
          ...base(ctx.brand),
          background: bgOr(ctx.brand, "#f3efe8"),
          padding: px(7),
          display: "flex",
          flexDirection: "column",
          gap: px(3.6),
        }}
      >
        <BizRow ctx={ctx} tone="dark" />
        <div style={{ position: "relative", flex: "0 1 44%", minHeight: 0, overflow: "hidden" }}>
          <PhotoLayer ctx={ctx} />
        </div>
        <ListingTitle ctx={ctx} size={5.4} tone="dark" />
        <div
          style={{
            marginTop: "auto",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: px(2.6),
          }}
        >
          <SpecRow ctx={ctx} tone="dark" />
          <AskingPrice ctx={ctx} tone="dark" size={5.4} align="right" />
        </div>
        <ContactLine ctx={ctx} tone="dark" />
      </div>
    ),
  },
  {
    id: "re_splitprice",
    label: "Split Price",
    tags: ["bold", "image_first", "dense"],
    render: (ctx) => (
      <div
        style={{
          ...base(ctx.brand),
          background: ctx.brand.primary,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ position: "relative", flex: "0 1 58%", minHeight: 0 }}>
          <PhotoLayer ctx={ctx} />
          <div style={{ position: "absolute", left: px(3.6), top: px(3.6) }}>
            <StatusTag ctx={ctx} tone="light" />
          </div>
        </div>
        <div
          style={{
            flex: 1,
            padding: px(3.6),
            display: "flex",
            flexDirection: "column",
            gap: px(1.8),
          }}
        >
          <ListingTitle ctx={ctx} size={5.4} tone="light" />
          <SpecRow ctx={ctx} tone="light" />
          <div
            style={{
              marginTop: "auto",
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
              gap: px(1.8),
            }}
          >
            <AskingPrice ctx={ctx} tone="light" size={7} />
            <BizRow ctx={ctx} tone="light" />
          </div>
          <ContactLine ctx={ctx} tone="light" />
        </div>
      </div>
    ),
  },
  {
    id: "re_sheet",
    label: "Listing Sheet",
    tags: ["dense", "light", "editorial"],
    render: (ctx) => (
      <div
        style={{
          ...base(ctx.brand),
          background: "#ffffff",
          padding: px(5),
          display: "flex",
          flexDirection: "column",
          gap: px(1.8),
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <BizRow ctx={ctx} tone="dark" />
          <StatusTag ctx={ctx} tone="dark" />
        </div>
        <span style={{ height: 1, background: INK.faint }} />
        <ListingTitle ctx={ctx} size={5.4} tone="dark" />
        <div style={{ position: "relative", flex: "0 1 40%", minHeight: 0, overflow: "hidden" }}>
          <PhotoLayer ctx={ctx} />
        </div>
        <SpecRow ctx={ctx} tone="dark" />
        <span style={{ height: 1, background: INK.faint }} />
        <FeatureList ctx={ctx} tone="dark" columns={3} />
        <div
          style={{
            marginTop: "auto",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: px(1.8),
          }}
        >
          <ContactLine ctx={ctx} tone="dark" />
          <AskingPrice ctx={ctx} tone="dark" size={5.4} align="right" />
        </div>
      </div>
    ),
  },
  {
    id: "re_arch",
    label: "Arch",
    tags: ["editorial", "light", "centered"],
    render: (ctx) => (
      <div
        style={{
          ...base(ctx.brand),
          background: bgOr(ctx.brand, "#f2eee7"),
          padding: px(5),
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: px(2.6),
          textAlign: "center",
        }}
      >
        <BizRow ctx={ctx} tone="dark" />
        <div
          style={{
            position: "relative",
            flex: "0 1 50%",
            minHeight: 0,
            width: "100%",
            overflow: "hidden",
            borderRadius: "50% 50% 2% 2% / 34% 34% 2% 2%",
          }}
        >
          <PhotoLayer ctx={ctx} />
        </div>
        <ListingTitle ctx={ctx} size={5.4} tone="dark" align="center" />
        <SpecRow ctx={ctx} tone="dark" align="center" />
        <div
          style={{
            marginTop: "auto",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: px(1.2),
          }}
        >
          <AskingPrice ctx={ctx} tone="dark" size={5.4} align="center" />
          <ContactLine ctx={ctx} tone="dark" />
        </div>
      </div>
    ),
  },
  {
    id: "re_cornermarks",
    label: "Corner Marks",
    tags: ["minimal", "dark", "image_first"],
    render: (ctx) => (
      <div style={{ ...base(ctx.brand), background: shade(ctx.brand.primary, 0.86) }}>
        <PhotoLayer ctx={ctx} treatment="scrimBottom" />
        <CornerMarks color={alpha(ctx.brand.accent, 0.8)} />
        <div
          style={{
            position: "absolute",
            inset: 0,
            padding: px(7),
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}
          >
            <BizRow ctx={ctx} tone="light" />
            <StatusTag ctx={ctx} tone="light" />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: px(1.8) }}>
            <ListingTitle ctx={ctx} size={6.4} tone="light" />
            <SpecRow ctx={ctx} tone="light" />
            <AskingPrice ctx={ctx} tone="light" size={5.4} />
            <ContactLine ctx={ctx} tone="light" />
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "re_planlines",
    label: "Plan Lines",
    tags: ["minimal", "light", "dense"],
    render: (ctx) => {
      const rule = alpha(ctx.brand.primary, 0.14);
      return (
        <div
          style={{
            ...base(ctx.brand),
            background: "#fbfaf8",
            padding: px(5),
            display: "flex",
            flexDirection: "column",
            gap: px(2.6),
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `repeating-linear-gradient(0deg, ${rule} 0 1px, transparent 1px 9%), repeating-linear-gradient(90deg, ${rule} 0 1px, transparent 1px 14%)`,
            }}
          />
          <div
            style={{
              position: "relative",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <BizRow ctx={ctx} tone="dark" />
            <StatusTag ctx={ctx} tone="dark" />
          </div>
          <div style={{ position: "relative", flex: "0 1 46%", minHeight: 0, overflow: "hidden" }}>
            <PhotoLayer ctx={ctx} />
          </div>
          <div
            style={{ position: "relative", display: "flex", flexDirection: "column", gap: px(1.8) }}
          >
            <ListingTitle ctx={ctx} size={5.4} tone="dark" />
            <SpecRow ctx={ctx} tone="dark" />
            <FeatureList ctx={ctx} tone="dark" />
          </div>
          <div
            style={{
              position: "relative",
              marginTop: "auto",
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
              gap: px(1.8),
            }}
          >
            <AskingPrice ctx={ctx} tone="dark" size={5.4} />
            <ContactLine ctx={ctx} tone="dark" />
          </div>
        </div>
      );
    },
  },
  {
    id: "re_stackbands",
    label: "Bands",
    tags: ["dense", "bold", "image_first"],
    render: (ctx) => (
      <div
        style={{
          ...base(ctx.brand),
          background: "#ffffff",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ position: "relative", flex: "0 1 46%", minHeight: 0 }}>
          <PhotoLayer ctx={ctx} />
        </div>
        <div
          style={{
            background: shade(ctx.brand.primary, 0.72),
            padding: `${px(2.6)} ${px(3.6)}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: px(1.8),
          }}
        >
          <ListingTitle ctx={ctx} size={4.2} tone="light" />
          <AskingPrice ctx={ctx} tone="light" size={5.4} align="right" />
        </div>
        <div
          style={{
            flex: 1,
            padding: px(3.6),
            display: "flex",
            flexDirection: "column",
            gap: px(1.8),
          }}
        >
          <SpecRow ctx={ctx} tone="dark" />
          <FeatureList ctx={ctx} tone="dark" />
          <div style={{ marginTop: "auto" }}>
            <AgentFoot ctx={ctx} tone="dark" />
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "re_agentcard",
    label: "Agent",
    tags: ["light", "dense", "editorial"],
    render: (ctx) => (
      <div
        style={{
          ...base(ctx.brand),
          background: bgOr(ctx.brand, "#f1eee9"),
          padding: px(3.6),
          display: "flex",
          flexDirection: "column",
          gap: px(2.6),
        }}
      >
        <div style={{ position: "relative", flex: "0 1 50%", minHeight: 0, overflow: "hidden" }}>
          <PhotoLayer ctx={ctx} treatment="scrimBottom" strength={0.7} />
          <div style={{ position: "absolute", left: px(2.6), right: px(2.6), bottom: px(2.6) }}>
            <ListingTitle ctx={ctx} size={4.2} tone="light" />
          </div>
        </div>
        <SpecRow ctx={ctx} tone="dark" />
        <FeatureList ctx={ctx} tone="dark" />
        <div
          style={{
            marginTop: "auto",
            background: "#ffffff",
            padding: px(2.6),
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: px(1.8),
            boxShadow: ELEVATION.low(px),
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: px(0.4) }}>
            <BizRow ctx={ctx} tone="dark" />
            <ContactLine ctx={ctx} tone="dark" />
          </div>
          <AskingPrice ctx={ctx} tone="dark" size={4.2} align="right" />
        </div>
      </div>
    ),
  },
  {
    id: "re_quiet",
    label: "Quiet",
    tags: ["whitespace", "light", "minimal"],
    render: (ctx) => (
      <div
        style={{
          ...base(ctx.brand),
          background: "#ffffff",
          padding: px(7),
          display: "flex",
          flexDirection: "column",
          gap: px(2.6),
        }}
      >
        <BizRow ctx={ctx} tone="dark" />
        <div style={{ position: "relative", flex: "0 1 38%", minHeight: 0, overflow: "hidden" }}>
          <PhotoLayer ctx={ctx} />
        </div>
        <ListingTitle ctx={ctx} size={7} tone="dark" />
        <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: px(1.8) }}>
          <SpecRow ctx={ctx} tone="dark" />
          <AskingPrice ctx={ctx} tone="dark" size={5.4} />
          <ContactLine ctx={ctx} tone="dark" />
        </div>
      </div>
    ),
  },
  {
    id: "re_gallery",
    label: "Gallery",
    tags: ["image_first", "dense", "light"],
    render: (ctx) => (
      <div
        style={{
          ...base(ctx.brand),
          background: "#ffffff",
          padding: px(3.6),
          display: "flex",
          flexDirection: "column",
          gap: px(1.2),
        }}
      >
        <div style={{ position: "relative", flex: "0 1 40%", minHeight: 0, overflow: "hidden" }}>
          <PhotoLayer ctx={ctx} />
        </div>
        <div style={{ display: "flex", gap: px(1.2), height: px(20) }}>
          {["left center", "right center"].map((pos) => (
            <div key={pos} style={{ position: "relative", flex: 1, overflow: "hidden" }}>
              <Img
                src={ctx.content.imageDataUrl}
                video={ctx.content.videoDataUrl}
                style={{ objectPosition: pos }}
              />
            </div>
          ))}
        </div>
        <div
          style={{ paddingTop: px(1.8), display: "flex", flexDirection: "column", gap: px(1.8) }}
        >
          <ListingTitle ctx={ctx} size={4.2} tone="dark" />
          <SpecRow ctx={ctx} tone="dark" />
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
              gap: px(1.8),
            }}
          >
            <AskingPrice ctx={ctx} tone="dark" size={4.2} />
            <BizRow ctx={ctx} tone="dark" />
          </div>
          <ContactLine ctx={ctx} tone="dark" />
        </div>
      </div>
    ),
  },
  {
    id: "re_goldrule",
    label: "Gold Rule",
    tags: ["luxury", "dark", "editorial"],
    render: (ctx) => (
      <div style={{ ...base(ctx.brand), background: shade(ctx.brand.primary, 0.88) }}>
        <PhotoLayer ctx={ctx} treatment="duotone" strength={0.58} grain />
        <div
          style={{
            position: "absolute",
            inset: 0,
            padding: px(7),
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: px(1.2) }}>
            <BizRow ctx={ctx} tone="light" />
            <span style={{ height: 1, background: alpha(ctx.brand.accent, 0.7) }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: px(1.8) }}>
            <StatusTag ctx={ctx} tone="light" />
            <ListingTitle ctx={ctx} size={7} tone="light" />
            <span style={{ height: 1, background: alpha(ctx.brand.accent, 0.7), width: "38%" }} />
            <SpecRow ctx={ctx} tone="light" />
            <AskingPrice ctx={ctx} tone="light" size={5.4} />
            <ContactLine ctx={ctx} tone="light" />
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "re_openhouse",
    label: "Open House",
    tags: ["bold", "light", "type_first"],
    render: (ctx) => (
      <div
        style={{
          ...base(ctx.brand),
          background: bgOr(ctx.brand, "#f6f3ee"),
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            padding: `${px(5)} ${px(5)} ${px(2.6)}`,
            display: "flex",
            flexDirection: "column",
            gap: px(1.2),
          }}
        >
          <BizRow ctx={ctx} tone="dark" />
          <span
            style={{
              fontSize: px(1.8),
              fontWeight: WEIGHT.bold,
              letterSpacing: TRACK.wider,
              textTransform: "uppercase",
              color: accentColor(ctx),
              fontFamily: fontSecondary(ctx.brand),
            }}
          >
            {ctx.content.labels?.["date"] ?? "Available"}
          </span>
          <FitText
            as="div"
            text={ctx.content.date || ctx.content.subject || ""}
            maxSize={9}
            minSize={4.2}
            maxLines={1}
            lineHeight={1}
            style={{
              fontWeight: WEIGHT.heavy,
              letterSpacing: TRACK.tight,
              color: INK.strong,
              fontFamily: font(ctx.brand),
            }}
          />
        </div>
        <div style={{ position: "relative", flex: "0 1 42%", minHeight: 0 }}>
          <PhotoLayer ctx={ctx} />
        </div>
        <div
          style={{
            flex: 1,
            padding: px(3.6),
            display: "flex",
            flexDirection: "column",
            gap: px(1.8),
          }}
        >
          <ListingTitle ctx={ctx} size={4.2} tone="dark" />
          <SpecRow ctx={ctx} tone="dark" />
          <div
            style={{
              marginTop: "auto",
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
              gap: px(1.8),
            }}
          >
            <AskingPrice ctx={ctx} tone="dark" size={4.2} />
            <ContactLine ctx={ctx} tone="dark" />
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "re_priceflag",
    label: "Price Flag",
    tags: ["bold", "image_first", "dark"],
    render: (ctx) => (
      <div style={{ ...base(ctx.brand), background: shade(ctx.brand.primary, 0.8) }}>
        <PhotoLayer ctx={ctx} treatment="scrimBottom" strength={0.9} />
        <div
          style={{
            position: "absolute",
            right: 0,
            top: "16%",
            background: ctx.brand.accent,
            padding: `${px(1.8)} ${px(3.6)} ${px(1.8)} ${px(2.6)}`,
          }}
        >
          <AskingPrice ctx={ctx} tone="dark" size={5.4} />
        </div>
        <div
          style={{
            position: "absolute",
            inset: 0,
            padding: px(5),
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <BizRow ctx={ctx} tone="light" />
          <div style={{ display: "flex", flexDirection: "column", gap: px(1.8) }}>
            <StatusTag ctx={ctx} tone="light" />
            <ListingTitle ctx={ctx} size={6.4} tone="light" />
            <SpecRow ctx={ctx} tone="light" />
            <ContactLine ctx={ctx} tone="light" />
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "re_frame",
    label: "Frame",
    tags: ["editorial", "light", "whitespace"],
    render: (ctx) => (
      <div style={{ ...base(ctx.brand), background: bgOr(ctx.brand, "#eceae5"), padding: px(5) }}>
        <div
          style={{
            height: "100%",
            border: `1px solid ${alpha(ctx.brand.primary, 0.35)}`,
            padding: px(3.6),
            display: "flex",
            flexDirection: "column",
            gap: px(2.6),
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <BizRow ctx={ctx} tone="dark" />
            <StatusTag ctx={ctx} tone="dark" />
          </div>
          <div style={{ position: "relative", flex: "0 1 44%", minHeight: 0, overflow: "hidden" }}>
            <PhotoLayer ctx={ctx} />
          </div>
          <ListingTitle ctx={ctx} size={5.4} tone="dark" />
          <SpecRow ctx={ctx} tone="dark" />
          <div
            style={{
              marginTop: "auto",
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
              gap: px(1.8),
            }}
          >
            <AskingPrice ctx={ctx} tone="dark" size={5.4} />
            <ContactLine ctx={ctx} tone="dark" />
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "re_signature",
    label: "Signature",
    tags: ["image_first", "dark", "bold"],
    render: (ctx) => (
      <div
        style={{
          ...base(ctx.brand),
          background: shade(ctx.brand.primary, 0.84),
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ position: "relative", flex: "0 1 56%", minHeight: 0 }}>
          <PhotoLayer ctx={ctx} treatment="scrimTop" strength={0.5} />
          <div
            style={{
              position: "absolute",
              left: px(3.6),
              top: px(3.6),
              right: px(3.6),
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <BizRow ctx={ctx} tone="light" />
            <StatusTag ctx={ctx} tone="light" />
          </div>
        </div>
        <div
          style={{
            flex: 1,
            padding: px(5),
            display: "flex",
            flexDirection: "column",
            gap: px(1.8),
          }}
        >
          <ListingTitle ctx={ctx} size={5.4} tone="light" />
          <SpecRow ctx={ctx} tone="light" />
          <FeatureList ctx={ctx} tone="light" />
          <div
            style={{
              marginTop: "auto",
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
              gap: px(1.8),
            }}
          >
            <AskingPrice ctx={ctx} tone="light" size={5.4} />
            <ContactLine ctx={ctx} tone="light" />
          </div>
        </div>
      </div>
    ),
  },

  /* ------------------------------ video designs ----------------------------- */

  /**
   * Twenty designs for a travel agency's footage.
   *
   * A clip is 9:16 and the picture is the whole reason anyone stops on it, so
   * these hold the middle of the frame open and work at the edges: a band along
   * the foot, a rail down one side, a card in a corner. The scrims are the same
   * PhotoLayer the posters use, so a brand's video and its post still read as
   * one set.
   */
  {
    id: "tv_lowerthird",
    label: "Lower Third",
    tags: ["image_first", "minimal"],
    render: (ctx) => (
      <Stage ctx={ctx} treatment="scrimBottom">
        <BizRow ctx={ctx} tone="light" />
        <AdjustBox
          ctx={ctx}
          style={{ display: "flex", flexDirection: "column", gap: px(1.8), width: "100%" }}
        >
          <Kicker ctx={ctx} color={ctx.brand.accent} />
          <Title ctx={ctx} size={8} color={INK.onDark} />
          <ServiceLine ctx={ctx} tone="light" />
          <CtaBar ctx={ctx} tone="dark" />
          <ContactLine ctx={ctx} tone="light" />
        </AdjustBox>
      </Stage>
    ),
  },
  {
    id: "tv_topbar",
    label: "Top Bar",
    tags: ["image_first", "bold"],
    render: (ctx) => (
      <Stage ctx={ctx} treatment="scrimBottom" strength={0.7}>
        <Bleed
          style={{
            paddingBlock: px(2.6),
            background: accentColor(ctx),
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: px(2.6),
          }}
        >
          <BizRow ctx={ctx} tone="light" />
          <Kicker ctx={ctx} color={INK.onDarkBody} />
        </Bleed>
        <AdjustBox
          ctx={ctx}
          style={{ display: "flex", flexDirection: "column", gap: px(1.8), width: "100%" }}
        >
          <Title ctx={ctx} size={7} color={INK.onDark} />
          <PriceBadge ctx={ctx} tone="light" />
          <ContactLine ctx={ctx} tone="light" />
        </AdjustBox>
      </Stage>
    ),
  },
  {
    id: "tv_ticketcard",
    label: "Ticket",
    tags: ["image_first", "dense"],
    render: (ctx) => (
      <Stage ctx={ctx} treatment="scrimBottom" strength={0.8}>
        <BizRow ctx={ctx} tone="light" />
        <AdjustBox
          ctx={ctx}
          style={{
            width: "100%",
            background: "#ffffff",
            borderRadius: px(2.4),
            overflow: "hidden",
            boxShadow: ELEVATION.high(px),
          }}
        >
          <div style={{ padding: px(3.6), display: "flex", flexDirection: "column", gap: px(2.6) }}>
            <RouteCodes ctx={ctx} color={INK.strong} muted={INK.muted} />
            <div style={{ display: "flex", gap: px(3.6) }}>
              <TicketField
                ctx={ctx}
                label={ctx.content.labels?.["date"] ?? "Date"}
                value={ctx.content.date}
                tone="dark"
              />
              <TicketField
                ctx={ctx}
                label={ctx.content.labels?.["price"] ?? "Fare"}
                value={formatPrice(ctx.content.price, ctx.brand.currency)}
                tone="dark"
              />
            </div>
          </div>
          <Perforation color={alpha(INK.strong, 0.16)} />
          <div
            style={{
              padding: `${px(2.6)} ${px(3.6)}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: px(2.6),
            }}
          >
            <Barcode color={INK.strong} />
            <CtaTag ctx={ctx} tone="dark" />
          </div>
        </AdjustBox>
      </Stage>
    ),
  },
  {
    id: "tv_routearc",
    label: "Route",
    tags: ["image_first", "editorial"],
    render: (ctx) => (
      <Stage ctx={ctx} treatment="scrimBoth">
        <div style={{ display: "flex", flexDirection: "column", gap: px(2.6), width: "100%" }}>
          <BizRow ctx={ctx} tone="light" />
          <RouteCodes ctx={ctx} color={INK.onDark} muted={INK.onDarkMuted} />
        </div>
        <AdjustBox
          ctx={ctx}
          style={{ display: "flex", flexDirection: "column", gap: px(1.8), width: "100%" }}
        >
          <Title ctx={ctx} size={7} color={INK.onDark} />
          <CtaBar ctx={ctx} tone="dark" />
        </AdjustBox>
      </Stage>
    ),
  },
  {
    id: "tv_siderail",
    label: "Side Rail",
    tags: ["minimal", "image_first"],
    render: (ctx) => (
      <div style={{ ...base(ctx.brand), color: INK.onDark }}>
        <PhotoLayer ctx={ctx} treatment="scrimBottom" />
        <span
          style={{
            position: "absolute",
            left: px(3.6),
            top: px(7),
            writingMode: "vertical-rl",
            fontSize: px(2.2),
            fontWeight: WEIGHT.bold,
            letterSpacing: TRACK.wider,
            textTransform: "uppercase",
            color: INK.onDarkMuted,
            fontFamily: fontSecondary(ctx.brand),
          }}
        >
          {ctx.content.subject || ctx.businessName}
        </span>
        <AdjustBox
          ctx={ctx}
          style={{
            position: "absolute",
            left: px(10),
            right: px(5),
            bottom: px(7),
            display: "flex",
            flexDirection: "column",
            gap: px(1.8),
          }}
        >
          <Title ctx={ctx} size={7} color={INK.onDark} />
          <ServiceLine ctx={ctx} tone="light" />
          <PriceBadge ctx={ctx} tone="light" />
        </AdjustBox>
      </div>
    ),
  },
  {
    id: "tv_footblock",
    label: "Foot Block",
    tags: ["bold", "image_first"],
    render: (ctx) => (
      <Stage ctx={ctx} treatment="scrimBottom" strength={0.5}>
        <BizRow ctx={ctx} tone="light" />
        <Bleed
          style={{
            paddingBlock: px(3.6),
            background: deepGround(ctx.brand),
            display: "flex",
            flexDirection: "column",
            gap: px(2.6),
          }}
        >
          <AdjustBox ctx={ctx} style={{ display: "flex", flexDirection: "column", gap: px(1.8) }}>
            <HeadlineTwoTone ctx={ctx} size={6.4} color={INK.onDark} accent={ctx.brand.accent} />
            <FeatureBoxes ctx={ctx} tone="light" columns={2} limit={2} />
          </AdjustBox>
          <CtaBar ctx={ctx} tone="light" />
          <ContactLine ctx={ctx} tone="light" />
        </Bleed>
      </Stage>
    ),
  },
  {
    id: "tv_hairframe",
    label: "Hair Frame",
    tags: ["minimal", "whitespace"],
    render: (ctx) => (
      <div style={{ ...base(ctx.brand), color: INK.onDark }}>
        <PhotoLayer ctx={ctx} treatment="scrimBoth" strength={0.8} />
        <span
          style={{
            position: "absolute",
            inset: px(3.6),
            border: `1px solid ${INK.onDarkFaint}`,
          }}
        />
        <CornerMarks color={INK.onDark} inset={3.6} len={4} />
        <div
          style={{
            position: "absolute",
            inset: 0,
            padding: px(7),
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "space-between",
            textAlign: "center",
          }}
        >
          <Kicker ctx={ctx} color={INK.onDarkBody} />
          <AdjustBox
            ctx={ctx}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: px(2.6),
              width: "100%",
            }}
          >
            <Title ctx={ctx} size={8} color={INK.onDark} />
            <PriceBadge ctx={ctx} tone="light" />
            <ContactLine ctx={ctx} tone="light" />
          </AdjustBox>
        </div>
      </div>
    ),
  },
  {
    id: "tv_pricepill",
    label: "Price Pill",
    tags: ["bold", "image_first"],
    render: (ctx) => {
      // The pill is the whole design, so it is drawn only when there is
      // something to put in it rather than sitting there empty.
      const pill = formatPrice(ctx.content.price, ctx.brand.currency) || ctx.content.cta.trim();
      return (
        <Stage ctx={ctx} treatment="scrimBottom" strength={0.75}>
          <BizRow ctx={ctx} tone="light" />
          <AdjustBox
            ctx={ctx}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: px(2.6),
              width: "100%",
              textAlign: "center",
            }}
          >
            <Title ctx={ctx} size={7} color={INK.onDark} />
            {pill ? (
              <span
                style={{
                  padding: `${px(2.6)} ${px(5)}`,
                  borderRadius: px(9),
                  background: accentColor(ctx),
                  fontSize: px(5.4),
                  fontWeight: WEIGHT.heavy,
                  letterSpacing: TRACK.tight,
                  fontFamily: font(ctx.brand),
                  color: INK.onDark,
                }}
              >
                {pill}
              </span>
            ) : null}
            <ContactLine ctx={ctx} tone="light" />
          </AdjustBox>
        </Stage>
      );
    },
  },
  {
    id: "tv_stampcorner",
    label: "Stamp",
    tags: ["editorial", "image_first"],
    render: (ctx) => (
      <div style={{ ...base(ctx.brand), color: INK.onDark }}>
        <PhotoLayer ctx={ctx} treatment="scrimBottom" />
        <div style={{ position: "absolute", right: px(5), top: px(7) }}>
          <Stamp ctx={ctx} color={INK.onDarkBody} size={24} />
        </div>
        <div style={{ position: "absolute", left: px(5), top: px(7) }}>
          <BizRow ctx={ctx} tone="light" />
        </div>
        <AdjustBox
          ctx={ctx}
          style={{
            position: "absolute",
            insetInline: px(5),
            bottom: px(7),
            display: "flex",
            flexDirection: "column",
            gap: px(1.8),
          }}
        >
          <Title ctx={ctx} size={7} color={INK.onDark} />
          <ServiceLine ctx={ctx} tone="light" />
          <PriceBadge ctx={ctx} tone="light" />
        </AdjustBox>
      </div>
    ),
  },
  {
    id: "tv_splitfoot",
    label: "Split Foot",
    tags: ["editorial", "dense"],
    render: (ctx) => (
      <Stage ctx={ctx} treatment="scrimTop" strength={0.7}>
        <BizRow ctx={ctx} tone="light" />
        <Bleed
          style={{
            paddingBlock: px(3.6),
            background: bgOr(ctx.brand, "#ffffff"),
            display: "flex",
            flexDirection: "column",
            gap: px(2.6),
          }}
        >
          <AdjustBox ctx={ctx} style={{ display: "flex", flexDirection: "column", gap: px(1.2) }}>
            <Kicker ctx={ctx} color={accentColor(ctx)} />
            <Title ctx={ctx} size={5.4} color={INK.strong} />
          </AdjustBox>
          <StopList ctx={ctx} tone="dark" />
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
              gap: px(1.8),
            }}
          >
            <PriceBadge ctx={ctx} tone="dark" />
            <ContactLine ctx={ctx} tone="dark" />
          </div>
        </Bleed>
      </Stage>
    ),
  },
  {
    id: "tv_marquee",
    label: "Marquee",
    tags: ["bold", "image_first"],
    render: (ctx) => {
      const word = (ctx.content.subject || ctx.content.location || ctx.businessName).toUpperCase();
      return (
        <Stage ctx={ctx} treatment="scrimBottom">
          <BizRow ctx={ctx} tone="light" />
          <div style={{ display: "flex", flexDirection: "column", gap: px(2.6), width: "100%" }}>
            <Bleed
              style={{
                paddingBlock: px(1.2),
                background: accentColor(ctx),
                display: "flex",
                alignItems: "center",
                gap: px(2.6),
                overflow: "hidden",
                whiteSpace: "nowrap",
              }}
            >
              {Array.from({ length: 6 }, (_, i) => (
                <span
                  key={i}
                  style={{
                    fontSize: px(1.8),
                    fontWeight: WEIGHT.heavy,
                    letterSpacing: TRACK.wide,
                    color: INK.onDark,
                    fontFamily: fontSecondary(ctx.brand),
                  }}
                >
                  {word}
                </span>
              ))}
            </Bleed>
            <AdjustBox ctx={ctx} style={{ display: "flex", flexDirection: "column", gap: px(1.8) }}>
              <Title ctx={ctx} size={7} color={INK.onDark} />
              <PriceBadge ctx={ctx} tone="light" />
            </AdjustBox>
          </div>
        </Stage>
      );
    },
  },
  {
    id: "tv_cornercard",
    label: "Corner Card",
    tags: ["minimal", "image_first"],
    render: (ctx) => (
      <Stage ctx={ctx} treatment="plain">
        <BizRow ctx={ctx} tone="light" />
        <AdjustBox
          ctx={ctx}
          style={{
            maxWidth: "78%",
            background: alpha("#ffffff", 0.94),
            borderRadius: px(2.4),
            padding: px(3.6),
            display: "flex",
            flexDirection: "column",
            gap: px(1.8),
            boxShadow: ELEVATION.mid(px),
          }}
        >
          <Kicker ctx={ctx} color={accentColor(ctx)} />
          <Title ctx={ctx} size={5.4} color={INK.strong} />
          <PriceBadge ctx={ctx} tone="dark" />
          <ContactLine ctx={ctx} tone="dark" />
        </AdjustBox>
      </Stage>
    ),
  },
  {
    id: "tv_sunband",
    label: "Sun Band",
    tags: ["gradient", "image_first"],
    render: (ctx) => (
      <div style={{ ...base(ctx.brand), color: INK.onDark }}>
        <PhotoLayer ctx={ctx} treatment="scrimTop" strength={0.6} />
        <SunDisc
          color={alpha(ctx.brand.accent, 0.9)}
          size={26}
          style={{ right: px(7), top: px(24) }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            padding: px(5),
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            gap: px(2.6),
          }}
        >
          <BizRow ctx={ctx} tone="light" />
          <div style={{ width: "100%" }}>
            <Bleed pad={5} style={{ paddingInline: 0 }}>
              <Scallop color={bgOr(ctx.brand, "#fffaf2")} size={7} count={9} />
            </Bleed>
            <Bleed
              style={{
                paddingBlock: `0 ${px(2.6)}`,
                background: bgOr(ctx.brand, "#fffaf2"),
                display: "flex",
                flexDirection: "column",
                gap: px(1.8),
              }}
            >
              <AdjustBox
                ctx={ctx}
                style={{ display: "flex", flexDirection: "column", gap: px(1.2) }}
              >
                <Title ctx={ctx} size={5.4} color={INK.strong} />
                <ServiceLine ctx={ctx} tone="dark" />
              </AdjustBox>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: px(1.8),
                }}
              >
                <PriceBadge ctx={ctx} tone="dark" />
                <CtaTag ctx={ctx} tone="dark" />
              </div>
            </Bleed>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "tv_boardingpass",
    label: "Boarding Pass",
    tags: ["dense", "editorial"],
    render: (ctx) => (
      <Stage ctx={ctx} treatment="wash" strength={0.55}>
        <BizRow ctx={ctx} tone="light" />
        <AdjustBox
          ctx={ctx}
          style={{
            width: "100%",
            background: "#ffffff",
            borderRadius: px(2.4),
            overflow: "hidden",
            boxShadow: ELEVATION.high(px),
          }}
        >
          <div
            style={{
              padding: `${px(2.6)} ${px(3.6)}`,
              background: accentColor(ctx),
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span
              style={{
                fontSize: px(2.2),
                fontWeight: WEIGHT.heavy,
                letterSpacing: TRACK.wide,
                textTransform: "uppercase",
                color: INK.onDark,
                fontFamily: fontSecondary(ctx.brand),
              }}
            >
              {ctx.content.subject || ctx.businessName}
            </span>
            <Barcode color={INK.onDark} height={4} />
          </div>
          <div style={{ padding: px(3.6), display: "flex", flexDirection: "column", gap: px(2.6) }}>
            <Title ctx={ctx} size={5.4} color={INK.strong} />
            <div style={{ display: "flex", gap: px(3.6), flexWrap: "wrap" }}>
              <TicketField
                ctx={ctx}
                label={ctx.content.labels?.["location"] ?? "To"}
                value={ctx.content.location}
                tone="dark"
              />
              <TicketField
                ctx={ctx}
                label={ctx.content.labels?.["date"] ?? "Date"}
                value={ctx.content.date}
                tone="dark"
              />
              <TicketField
                ctx={ctx}
                label={ctx.content.labels?.["price"] ?? "Fare"}
                value={formatPrice(ctx.content.price, ctx.brand.currency)}
                tone="dark"
              />
            </div>
          </div>
        </AdjustBox>
      </Stage>
    ),
  },
  {
    id: "tv_checklist",
    label: "Checklist",
    tags: ["dense", "image_first"],
    render: (ctx) => (
      <Stage ctx={ctx} treatment="scrimBoth">
        <AdjustBox ctx={ctx} style={{ display: "flex", flexDirection: "column", gap: px(1.8) }}>
          <BizRow ctx={ctx} tone="light" />
          <Title ctx={ctx} size={7} color={INK.onDark} />
        </AdjustBox>
        <div style={{ display: "flex", flexDirection: "column", gap: px(2.6), width: "100%" }}>
          <FeatureBoxes ctx={ctx} tone="light" columns={1} limit={3} />
          <CtaBar ctx={ctx} tone="dark" />
        </div>
      </Stage>
    ),
  },
  {
    id: "tv_daterail",
    label: "Date Rail",
    tags: ["editorial", "minimal"],
    render: (ctx) => (
      <div style={{ ...base(ctx.brand), color: INK.onDark }}>
        <PhotoLayer ctx={ctx} treatment="scrimBottom" />
        <div
          style={{
            position: "absolute",
            right: px(5),
            top: px(7),
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: px(2.6),
            textAlign: "right",
          }}
        >
          <TicketField
            ctx={ctx}
            label={ctx.content.labels?.["date"] ?? "Departs"}
            value={ctx.content.date}
            tone="light"
          />
          <TicketField
            ctx={ctx}
            label={ctx.content.labels?.["meta1"] ?? "Nights"}
            value={ctx.content.meta1}
            tone="light"
          />
        </div>
        <div style={{ position: "absolute", left: px(5), top: px(7) }}>
          <BizRow ctx={ctx} tone="light" />
        </div>
        <AdjustBox
          ctx={ctx}
          style={{
            position: "absolute",
            insetInline: px(5),
            bottom: px(7),
            display: "flex",
            flexDirection: "column",
            gap: px(1.8),
          }}
        >
          <Title ctx={ctx} size={7} color={INK.onDark} />
          <PriceBadge ctx={ctx} tone="light" />
        </AdjustBox>
      </div>
    ),
  },
  {
    id: "tv_bigtype",
    label: "Big Type",
    tags: ["bold", "image_first"],
    render: (ctx) => (
      <div style={{ ...base(ctx.brand), color: INK.onDark }}>
        <PhotoLayer ctx={ctx} treatment="scrimBoth" strength={0.9} />
        <div
          style={{
            position: "absolute",
            inset: 0,
            padding: px(5),
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <BizRow ctx={ctx} tone="light" />
          <AdjustBox ctx={ctx} style={{ display: "flex", flexDirection: "column", gap: px(2.6) }}>
            <HeadlineTwoTone ctx={ctx} size={11.5} color={INK.onDark} accent={ctx.brand.accent} />
          </AdjustBox>
          <div style={{ display: "flex", flexDirection: "column", gap: px(1.8) }}>
            <PriceBadge ctx={ctx} tone="light" />
            <ContactLine ctx={ctx} tone="light" />
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "tv_snowband",
    label: "Snow Band",
    tags: ["image_first", "light"],
    render: (ctx) => (
      <div style={{ ...base(ctx.brand), color: INK.onDark }}>
        <PhotoLayer ctx={ctx} treatment="scrimTop" strength={0.5} />
        <Snowfall count={30} />
        <div
          style={{
            position: "absolute",
            inset: 0,
            padding: px(5),
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            gap: px(2.6),
          }}
        >
          <BizRow ctx={ctx} tone="light" />
          <div style={{ width: "100%" }}>
            <Bleed pad={5} style={{ paddingInline: 0 }}>
              <Scallop color="#ffffff" size={6} count={10} />
            </Bleed>
            <Bleed
              style={{
                paddingBlock: `0 ${px(2.6)}`,
                background: "#ffffff",
                display: "flex",
                flexDirection: "column",
                gap: px(1.8),
              }}
            >
              <AdjustBox
                ctx={ctx}
                style={{ display: "flex", flexDirection: "column", gap: px(1.2) }}
              >
                <Kicker ctx={ctx} color={accentColor(ctx)} />
                <Title ctx={ctx} size={5.4} color={INK.strong} />
              </AdjustBox>
              <ServiceLine ctx={ctx} tone="dark" />
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: px(1.8),
                }}
              >
                <PriceBadge ctx={ctx} tone="dark" />
                <ContactLine ctx={ctx} tone="dark" />
              </div>
            </Bleed>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "tv_routedots",
    label: "Route Dots",
    tags: ["minimal", "editorial"],
    render: (ctx) => (
      <Stage ctx={ctx} treatment="scrimBoth" strength={0.85}>
        <div style={{ display: "flex", flexDirection: "column", gap: px(2.6), width: "100%" }}>
          <BizRow ctx={ctx} tone="light" />
          <DottedRoute color={INK.onDarkMuted} stops={4} />
        </div>
        <AdjustBox
          ctx={ctx}
          style={{ display: "flex", flexDirection: "column", gap: px(1.8), width: "100%" }}
        >
          <Title ctx={ctx} size={7} color={INK.onDark} />
          <Chips
            items={[...metaItems(ctx.content, ctx.businessType), ...ctx.content.services]}
            tone="light"
          />
          <PriceBadge ctx={ctx} tone="light" />
        </AdjustBox>
      </Stage>
    ),
  },
  {
    id: "tv_closer",
    label: "Closer",
    tags: ["minimal", "whitespace"],
    render: (ctx) => (
      <div style={{ ...base(ctx.brand), color: INK.onDark }}>
        <PhotoLayer ctx={ctx} treatment="scrimBoth" strength={0.8} />
        <div
          style={{
            position: "absolute",
            inset: 0,
            padding: px(5),
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "space-between",
            textAlign: "center",
            gap: px(2.6),
          }}
        >
          <BizRow ctx={ctx} tone="light" />
          <AdjustBox
            ctx={ctx}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: px(2.6),
              width: "100%",
            }}
          >
            <Kicker ctx={ctx} color={INK.onDarkBody} />
            <Title ctx={ctx} size={9} color={INK.onDark} />
            <CtaBar ctx={ctx} tone="light" />
          </AdjustBox>
          <Bleed style={{ width: "100%", paddingInline: 0 }}>
            <ContactBar ctx={ctx} ground={accentColor(ctx)} />
          </Bleed>
        </div>
      </div>
    ),
  },
  {
    id: "rv_lowerthird",
    label: "Lower Third",
    tags: ["minimal", "image_first"],
    render: (ctx) => (
      <Stage ctx={ctx} treatment="scrimBottom">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <BizRow ctx={ctx} tone="light" />
          <StatusTag ctx={ctx} tone="light" />
        </div>
        <AdjustBox
          ctx={ctx}
          style={{ display: "flex", flexDirection: "column", gap: px(2.6), width: "100%" }}
        >
          <ListingTitle ctx={ctx} size={7} tone="light" />
          <SpecRow ctx={ctx} tone="light" />
          <AskingPrice ctx={ctx} tone="light" size={7} />
          <ContactLine ctx={ctx} tone="light" />
        </AdjustBox>
      </Stage>
    ),
  },
  {
    id: "rv_sheetfoot",
    label: "Sheet",
    tags: ["editorial", "light"],
    render: (ctx) => (
      <Stage ctx={ctx} treatment="scrimTop" strength={0.6}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <BizRow ctx={ctx} tone="light" />
          <StatusTag ctx={ctx} tone="light" />
        </div>
        <Bleed
          style={{
            paddingBlock: px(3.6),
            background: bgOr(ctx.brand, "#f7f5f1"),
            display: "flex",
            flexDirection: "column",
            gap: px(2.6),
          }}
        >
          <AdjustBox ctx={ctx} style={{ display: "flex", flexDirection: "column", gap: px(1.8) }}>
            <ListingTitle ctx={ctx} size={5.4} tone="dark" />
            <SpecRow ctx={ctx} tone="dark" />
          </AdjustBox>
          <AskingPrice ctx={ctx} tone="dark" size={7} />
          <AgentFoot ctx={ctx} tone="dark" />
        </Bleed>
      </Stage>
    ),
  },
  {
    id: "rv_toprail",
    label: "Top Rail",
    tags: ["minimal", "editorial"],
    render: (ctx) => (
      <Stage ctx={ctx} treatment="scrimBottom" strength={0.7}>
        <Bleed
          style={{
            paddingBlock: px(2.6),
            background: alpha(shade(ctx.brand.primary, 0.72), 0.86),
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: px(2.6),
          }}
        >
          <BizRow ctx={ctx} tone="light" />
          <StatusTag ctx={ctx} tone="light" />
        </Bleed>
        <AdjustBox
          ctx={ctx}
          style={{ display: "flex", flexDirection: "column", gap: px(2.6), width: "100%" }}
        >
          <ListingTitle ctx={ctx} size={6.4} tone="light" />
          <AskingPrice ctx={ctx} tone="light" size={7} />
        </AdjustBox>
      </Stage>
    ),
  },
  {
    id: "rv_specband",
    label: "Spec Band",
    tags: ["dense", "image_first"],
    render: (ctx) => (
      <Stage ctx={ctx} treatment="scrimBoth" strength={0.75}>
        <BizRow ctx={ctx} tone="light" />
        <div style={{ display: "flex", flexDirection: "column", gap: px(2.6), width: "100%" }}>
          <AdjustBox ctx={ctx} style={{ display: "flex", flexDirection: "column", gap: px(1.8) }}>
            <ListingTitle ctx={ctx} size={6.4} tone="light" />
          </AdjustBox>
          <Bleed
            style={{
              paddingBlock: px(2.6),
              background: alpha(shade(ctx.brand.primary, 0.72), 0.9),
              display: "flex",
              flexDirection: "column",
              gap: px(2.6),
            }}
          >
            <SpecRow ctx={ctx} tone="light" />
            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                justifyContent: "space-between",
                gap: px(1.8),
              }}
            >
              <AskingPrice ctx={ctx} tone="light" size={5.4} />
              <ContactLine ctx={ctx} tone="light" />
            </div>
          </Bleed>
        </div>
      </Stage>
    ),
  },
  {
    id: "rv_cornermarks",
    label: "Corner Marks",
    tags: ["minimal", "whitespace"],
    render: (ctx) => (
      <div style={{ ...base(ctx.brand), color: INK.onDark }}>
        <PhotoLayer ctx={ctx} treatment="scrimBottom" />
        <CornerMarks color={INK.onDarkMuted} inset={3.6} len={5} />
        <div style={{ position: "absolute", left: px(7), top: px(9) }}>
          <BizRow ctx={ctx} tone="light" />
        </div>
        <AdjustBox
          ctx={ctx}
          style={{
            position: "absolute",
            insetInline: px(7),
            bottom: px(9),
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: px(2.6),
          }}
        >
          <ListingTitle ctx={ctx} size={5.4} tone="light" />
          <AskingPrice ctx={ctx} tone="light" size={5.4} align="right" />
        </AdjustBox>
      </div>
    ),
  },
  {
    id: "rv_pricebar",
    label: "Price Bar",
    tags: ["bold", "image_first"],
    render: (ctx) => {
      const hasBar =
        !!formatPrice(ctx.content.price, ctx.brand.currency) || !!ctx.content.cta.trim();
      return (
        <Stage ctx={ctx} treatment="scrimBoth" strength={0.7}>
          <BizRow ctx={ctx} tone="light" />
          <div style={{ display: "flex", flexDirection: "column", gap: px(2.6), width: "100%" }}>
            <AdjustBox ctx={ctx} style={{ display: "flex", flexDirection: "column", gap: px(1.8) }}>
              <StatusTag ctx={ctx} tone="light" />
              <ListingTitle ctx={ctx} size={6.4} tone="light" />
            </AdjustBox>
            {hasBar ? (
              <Bleed
                style={{
                  paddingBlock: px(2.6),
                  background: accentColor(ctx),
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: px(2.6),
                }}
              >
                <AskingPrice ctx={ctx} tone="light" size={5.4} />
                <CtaTag ctx={ctx} tone="light" />
              </Bleed>
            ) : null}
          </div>
        </Stage>
      );
    },
  },
  {
    id: "rv_sidesheet",
    label: "Side Sheet",
    tags: ["editorial", "dense"],
    render: (ctx) => (
      <div style={{ ...base(ctx.brand), color: INK.onDark }}>
        <PhotoLayer ctx={ctx} treatment="plain" />
        <div
          style={{
            position: "absolute",
            inset: 0,
            padding: px(5),
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <div
            style={{
              width: "44%",
              background: alpha(shade(ctx.brand.primary, 0.74), 0.9),
              borderRadius: px(2.4),
              padding: px(2.6),
              display: "flex",
              flexDirection: "column",
              gap: px(2.6),
            }}
          >
            <BizRow ctx={ctx} tone="light" />
            <AdjustBox ctx={ctx} style={{ display: "flex", flexDirection: "column", gap: px(1.8) }}>
              <ListingTitle ctx={ctx} size={4.2} tone="light" />
              <FeatureList ctx={ctx} tone="light" columns={1} />
            </AdjustBox>
            <div
              style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: px(1.8) }}
            >
              <AskingPrice ctx={ctx} tone="light" size={4.2} />
              <ContactLine ctx={ctx} tone="light" />
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "rv_quiet",
    label: "Quiet",
    tags: ["minimal", "whitespace"],
    render: (ctx) => (
      <Stage ctx={ctx} treatment="scrimBottom" strength={0.6} pad={7}>
        <BizRow ctx={ctx} tone="light" />
        <AdjustBox
          ctx={ctx}
          style={{ display: "flex", flexDirection: "column", gap: px(1.8), width: "100%" }}
        >
          <ListingTitle ctx={ctx} size={5.4} tone="light" />
          <AskingPrice ctx={ctx} tone="light" size={5.4} />
        </AdjustBox>
      </Stage>
    ),
  },
  {
    id: "rv_goldrule",
    label: "Gold Rule",
    tags: ["luxury", "centered"],
    render: (ctx) => (
      <div style={{ ...base(ctx.brand), color: INK.onDark }}>
        <PhotoLayer ctx={ctx} treatment="scrimBoth" strength={0.85} />
        <div
          style={{
            position: "absolute",
            inset: 0,
            padding: px(7),
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "space-between",
            textAlign: "center",
          }}
        >
          <BizRow ctx={ctx} tone="light" />
          <AdjustBox
            ctx={ctx}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: px(2.6),
              width: "100%",
            }}
          >
            <ListingTitle ctx={ctx} size={7} tone="light" align="center" />
            <span style={{ width: px(14), height: px(0.4), background: accentColor(ctx) }} />
            <AskingPrice ctx={ctx} tone="light" size={7} align="center" />
          </AdjustBox>
          <ContactLine ctx={ctx} tone="light" />
        </div>
      </div>
    ),
  },
  {
    id: "rv_openhouse",
    label: "Open House",
    tags: ["editorial", "image_first"],
    render: (ctx) => (
      <div style={{ ...base(ctx.brand), color: INK.onDark }}>
        <PhotoLayer ctx={ctx} treatment="scrimBottom" />
        <div style={{ position: "absolute", left: px(5), top: px(7) }}>
          <BizRow ctx={ctx} tone="light" />
        </div>
        <AdjustBox
          ctx={ctx}
          style={{
            position: "absolute",
            insetInline: px(5),
            bottom: px(7),
            display: "flex",
            flexDirection: "column",
            gap: px(2.6),
          }}
        >
          <ListingTitle ctx={ctx} size={5.4} tone="light" />
          {ctx.content.date || ctx.content.location ? (
            <div
              style={{
                display: "flex",
                alignItems: "stretch",
                gap: px(2.6),
                padding: px(2.6),
                borderRadius: px(2.4),
                background: alpha("#ffffff", 0.14),
                border: `1px solid ${INK.onDarkFaint}`,
              }}
            >
              <TicketField
                ctx={ctx}
                label={ctx.content.labels?.["date"] ?? "Viewing"}
                value={ctx.content.date}
                tone="light"
              />
              <TicketField
                ctx={ctx}
                label={ctx.content.labels?.["location"] ?? "Where"}
                value={ctx.content.location}
                tone="light"
              />
            </div>
          ) : null}
          <AskingPrice ctx={ctx} tone="light" size={5.4} />
        </AdjustBox>
      </div>
    ),
  },
  {
    id: "rv_statusflag",
    label: "Status Flag",
    tags: ["bold", "minimal"],
    render: (ctx) => (
      <div style={{ ...base(ctx.brand), color: INK.onDark }}>
        <PhotoLayer ctx={ctx} treatment="scrimBottom" />
        <span
          style={{
            position: "absolute",
            left: 0,
            top: px(14),
            padding: `${px(1.2)} ${px(3.6)}`,
            background: accentColor(ctx),
            fontSize: px(2.2),
            fontWeight: WEIGHT.heavy,
            letterSpacing: TRACK.wider,
            textTransform: "uppercase",
            color: INK.onDark,
            fontFamily: fontSecondary(ctx.brand),
          }}
        >
          {ctx.content.subject || ctx.businessName}
        </span>
        <div style={{ position: "absolute", left: px(5), top: px(7) }}>
          <BizRow ctx={ctx} tone="light" />
        </div>
        <AdjustBox
          ctx={ctx}
          style={{
            position: "absolute",
            insetInline: px(5),
            bottom: px(7),
            display: "flex",
            flexDirection: "column",
            gap: px(2.6),
          }}
        >
          <ListingTitle ctx={ctx} size={6.4} tone="light" />
          <SpecRow ctx={ctx} tone="light" />
          <AskingPrice ctx={ctx} tone="light" size={5.4} />
        </AdjustBox>
      </div>
    ),
  },
  {
    id: "rv_featuregrid",
    label: "Feature Grid",
    tags: ["dense", "image_first"],
    render: (ctx) => (
      <Stage ctx={ctx} treatment="scrimBoth">
        <AdjustBox ctx={ctx} style={{ display: "flex", flexDirection: "column", gap: px(1.8) }}>
          <BizRow ctx={ctx} tone="light" />
          <ListingTitle ctx={ctx} size={6.4} tone="light" />
        </AdjustBox>
        <div style={{ display: "flex", flexDirection: "column", gap: px(2.6), width: "100%" }}>
          <FeatureList ctx={ctx} tone="light" columns={2} />
          <AskingPrice ctx={ctx} tone="light" size={5.4} />
          <ContactLine ctx={ctx} tone="light" />
        </div>
      </Stage>
    ),
  },
  {
    id: "rv_agentfoot",
    label: "Agent Foot",
    tags: ["editorial", "minimal"],
    render: (ctx) => (
      <Stage ctx={ctx} treatment="scrimBottom">
        <StatusTag ctx={ctx} tone="light" />
        <AdjustBox
          ctx={ctx}
          style={{ display: "flex", flexDirection: "column", gap: px(2.6), width: "100%" }}
        >
          <ListingTitle ctx={ctx} size={7} tone="light" />
          <AskingPrice ctx={ctx} tone="light" size={7} />
          <AgentFoot ctx={ctx} tone="light" />
        </AdjustBox>
      </Stage>
    ),
  },
  {
    id: "rv_stackbands",
    label: "Stack Bands",
    tags: ["dense", "asymmetric"],
    render: (ctx) => {
      const band: React.CSSProperties = {
        background: alpha(shade(ctx.brand.primary, 0.72), 0.88),
        padding: `${px(2.6)} ${px(3.6)}`,
      };
      return (
        <div style={{ ...base(ctx.brand), color: INK.onDark }}>
          <PhotoLayer ctx={ctx} treatment="plain" />
          <div style={{ position: "absolute", left: px(5), top: px(7) }}>
            <BizRow ctx={ctx} tone="light" />
          </div>
          <AdjustBox
            ctx={ctx}
            style={{
              position: "absolute",
              insetInline: px(5),
              bottom: px(7),
              display: "flex",
              flexDirection: "column",
              gap: px(0.8),
            }}
          >
            <div style={band}>
              <ListingTitle ctx={ctx} size={5.4} tone="light" />
            </div>
            <div style={band}>
              <SpecRow ctx={ctx} tone="light" />
            </div>
            <div style={band}>
              <AskingPrice ctx={ctx} tone="light" size={5.4} />
            </div>
          </AdjustBox>
        </div>
      );
    },
  },
  {
    id: "rv_archwindow",
    label: "Arch",
    tags: ["luxury", "light"],
    render: (ctx) => (
      <div
        style={{
          ...base(ctx.brand),
          background: bgOr(ctx.brand, "#f4f1ec"),
          padding: px(5),
          display: "flex",
          flexDirection: "column",
          gap: px(2.6),
        }}
      >
        <BizRow ctx={ctx} tone="dark" />
        <div
          style={{
            position: "relative",
            flex: 1,
            minHeight: 0,
            overflow: "hidden",
            borderRadius: `${px(30)} ${px(30)} ${px(2.4)} ${px(2.4)}`,
          }}
        >
          <PhotoLayer ctx={ctx} treatment="plain" />
        </div>
        <AdjustBox ctx={ctx} style={{ display: "flex", flexDirection: "column", gap: px(1.8) }}>
          <ListingTitle ctx={ctx} size={5.4} tone="dark" />
          <SpecRow ctx={ctx} tone="dark" />
        </AdjustBox>
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: px(1.8),
          }}
        >
          <AskingPrice ctx={ctx} tone="dark" size={5.4} />
          <ContactLine ctx={ctx} tone="dark" />
        </div>
      </div>
    ),
  },
  {
    id: "rv_planlines",
    label: "Plan Lines",
    tags: ["minimal", "editorial"],
    render: (ctx) => (
      <div style={{ ...base(ctx.brand), color: INK.onDark }}>
        <PhotoLayer ctx={ctx} treatment="scrimBottom" />
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `linear-gradient(${INK.onDarkFaint} 1px, transparent 1px), linear-gradient(90deg, ${INK.onDarkFaint} 1px, transparent 1px)`,
            backgroundSize: `${px(12)} ${px(12)}`,
            opacity: 0.3,
          }}
        />
        <div style={{ position: "absolute", left: px(5), top: px(7) }}>
          <BizRow ctx={ctx} tone="light" />
        </div>
        <AdjustBox
          ctx={ctx}
          style={{
            position: "absolute",
            insetInline: px(5),
            bottom: px(7),
            display: "flex",
            flexDirection: "column",
            gap: px(2.6),
          }}
        >
          <ListingTitle ctx={ctx} size={6.4} tone="light" />
          <SpecRow ctx={ctx} tone="light" />
          <AskingPrice ctx={ctx} tone="light" size={5.4} />
        </AdjustBox>
      </div>
    ),
  },
  {
    id: "rv_floatcard",
    label: "Float Card",
    tags: ["light", "image_first"],
    render: (ctx) => (
      <Stage ctx={ctx} treatment="plain">
        <BizRow ctx={ctx} tone="light" />
        <AdjustBox
          ctx={ctx}
          style={{
            width: "100%",
            background: alpha("#ffffff", 0.95),
            borderRadius: px(2.4),
            padding: px(3.6),
            display: "flex",
            flexDirection: "column",
            gap: px(2.6),
            boxShadow: ELEVATION.high(px),
          }}
        >
          <StatusTag ctx={ctx} tone="dark" />
          <ListingTitle ctx={ctx} size={5.4} tone="dark" />
          <SpecRow ctx={ctx} tone="dark" />
          <AskingPrice ctx={ctx} tone="dark" size={5.4} />
        </AdjustBox>
      </Stage>
    ),
  },
  {
    id: "rv_serifhero",
    label: "Serif Hero",
    tags: ["editorial", "type_first"],
    render: (ctx) => (
      <Stage ctx={ctx} treatment="scrimTop" strength={0.9}>
        <AdjustBox ctx={ctx} style={{ display: "flex", flexDirection: "column", gap: px(1.8) }}>
          <BizRow ctx={ctx} tone="light" />
          <ListingTitle ctx={ctx} size={9} tone="light" />
        </AdjustBox>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: px(2.6),
            width: "100%",
            padding: px(2.6),
            borderRadius: px(2.4),
            background: alpha(shade(ctx.brand.primary, 0.72), 0.82),
          }}
        >
          <SpecRow ctx={ctx} tone="light" />
          <AskingPrice ctx={ctx} tone="light" size={5.4} />
        </div>
      </Stage>
    ),
  },
  {
    id: "rv_boneframe",
    label: "Bone Frame",
    tags: ["whitespace", "light"],
    render: (ctx) => (
      <div
        style={{
          ...base(ctx.brand),
          background: bgOr(ctx.brand, "#efece6"),
          padding: px(3.6),
          display: "flex",
          flexDirection: "column",
          gap: px(2.6),
        }}
      >
        <div style={{ position: "relative", flex: 1, minHeight: 0, overflow: "hidden" }}>
          <PhotoLayer ctx={ctx} treatment="scrimTop" strength={0.5} />
          <div
            style={{
              position: "absolute",
              inset: 0,
              padding: px(3.6),
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
            }}
          >
            <BizRow ctx={ctx} tone="light" />
            <StatusTag ctx={ctx} tone="light" />
          </div>
        </div>
        <AdjustBox ctx={ctx} style={{ display: "flex", flexDirection: "column", gap: px(1.8) }}>
          <ListingTitle ctx={ctx} size={5.4} tone="dark" />
          <SpecRow ctx={ctx} tone="dark" />
          <AskingPrice ctx={ctx} tone="dark" size={5.4} />
        </AdjustBox>
        <AgentFoot ctx={ctx} tone="dark" />
      </div>
    ),
  },
  {
    id: "rv_closer",
    label: "Closer",
    tags: ["centered", "luxury"],
    render: (ctx) => (
      <div style={{ ...base(ctx.brand), color: INK.onDark }}>
        <PhotoLayer ctx={ctx} treatment="scrimBoth" strength={0.9} />
        <div
          style={{
            position: "absolute",
            inset: 0,
            padding: px(5),
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "space-between",
            textAlign: "center",
            gap: px(2.6),
          }}
        >
          <BizRow ctx={ctx} tone="light" />
          <AdjustBox
            ctx={ctx}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: px(2.6),
              width: "100%",
            }}
          >
            <StatusTag ctx={ctx} tone="light" />
            <ListingTitle ctx={ctx} size={7} tone="light" align="center" />
            <AskingPrice ctx={ctx} tone="light" size={7} align="center" />
          </AdjustBox>
          <Bleed style={{ width: "100%", paddingInline: 0 }}>
            <ContactBar ctx={ctx} ground={shade(ctx.brand.primary, 0.76)} />
          </Bleed>
        </div>
      </div>
    ),
  },
];

export const engineIds = [...engines.map((e) => e.id), "custom"];

const engineMap = new Map(engines.map((e) => [e.id, e]));

const variants: TemplateVariant[] = [
  { align: "left", tone: "light", badge: "pill", accent: "primary" },
  { align: "center", tone: "light", badge: "square", accent: "secondary" },
  { align: "left", tone: "dark", badge: "square", accent: "accent" },
  { align: "center", tone: "dark", badge: "pill", accent: "secondary" },
];

/* ------------------------------ custom engine ------------------------------ */

const zoneFontWeight: Record<TemplateZone["weight"], number> = {
  regular: 500,
  bold: 700,
  extra: 800,
};

function zoneText(zone: TemplateZone, ctx: RenderCtx): string {
  const { content, brand } = ctx;
  switch (zone.key) {
    case "title":
      return content.title;
    case "subject":
      return content.subject;
    case "price":
      return formatPrice(content.price, brand.currency);
    case "location":
      return content.location;
    case "date":
      return content.date;
    case "services":
      return content.services.join("  ·  ");
    case "additionalText":
      return content.additionalText;
    case "cta":
      return content.cta;
    case "brandName":
      return ctx.showBrandName ? ctx.businessName : "";
    default:
      return "";
  }
}

function ZoneNode({ zone, ctx }: { zone: TemplateZone; ctx: RenderCtx }) {
  if (zone.key === "logo") {
    if (!ctx.brand.logoDataUrl) return null;
    return (
      <img
        src={ctx.brand.logoDataUrl}
        alt=""
        crossOrigin="anonymous"
        style={{
          position: "absolute",
          left: `${zone.x}%`,
          top: `${zone.y}%`,
          width: `${zone.width}%`,
          objectFit: "contain",
        }}
      />
    );
  }
  const text = zoneText(zone, ctx);
  if (!text) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: `${zone.x}%`,
        top: `${zone.y}%`,
        width: `${zone.width}%`,
        textAlign: zone.align,
        color: zone.color,
        fontWeight: zoneFontWeight[zone.weight],
        fontSize: px(zone.size),
        textTransform: zone.uppercase ? "uppercase" : "none",
        fontFamily: zone.key === "title" ? font(ctx.brand) : fontSecondary(ctx.brand),
        lineHeight: 1.2,
        whiteSpace: "pre-wrap",
      }}
    >
      {text}
    </div>
  );
}

/** Locked uploaded background, fills the canvas untouched. Only mapped zones
 * render dynamic content on top, never restyled. */
function renderCustomTemplate(template: Template, ctx: RenderCtx): React.ReactNode {
  const adjust = ctx.adjustments?.text;
  const x = clamp(adjust?.x ?? 0, -12, 12);
  const y = clamp(adjust?.y ?? 0, -12, 12);
  const scale = clamp(adjust?.scale ?? 1, 0.8, 1.25);
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      {template.backgroundUrl ? (
        <img
          src={template.backgroundUrl}
          alt=""
          crossOrigin="anonymous"
          style={{
            position: "absolute",
            inset: 0,
            height: "100%",
            width: "100%",
            objectFit: "cover",
          }}
        />
      ) : null}
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: `translate(${x}cqw, ${y}cqw) scale(${scale})`,
          transformOrigin: "center",
        }}
      >
        {(template.zones ?? []).map((zone) => (
          <ZoneNode key={zone.key} zone={zone} ctx={ctx} />
        ))}
      </div>
    </div>
  );
}

/* ------------------------------ template names ----------------------------- */

/**
 * Template names are numbered and functional. No invented brand, person or
 * company names anywhere in the library.
 */
const ENGINE_STYLE: Record<string, string> = {
  aurora: "Gradient",
  editorial: "Editorial",
  glass: "Glass",
  split: "Split",
  frame: "Frame",
  duotone: "Duotone",
  ticket: "Ticket",
  minimal: "Minimal",
  poster: "Poster",
  banner: "Banner",
  spotlight: "Spotlight",
  stack: "Stack",
  darkluxury: "Dark",
  lightluxury: "Light",
  typeblast: "Bold Type",
  whitespacepanel: "Whitespace",
  densegrid: "Grid",
  asymmetricoffer: "Offer",
  fullbleed: "Full Bleed",
  blurbackdrop: "Blur",
  diagonalslash: "Diagonal",
  serifcolumn: "Serif",
  letterbox: "Letterbox",
  colorwash: "Color Wash",
  thinframe: "Thin Frame",
  offerblock: "Offer Block",
  glassstrip: "Glass Strip",
  quietwhite: "Quiet White",
  duskframe: "Dusk",
  typeoffer: "Type Offer",
  splitstack: "Split Stack",
  clearcenter: "Clear Center",
  bottombar: "Bottom Bar",
  cornerprice: "Corner Price",
  archway: "Archway",
  softcard: "Soft Card",
  marquee: "Marquee",
  halfmoon: "Half Moon",
  gridlines: "Grid Lines",
  stickerprice: "Sticker",
  skycall: "Sky Call",
  agencysweep: "Agency Sweep",
  fareupdate: "Fare Update",
  ticketcut: "Ticket",
  cabinwindow: "Cabin Window",
  lesssearching: "Less Searching",
  bluepanel: "Blue Panel",
  onewayticket: "One Way",
  bookflight: "Book Now",
  goldroute: "Gold Route",
  appscreen: "App Screen",
  phonemock: "Phone",
  re_editorial: "Editorial",
  re_sidebar: "Sidebar",
  re_darkluxe: "Dark Luxe",
  re_specband: "Spec Band",
  re_floatcard: "Float Card",
  re_bonecard: "Bone",
  re_splitprice: "Split Price",
  re_sheet: "Listing Sheet",
  re_arch: "Arch",
  re_cornermarks: "Corner Marks",
  re_planlines: "Plan Lines",
  re_stackbands: "Bands",
  re_agentcard: "Agent",
  re_quiet: "Quiet",
  re_gallery: "Gallery",
  re_goldrule: "Gold Rule",
  re_openhouse: "Open House",
  re_priceflag: "Price Flag",
  re_frame: "Frame",
  re_signature: "Signature",
  wavecut: "Wave",
  sunarc: "Sun",
  beachlabel: "Beach Label",
  seahorizon: "Horizon",
  sunsetbands: "Sunset",
  poolside: "Poolside",
  postcard: "Postcard",
  shellbadge: "Shell Badge",
  azuredeep: "Azure",
  sandnote: "Sand Note",
  passportstamp: "Passport",
  maproute: "Map Route",
  itinerary: "Itinerary",
  globering: "Globe",
  stampgrid: "Stamp Grid",
  compassrose: "Compass",
  triptych: "Triptych",
  journal: "Journal",
  coordinates: "Coordinates",
  atlasgrid: "Atlas",
  snowfall: "Snowfall",
  frostpanel: "Frost",
  alpine: "Alpine",
  icebadge: "Ice",
  festivenight: "Festive",
  snowcap: "Snow Cap",
  skipass: "Ski Pass",
  nordicband: "Nordic",
  frozenframe: "Frozen Frame",
  newyear: "New Year",
  tv_lowerthird: "Lower Third",
  tv_topbar: "Top Bar",
  tv_ticketcard: "Ticket",
  tv_routearc: "Route",
  tv_siderail: "Side Rail",
  tv_footblock: "Foot Block",
  tv_hairframe: "Hair Frame",
  tv_pricepill: "Price Pill",
  tv_stampcorner: "Stamp",
  tv_splitfoot: "Split Foot",
  tv_marquee: "Marquee",
  tv_cornercard: "Corner Card",
  tv_sunband: "Sun Band",
  tv_boardingpass: "Boarding Pass",
  tv_checklist: "Checklist",
  tv_daterail: "Date Rail",
  tv_bigtype: "Big Type",
  tv_snowband: "Snow Band",
  tv_routedots: "Route Dots",
  tv_closer: "Closer",
  rv_lowerthird: "Lower Third",
  rv_sheetfoot: "Sheet",
  rv_toprail: "Top Rail",
  rv_specband: "Spec Band",
  rv_cornermarks: "Corner Marks",
  rv_pricebar: "Price Bar",
  rv_sidesheet: "Side Sheet",
  rv_quiet: "Quiet",
  rv_goldrule: "Gold Rule",
  rv_openhouse: "Open House",
  rv_statusflag: "Status Flag",
  rv_featuregrid: "Feature Grid",
  rv_agentfoot: "Agent Foot",
  rv_stackbands: "Stack Bands",
  rv_archwindow: "Arch",
  rv_planlines: "Plan Lines",
  rv_floatcard: "Float Card",
  rv_serifhero: "Serif Hero",
  rv_boneframe: "Bone Frame",
  rv_closer: "Closer",
};

const styleName = (engineId: string) => ENGINE_STYLE[engineId] ?? "Classic";
const pad = (n: number) => String(n).padStart(2, "0");
const templateName = (index: number, engineId: string, prefix = "") =>
  `${prefix}${pad(index)} ${styleName(engineId)}`;

/** Which business types a template design tends to fit best. Purely a soft
 * sort hint, every template stays available to every business. */
const ENGINE_SUGGESTED: Partial<Record<string, BusinessType[]>> = {
  aurora: ["travel_agency", "restaurant"],
  editorial: ["real_estate", "retail"],
  glass: ["real_estate", "car_dealership"],
  split: ["car_dealership", "retail"],
  frame: ["real_estate", "travel_agency"],
  duotone: ["retail", "other"],
  ticket: ["restaurant", "retail"],
  minimal: ["real_estate", "other"],
  poster: ["restaurant", "retail"],
  banner: ["car_dealership", "retail"],
  spotlight: ["restaurant", "other"],
  stack: ["real_estate", "retail"],
  darkluxury: ["real_estate", "car_dealership"],
  lightluxury: ["travel_agency", "real_estate"],
  typeblast: ["retail", "other"],
  whitespacepanel: ["real_estate", "other"],
  densegrid: ["real_estate", "car_dealership"],
  asymmetricoffer: ["retail", "car_dealership"],
  fullbleed: ["travel_agency", "restaurant"],
  blurbackdrop: ["real_estate", "travel_agency"],
  diagonalslash: ["car_dealership", "retail"],
  serifcolumn: ["real_estate", "other"],
  letterbox: ["travel_agency", "car_dealership"],
  colorwash: ["retail", "restaurant"],
  thinframe: ["real_estate", "travel_agency"],
  offerblock: ["car_dealership", "retail"],
  glassstrip: ["restaurant", "travel_agency"],
  quietwhite: ["real_estate", "other"],
  duskframe: ["real_estate", "car_dealership"],
  typeoffer: ["retail", "restaurant"],
  splitstack: ["car_dealership", "retail"],
  clearcenter: ["travel_agency", "restaurant"],
  bottombar: ["real_estate", "retail"],
  cornerprice: ["car_dealership", "travel_agency"],
  archway: ["travel_agency", "real_estate"],
  softcard: ["retail", "other"],
  marquee: ["restaurant", "retail"],
  halfmoon: ["travel_agency", "restaurant"],
  gridlines: ["real_estate", "car_dealership"],
  stickerprice: ["retail", "car_dealership"],
};

const suggestedForEngine = (engineId: string): BusinessType[] | undefined =>
  ENGINE_SUGGESTED[engineId];

/** The original 18 render engines, in their original order. Kept as an
 * explicit id list (rather than reading engines.length) so global_1..50 keep
 * their original engine mapping even as new engines are appended above. */
const LEGACY_ENGINE_IDS: string[] = [
  "aurora",
  "editorial",
  "glass",
  "split",
  "frame",
  "duotone",
  "ticket",
  "minimal",
  "poster",
  "banner",
  "spotlight",
  "stack",
  "darkluxury",
  "lightluxury",
  "typeblast",
  "whitespacepanel",
  "densegrid",
  "asymmetricoffer",
];

/** The newer engines added for the 100 template expansion. */
const NEW_ENGINE_IDS: string[] = [
  "fullbleed",
  "blurbackdrop",
  "diagonalslash",
  "serifcolumn",
  "letterbox",
  "colorwash",
  "thinframe",
  "offerblock",
  "glassstrip",
  "quietwhite",
  "duskframe",
  "typeoffer",
  "splitstack",
];

/** 50 original premium global templates, tag driven, never locked to an
 * industry. Ids and engine mapping are stable so saved posts keep rendering. */
function buildGlobalTemplates(): Template[] {
  const out: Template[] = [];
  const total = 50;
  const legacyEngines = LEGACY_ENGINE_IDS.map((id) => engineMap.get(id)!);
  let i = 0;
  let engineCursor = 0;
  while (out.length < total) {
    const remaining = total - out.length;
    const enginesLeft = legacyEngines.length - engineCursor;
    const perEngine =
      enginesLeft > 0 ? Math.max(2, Math.round(remaining / enginesLeft)) : remaining;
    const engine = legacyEngines[engineCursor % legacyEngines.length]!;
    const count = Math.min(perEngine, remaining);
    for (let k = 0; k < count; k++) {
      const variant = variants[i % variants.length]!;
      out.push({
        // Only the first design of each engine is offered. The extra colour
        // variants stay in the library so older posts keep rendering, but the
        // picker no longer shows three near identical versions of one layout.
        hidden: k > 0,
        id: `global_${i + 1}`,
        name: templateName(i + 1, engine.id),

        engine: engine.id,
        tags: engine.tags,
        ...(suggestedForEngine(engine.id) ? { suggestedFor: suggestedForEngine(engine.id) } : {}),
        variant,
        scope: "global",
        businessId: null,
        archived: false,
        format: "post",
      });
      i++;
    }
    engineCursor++;
  }
  return out.slice(0, total);
}

/** 10 additional post templates built from the newer engines, bringing the
 * post library to 60 while keeping global_1..50 untouched. */
function buildNewGlobalTemplates(): Template[] {
  const chosen = NEW_ENGINE_IDS.slice(0, 10);
  return chosen.map((engineId, index) => {
    const engine = engineMap.get(engineId)!;
    const variant = variants[(index + 1) % variants.length]!;
    return {
      id: `global_${51 + index}`,
      name: templateName(51 + index, engine.id),
      engine: engine.id,
      tags: engine.tags,
      ...(suggestedForEngine(engine.id) ? { suggestedFor: suggestedForEngine(engine.id) } : {}),
      variant,
      scope: "global" as const,
      businessId: null,
      archived: false,
      format: "post" as const,
    };
  });
}

/* --------------------------- other content formats -------------------------- */

/**
 * The video set. It reuses the exact same engines, brand data, text fit rules
 * and adjustments as posts, only the canvas shape and the format rules differ.
 * Ids and engine mapping stay as they were, so saved posts keep their design.
 */
const FORMAT_ENGINES: Record<"video", string[]> = {
  video: [
    "aurora",
    "spotlight",
    "darkluxury",
    "typeblast",
    "fullbleed",
    "colorwash",
    "letterbox",
    "typeoffer",
  ],
};

/** Neutral prefixes keep the numbering readable per format. */
const FORMAT_PREFIX: Record<"video", string> = {
  video: "V",
};

function buildFormatTemplates(format: "video"): Template[] {
  const spec = FORMAT_SPECS[format];
  return FORMAT_ENGINES[format].map((engineId, index) => {
    const engine = engineMap.get(engineId) ?? engines[0]!;
    const variant = variants[index % variants.length]!;
    return {
      id: `${format}_${index + 1}`,
      name: templateName(index + 1, engine.id, FORMAT_PREFIX[format]),

      engine: engine.id,
      tags: engine.tags,
      ...(suggestedForEngine(engine.id) ? { suggestedFor: suggestedForEngine(engine.id) } : {}),
      variant,
      scope: "global" as const,
      businessId: null,
      archived: false,
      format,
      slides: { min: spec.minSlides, max: spec.maxSlides, default: spec.defaultSlides },
      ...(format === "video"
        ? {
            motion: {
              minDuration: spec.minDuration,
              maxDuration: spec.maxDuration,
              defaultDuration: spec.defaultDuration,
              transition: (index % 3 === 0 ? "fade" : index % 3 === 1 ? "slide" : "zoom") as
                "fade" | "slide" | "zoom",
            },
          }
        : {}),
    };
  });
}

/** Content forward designs: the picture is the message, the brand only adds a
 * logo, the price and the essentials. Especially for video, where a heavy
 * colour wash would hide the footage. */
const CLEAN_ENGINE_IDS = ["clearcenter", "bottombar", "cornerprice"];

function buildCleanTemplates(format: ContentFormat, startIndex: number): Template[] {
  const spec = FORMAT_SPECS[format];
  return CLEAN_ENGINE_IDS.map((engineId, index) => {
    const engine = engineMap.get(engineId)!;
    const variant = variants[index % variants.length]!;
    const multi = format === "video";
    return {
      id: `clean_${format}_${index + 1}`,
      name: templateName(
        startIndex + index,
        engine.id,
        format === "post" ? "" : FORMAT_PREFIX[format],
      ),
      engine: engine.id,
      tags: engine.tags,
      ...(suggestedForEngine(engine.id) ? { suggestedFor: suggestedForEngine(engine.id) } : {}),
      variant,
      scope: "global" as const,
      businessId: null,
      archived: false,
      format,
      ...(multi
        ? { slides: { min: spec.minSlides, max: spec.maxSlides, default: spec.defaultSlides } }
        : {}),
      ...(format === "video"
        ? {
            motion: {
              minDuration: spec.minDuration,
              maxDuration: spec.maxDuration,
              defaultDuration: spec.defaultDuration,
              transition: "fade" as const,
            },
          }
        : {}),
    };
  });
}

/** The signature set: six newer post designs. They are appended with their own
 * id space, so every id already saved on a post keeps pointing at the design it
 * was made with. */
const SIGNATURE_ENGINE_IDS = [
  "archway",
  "softcard",
  "marquee",
  "halfmoon",
  "gridlines",
  "stickerprice",
];

function buildSignatureTemplates(): Template[] {
  return SIGNATURE_ENGINE_IDS.map((engineId, index) => {
    const engine = engineMap.get(engineId)!;
    const variant = variants[index % variants.length]!;
    return {
      id: `signature_${index + 1}`,
      name: templateName(index + 1, engine.id, "S"),
      engine: engine.id,
      tags: engine.tags,
      ...(suggestedForEngine(engine.id) ? { suggestedFor: suggestedForEngine(engine.id) } : {}),
      variant,
      scope: "global" as const,
      businessId: null,
      archived: false,
      collection: "signature" as const,
      format: "post" as const,
    };
  });
}

/** Designs made for one occasion. Each category is its own id space and its own
 * group in the picker, so a set can grow without touching the ids of another. */
const CATEGORY_ENGINES: Record<TemplateCategory, string[]> = {
  flights: [
    "skycall",
    "agencysweep",
    "fareupdate",
    "ticketcut",
    "cabinwindow",
    "lesssearching",
    "bluepanel",
    "onewayticket",
    "bookflight",
    "goldroute",
    "appscreen",
    "phonemock",
  ],
  sea: [
    "wavecut",
    "sunarc",
    "beachlabel",
    "seahorizon",
    "sunsetbands",
    "poolside",
    "postcard",
    "shellbadge",
    "azuredeep",
    "sandnote",
  ],
  world: [
    "passportstamp",
    "maproute",
    "itinerary",
    "globering",
    "stampgrid",
    "compassrose",
    "triptych",
    "journal",
    "coordinates",
    "atlasgrid",
  ],
  winter: [
    "snowfall",
    "frostpanel",
    "alpine",
    "icebadge",
    "festivenight",
    "snowcap",
    "skipass",
    "nordicband",
    "frozenframe",
    "newyear",
  ],
};

const CATEGORY_PREFIX: Record<TemplateCategory, string> = {
  flights: "F",
  sea: "B",
  world: "W",
  winter: "D",
};

function buildCategoryTemplates(category: TemplateCategory): Template[] {
  return CATEGORY_ENGINES[category].map((engineId, index) => {
    const engine = engineMap.get(engineId)!;
    const variant = variants[index % variants.length]!;
    return {
      id: `${category}_${index + 1}`,
      name: templateName(index + 1, engine.id, CATEGORY_PREFIX[category]),
      engine: engine.id,
      tags: engine.tags,
      ...(suggestedForEngine(engine.id) ? { suggestedFor: suggestedForEngine(engine.id) } : {}),
      variant,
      scope: "global" as const,
      businessId: null,
      archived: false,
      category,
      format: "post" as const,
    };
  });
}

/** Twenty designs made for property listings only. They are offered to estate
 * agencies alone: a restaurant has no rooms, no floor area and no asking price,
 * so the layouts would print half empty for anyone else. */
const REAL_ESTATE_ENGINE_IDS = [
  "re_editorial",
  "re_sidebar",
  "re_darkluxe",
  "re_specband",
  "re_floatcard",
  "re_bonecard",
  "re_splitprice",
  "re_sheet",
  "re_arch",
  "re_cornermarks",
  "re_planlines",
  "re_stackbands",
  "re_agentcard",
  "re_quiet",
  "re_gallery",
  "re_goldrule",
  "re_openhouse",
  "re_priceflag",
  "re_frame",
  "re_signature",
];

function buildRealEstateTemplates(): Template[] {
  return REAL_ESTATE_ENGINE_IDS.map((engineId, index) => {
    const engine = engineMap.get(engineId)!;
    const variant = variants[index % variants.length]!;
    return {
      id: `realestate_${index + 1}`,
      name: templateName(index + 1, engine.id, "R"),
      engine: engine.id,
      tags: engine.tags,
      suggestedFor: ["real_estate" as const],
      onlyFor: ["real_estate" as const],
      variant,
      scope: "global" as const,
      businessId: null,
      archived: false,
      collection: "realestate" as const,
      format: "post" as const,
    };
  });
}

/** Twenty clips for a travel agency. A walk through a resort or a window seat
 * carries the offer on its own, so these designs hold the middle of the frame
 * open and work along the edges. */
const TRAVEL_VIDEO_ENGINE_IDS = [
  "tv_lowerthird",
  "tv_topbar",
  "tv_ticketcard",
  "tv_routearc",
  "tv_siderail",
  "tv_footblock",
  "tv_hairframe",
  "tv_pricepill",
  "tv_stampcorner",
  "tv_splitfoot",
  "tv_marquee",
  "tv_cornercard",
  "tv_sunband",
  "tv_boardingpass",
  "tv_checklist",
  "tv_daterail",
  "tv_bigtype",
  "tv_snowband",
  "tv_routedots",
  "tv_closer",
];

/** Twenty clips for a property agency. A walkthrough already shows the rooms,
 * so the design only has to hold the facts and the number. */
const REAL_ESTATE_VIDEO_ENGINE_IDS = [
  "rv_lowerthird",
  "rv_sheetfoot",
  "rv_toprail",
  "rv_specband",
  "rv_cornermarks",
  "rv_pricebar",
  "rv_sidesheet",
  "rv_quiet",
  "rv_goldrule",
  "rv_openhouse",
  "rv_statusflag",
  "rv_featuregrid",
  "rv_agentfoot",
  "rv_stackbands",
  "rv_archwindow",
  "rv_planlines",
  "rv_floatcard",
  "rv_serifhero",
  "rv_boneframe",
  "rv_closer",
];

/** One trade's video set. Both sets are built the same way, they differ only in
 * which designs they name and which trade they belong to. */
function buildTradeVideoTemplates(input: {
  engineIds: string[];
  type: BusinessType;
  collection: TemplateCollection;
  prefix: string;
  idPrefix: string;
}): Template[] {
  const spec = FORMAT_SPECS.video;
  return input.engineIds.map((engineId, index) => {
    const engine = engineMap.get(engineId)!;
    const variant = variants[index % variants.length]!;
    return {
      id: `${input.idPrefix}_${index + 1}`,
      name: templateName(index + 1, engine.id, input.prefix),
      engine: engine.id,
      tags: engine.tags,
      suggestedFor: [input.type],
      onlyFor: [input.type],
      variant,
      scope: "global" as const,
      businessId: null,
      archived: false,
      collection: input.collection,
      format: "video" as const,
      slides: { min: spec.minSlides, max: spec.maxSlides, default: spec.defaultSlides },
    };
  });
}

export const globalTemplates: Template[] = [
  ...buildGlobalTemplates(),
  ...buildNewGlobalTemplates(),
  ...buildFormatTemplates("video"),
  ...buildCleanTemplates("video", 90),
  ...buildCleanTemplates("post", 90),
  ...buildSignatureTemplates(),
  ...buildCategoryTemplates("flights"),
  ...buildCategoryTemplates("sea"),
  ...buildCategoryTemplates("world"),
  ...buildCategoryTemplates("winter"),
  ...buildRealEstateTemplates(),
  ...buildTradeVideoTemplates({
    engineIds: TRAVEL_VIDEO_ENGINE_IDS,
    type: "travel_agency",
    collection: "travel",
    prefix: "T",
    idPrefix: "travelvideo",
  }),
  ...buildTradeVideoTemplates({
    engineIds: REAL_ESTATE_VIDEO_ENGINE_IDS,
    type: "real_estate",
    collection: "realestate",
    prefix: "RV",
    idPrefix: "realestatevideo",
  }),
];

/** The set of designs a trade owns. A trade listed here is shown its own set
 * and nothing else, so a property brand never scrolls through flight offers. */
const OWN_COLLECTION: Partial<Record<BusinessType, TemplateCollection>> = {
  real_estate: "realestate",
};

/**
 * Templates a business is allowed to pick from.
 *
 * A trade with its own set sees that set alone, plus whatever it uploaded
 * itself. A property brand therefore never scrolls through flight offers or
 * beach weeks. A trade without its own set keeps the whole library, minus the
 * designs another trade owns: those are built around fields such as a
 * property's rooms and floor area and would print half empty.
 *
 * The list handed in is already narrowed to one format. A format the trade set
 * does not cover, video today, would otherwise offer nothing at all, so there
 * the plain library stands in, without occasion designs or another trade's set.
 */
export function templatesForBusinessType(all: Template[], type: BusinessType): Template[] {
  const open = all.filter((tpl) => !tpl.onlyFor || tpl.onlyFor.includes(type));
  const own = OWN_COLLECTION[type];
  if (!own) return open;
  const mine = all.filter((tpl) => tpl.scope === "custom");
  const owned = open.filter((tpl) => tpl.collection === own);
  if (owned.length > 0) return [...mine, ...owned];
  return [...mine, ...open.filter((tpl) => !tpl.category && !tpl.collection)];
}

/** Templates available for one format. Custom uploads stay in the post format
 * unless they declare otherwise, since their design is locked to its canvas. */
export function templatesForFormat(all: Template[], format: ContentFormat): Template[] {
  return all.filter((tpl) => (tpl.format ?? "post") === format && !tpl.hidden);
}

/** Sorts templates suggested for a business type first, without removing or
 * hiding any template. Every template stays selectable by every brand. */
export function recommendedFirst(list: Template[], type: BusinessType): Template[] {
  // A named set leads, then the designs suggested for this kind of business.
  // The sort is stable, so inside each band the library keeps its own order.
  return [...list].sort((a, b) => {
    const set = (a.collection ? 0 : 1) - (b.collection ? 0 : 1);
    if (set !== 0) return set;
    const aScore = a.suggestedFor?.includes(type) ? 0 : 1;
    const bScore = b.suggestedFor?.includes(type) ? 0 : 1;
    return aScore - bScore;
  });
}

export function renderTemplate(
  template: Template,
  args: Omit<RenderCtx, "variant"> & { variant?: TemplateVariant },
): React.ReactNode {
  const variant = args.variant ?? template.variant;
  const ctx: RenderCtx = { ...args, variant };
  if (template.engine === "custom") {
    return renderCustomTemplate(template, ctx);
  }
  const engine = engineMap.get(template.engine) ?? engines[0]!;
  return engine.render(ctx);
}
