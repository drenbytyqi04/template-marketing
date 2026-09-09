import { formatPrice, FORMAT_SPECS, labelledValue } from "./constants";
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
    <div style={{ display: "flex", flexWrap: "wrap", gap: px(1.3) }}>
      {items.slice(0, 6).map((s) => (
        <span
          key={s}
          style={{
            fontSize: px(2.4),
            fontWeight: 600,
            padding: `${px(0.9)} ${px(2.2)}`,
            borderRadius: px(10),
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
        padding: `${px(1.6)} ${px(3.4)}`,
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
        padding: `${px(1.1)} ${px(2.6)}`,
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
        fontSize: px(2.7),
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
        fontSize: px(2.3),
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
        fontSize: px(2.1),
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
  if (!showName && !hasLogo) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: px(2.2) }}>
      <Logo ctx={ctx} />
      {showName ? (
        <span
          style={{
            fontSize: px(2.9),
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
    <div style={{ display: "flex", alignItems: "center", gap: px(2), width: "100%" }}>
      <span style={{ fontSize: px(5.4), fontWeight: 800, letterSpacing: "-0.02em", color }}>
        {from}
      </span>
      <span
        style={{
          flex: 1,
          height: px(0.4),
          background: `repeating-linear-gradient(90deg, ${color} 0 ${px(1)}, transparent ${px(1)} ${px(2)})`,
        }}
      />
      <span
        style={{
          width: 0,
          height: 0,
          borderTop: `${px(1.1)} solid transparent`,
          borderBottom: `${px(1.1)} solid transparent`,
          borderLeft: `${px(2.2)} solid ${color}`,
        }}
      />
      <span
        style={{
          flex: 1,
          height: px(0.4),
          background: `repeating-linear-gradient(90deg, ${color} 0 ${px(1)}, transparent ${px(1)} ${px(2)})`,
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
    <div style={{ display: "flex", alignItems: "flex-end", gap: px(0.5), height: px(height) }}>
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
    <div style={{ display: "flex", flexDirection: "column", gap: px(0.5) }}>
      <span
        style={{
          fontSize: px(1.9),
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
          fontSize: px(3),
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
        border: `${px(0.7)} dashed ${color}`,
        borderRadius: px(1.6),
        transform: `rotate(${rotate}deg)`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: px(0.4),
        color,
        textAlign: "center",
        padding: px(1),
      }}
    >
      <span style={{ fontSize: px(1.7), letterSpacing: "0.2em", opacity: 0.85 }}>VISITED</span>
      <span
        style={{
          fontSize: px(2.8),
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
        <div key={stop} style={{ display: "flex", alignItems: "center", gap: px(2) }}>
          <span
            style={{
              width: px(4.4),
              height: px(4.4),
              borderRadius: "50%",
              border: `${px(0.35)} solid ${ink}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: px(2.1),
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
          gap: px(2),
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
        <div style={{ ...base(brand), color: "#fff" }}>
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
              padding: px(6),
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              alignItems: align,
              textAlign: variant.align,
            }}
          >
            <div style={{ display: "flex", width: "100%", alignItems: "center", gap: px(2.2) }}>
              <BizRow ctx={ctx} tone="light" />
            </div>
            <AdjustBox
              ctx={ctx}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: px(2.2),
                alignItems: align,
                width: "100%",
              }}
            >
              <Kicker ctx={ctx} color="rgba(255,255,255,0.92)" />
              <Title ctx={ctx} size={9.4} color="#fff" />
              <AdditionalText ctx={ctx} size={2.9} opacity={0.9} />
              <Chips
                items={[...metaItems(content, ctx.businessType), ...content.services]}
                tone="light"
              />
              <div style={{ display: "flex", gap: px(2), alignItems: "center", flexWrap: "wrap" }}>
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
          <div style={{ position: "relative", flex: "0 0 58%" }}>
            <Img src={content.imageDataUrl} video={content.videoDataUrl} />
          </div>
          <AdjustBox
            ctx={ctx}
            style={{
              flex: 1,
              padding: px(6),
              display: "flex",
              flexDirection: "column",
              gap: px(2),
              color: "#1a1225",
              textAlign: variant.align,
              alignItems: variant.align === "center" ? "center" : "flex-start",
            }}
          >
            <Kicker ctx={ctx} color={accentColor(ctx)} />
            <Title ctx={ctx} size={7.4} color="#1a1225" />
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
                gap: px(2.2),
              }}
            >
              <BizRow ctx={ctx} tone="dark" />
              <span
                style={{ marginLeft: "auto", display: "flex", gap: px(1.6), alignItems: "center" }}
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
              padding: px(6),
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
                borderRadius: px(5),
                overflow: "hidden",
                boxShadow: "0 30px 60px -30px rgba(0,0,0,.5)",
              }}
            >
              <Img src={content.imageDataUrl} video={content.videoDataUrl} />
            </div>
            <AdjustBox
              ctx={ctx}
              style={{
                borderRadius: px(5),
                padding: px(4.4),
                background: "rgba(255,255,255,0.85)",
                border: "1px solid rgba(255,255,255,0.6)",
                backdropFilter: "blur(20px)",
                display: "flex",
                flexDirection: "column",
                gap: px(1.7),
                color: "#181026",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: px(2) }}>
                <Kicker ctx={ctx} color={accentColor(ctx)} />
                <span style={{ marginLeft: "auto" }}>
                  <PriceBadge ctx={ctx} tone="dark" />
                </span>
              </div>
              <Title ctx={ctx} size={6.2} color="#181026" />
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
              flex: "0 0 46%",
              padding: px(5),
              display: "flex",
              flexDirection: "column",
              gap: px(2),
              color: "#fff",
              background: `linear-gradient(170deg, ${brand.primary}, ${brand.secondary})`,
            }}
          >
            <BizRow ctx={ctx} tone="light" />
            <AdjustBox
              ctx={ctx}
              style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: px(2) }}
            >
              <Kicker ctx={ctx} color="rgba(255,255,255,0.85)" />
              <Title ctx={ctx} size={6.6} color="#fff" />
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
                padding: px(4),
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
            padding: px(4.5),
            display: "flex",
            flexDirection: "column",
            gap: px(3),
          }}
        >
          <div
            style={{
              position: "relative",
              flex: 1,
              borderRadius: px(4),
              overflow: "hidden",
              border: `${px(0.9)} solid ${brand.primary}`,
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
                gap: px(1.6),
              }}
            >
              <Kicker ctx={ctx} color="rgba(255,255,255,0.9)" />
              <Title ctx={ctx} size={7} color="#fff" />
            </AdjustBox>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: px(2.4), color: "#1a1225" }}>
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
        <div style={{ ...base(brand), background: brand.primary, color: "#fff" }}>
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
              padding: px(6),
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              gap: px(2.4),
              textAlign: variant.align,
              alignItems: variant.align === "center" ? "center" : "flex-start",
            }}
          >
            <Kicker ctx={ctx} color="rgba(255,255,255,0.8)" />
            <Title ctx={ctx} size={10.5} color="#fff" />
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
          <div style={{ position: "relative", flex: "0 0 52%" }}>
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
          <div style={{ height: 0, borderTop: `${px(0.5)} dashed ${brand.primary}55` }} />
          <AdjustBox
            ctx={ctx}
            style={{
              flex: 1,
              padding: px(5.5),
              display: "flex",
              flexDirection: "column",
              gap: px(1.8),
              color: "#181026",
            }}
          >
            <Kicker ctx={ctx} color={accentColor(ctx)} />
            <Title ctx={ctx} size={6.8} color="#181026" />
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
            gap: px(3.4),
          }}
        >
          <BizRow ctx={ctx} tone="dark" />
          <div
            style={{
              position: "relative",
              flex: "0 0 44%",
              borderRadius: px(3),
              overflow: "hidden",
            }}
          >
            <Img src={content.imageDataUrl} video={content.videoDataUrl} />
          </div>
          <AdjustBox
            ctx={ctx}
            style={{ display: "flex", flexDirection: "column", gap: px(1.8), color: "#131020" }}
          >
            <Kicker ctx={ctx} color={accentColor(ctx)} />
            <Title ctx={ctx} size={7.2} color="#131020" />
            <AdditionalText ctx={ctx} size={2.7} opacity={0.55} />
          </AdjustBox>
          <div style={{ marginTop: "auto", display: "flex", alignItems: "center", gap: px(2) }}>
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
        <div style={{ ...base(brand), color: "#fff" }}>
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
              padding: px(6),
              display: "flex",
              flexDirection: "column",
            }}
          >
            <AdjustBox ctx={ctx} style={{ display: "flex", flexDirection: "column", gap: px(2) }}>
              <Kicker ctx={ctx} color="rgba(255,255,255,0.88)" />
              <Title ctx={ctx} size={10} color="#fff" />
              <AdditionalText ctx={ctx} size={2.9} opacity={0.9} />
            </AdjustBox>
            <div
              style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: px(2.4) }}
            >
              <Chips
                items={[...metaItems(content, ctx.businessType), ...content.services]}
                tone="light"
              />
              <div style={{ display: "flex", alignItems: "center", gap: px(2.2) }}>
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
              flex: "0 0 42%",
              padding: px(5.5),
              display: "flex",
              flexDirection: "column",
              gap: px(1.8),
              color: "#fff",
              background: `linear-gradient(120deg, ${brand.primary}, ${brand.secondary})`,
            }}
          >
            <BizRow ctx={ctx} tone="light" />
            <AdjustBox ctx={ctx} style={{ display: "flex", flexDirection: "column", gap: px(1.8) }}>
              <Title ctx={ctx} size={7.4} color="#fff" />
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
                gap: px(2),
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
                  style={{ maxWidth: "60%", color: "#fff" }}
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
              padding: px(6),
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
                boxShadow: `0 ${px(4)} ${px(12)} -${px(4)} ${brand.primary}66`,
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
              <Title ctx={ctx} size={7} color="#141024" />
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
              padding: px(5.5),
              display: "flex",
              flexDirection: "column",
              gap: px(1.6),
              color: "#141024",
            }}
          >
            <Kicker ctx={ctx} color={accentColor(ctx)} />
            <Title ctx={ctx} size={6.6} color="#141024" />
          </AdjustBox>
          <div
            style={{
              position: "relative",
              flex: 1,
              margin: `0 ${px(5.5)}`,
              borderRadius: px(3.6),
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
          <div style={{ padding: px(5.5), display: "flex", flexDirection: "column", gap: px(2) }}>
            <Chips
              items={[...metaItems(content, ctx.businessType), ...content.services]}
              tone="dark"
            />
            <div style={{ display: "flex", alignItems: "center", gap: px(2.2) }}>
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
              padding: px(6.5),
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              alignItems: variant.align === "center" ? "center" : "flex-start",
              textAlign: variant.align,
            }}
          >
            <BizRow ctx={ctx} tone="light" />
            <AdjustBox ctx={ctx} style={{ display: "flex", flexDirection: "column", gap: px(2.2) }}>
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
            gap: px(4),
          }}
        >
          <BizRow ctx={ctx} tone="dark" />
          <div style={{ position: "relative", flex: 1, borderRadius: px(2), overflow: "hidden" }}>
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
            <Title ctx={ctx} size={6.4} color="#241c30" />
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
            color: "#fff",
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
              padding: px(6.5),
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              gap: px(2.4),
              textAlign: variant.align,
              alignItems: variant.align === "center" ? "center" : "flex-start",
            }}
          >
            <BizRow ctx={ctx} tone="light" />
            <AdjustBox ctx={ctx} style={{ display: "flex", flexDirection: "column", gap: px(2.4) }}>
              <Kicker ctx={ctx} color={brand.accent} />
              <Title ctx={ctx} size={13} color="#fff" />
              <Chips
                items={[...metaItems(content, ctx.businessType), ...content.services]}
                tone="light"
              />
              <div style={{ display: "flex", gap: px(2) }}>
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
              flex: "0 0 62%",
              padding: px(7),
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              gap: px(2.4),
            }}
          >
            <BizRow ctx={ctx} tone="dark" />
            <AdjustBox ctx={ctx} style={{ display: "flex", flexDirection: "column", gap: px(2.4) }}>
              <Kicker ctx={ctx} color={accentColor(ctx)} />
              <Title ctx={ctx} size={7.6} color="#181026" />
              <AdditionalText ctx={ctx} size={2.6} opacity={0.6} />
              <ServiceLine ctx={ctx} tone="dark" />
              <PriceBadge ctx={ctx} tone="dark" />
              <ContactLine ctx={ctx} tone="dark" />
            </AdjustBox>
          </div>
          <div style={{ position: "relative", flex: "0 0 38%" }}>
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
          <div style={{ position: "relative", flex: "0 0 40%" }}>
            <Img src={content.imageDataUrl} video={content.videoDataUrl} />
          </div>
          <AdjustBox
            ctx={ctx}
            style={{
              flex: 1,
              padding: px(5),
              display: "flex",
              flexDirection: "column",
              gap: px(1.6),
              color: "#151020",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: px(2) }}>
              <Kicker ctx={ctx} color={accentColor(ctx)} />
              <span style={{ marginLeft: "auto" }}>
                <PriceBadge ctx={ctx} tone="dark" />
              </span>
            </div>
            <Title ctx={ctx} size={6} color="#151020" />
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
              padding: px(6),
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
                gap: px(2.2),
                color: "#fff",
                justifyContent: "center",
              }}
            >
              <BizRow ctx={ctx} tone="light" />
              <Kicker ctx={ctx} color={brand.accent} />
              <Title ctx={ctx} size={7.6} color="#fff" />
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
        <div style={{ ...base(brand), color: "#fff" }}>
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
              padding: px(6),
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
                gap: px(2.2),
                alignItems: align,
                textAlign: variant.align,
                width: "100%",
              }}
            >
              <Kicker ctx={ctx} color={brand.accent} />
              <Title ctx={ctx} size={9.8} color="#fff" />
              <AdditionalText ctx={ctx} size={2.8} opacity={0.88} />
              <Chips
                items={[...metaItems(content, ctx.businessType), ...content.services]}
                tone="light"
              />
              <div style={{ display: "flex", gap: px(2), alignItems: "center" }}>
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
              gap: px(3),
            }}
          >
            <BizRow ctx={ctx} tone="light" />
            <div
              style={{
                position: "relative",
                flex: 1,
                borderRadius: px(3),
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
                <Title ctx={ctx} size={7.4} color="#fff" />
                <Chips
                  items={[...metaItems(content, ctx.businessType), ...content.services]}
                  tone="light"
                />
                <div style={{ display: "flex", gap: px(2), alignItems: "center" }}>
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
              padding: px(6),
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <AdjustBox
              ctx={ctx}
              style={{ display: "flex", flexDirection: "column", gap: px(2), color: "#fff" }}
            >
              <BizRow ctx={ctx} tone="light" />
              <Kicker ctx={ctx} color="rgba(255,255,255,0.85)" />
              <Title ctx={ctx} size={8.4} color="#fff" />
            </AdjustBox>
            <div style={{ display: "flex", flexDirection: "column", gap: px(2), color: "#fff" }}>
              <Chips
                items={[...metaItems(content, ctx.businessType), ...content.services]}
                tone="light"
              />
              <div style={{ display: "flex", gap: px(2), alignItems: "center" }}>
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
          <div style={{ position: "relative", flex: "0 0 62%" }}>
            <Img src={content.imageDataUrl} video={content.videoDataUrl} />
          </div>
          <AdjustBox
            ctx={ctx}
            style={{
              flex: 1,
              padding: px(6),
              display: "flex",
              gap: px(4),
              color: "#1a1225",
            }}
          >
            <div style={{ width: px(0.4), background: accentColor(ctx), alignSelf: "stretch" }} />
            <div style={{ display: "flex", flexDirection: "column", gap: px(1.8), flex: 1 }}>
              <Kicker ctx={ctx} color={accentColor(ctx)} />
              <Title ctx={ctx} size={6.8} color="#1a1225" />
              <AdditionalText ctx={ctx} size={2.6} opacity={0.6} />
              <ServiceLine ctx={ctx} tone="dark" />
              <div style={{ marginTop: "auto", display: "flex", alignItems: "center", gap: px(2) }}>
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
              padding: px(6),
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: variant.align === "center" ? "center" : "flex-start",
              textAlign: variant.align,
            }}
          >
            <AdjustBox
              ctx={ctx}
              style={{ display: "flex", flexDirection: "column", gap: px(2), color: "#fff" }}
            >
              <Kicker ctx={ctx} color="rgba(255,255,255,0.85)" />
              <Title ctx={ctx} size={8.6} color="#fff" />
              <ServiceLine ctx={ctx} tone="light" />
              <div style={{ display: "flex", gap: px(2), alignItems: "center" }}>
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
        <div style={{ ...base(brand), color: "#fff" }}>
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
              padding: px(6),
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <BizRow ctx={ctx} tone="light" />
            <AdjustBox
              ctx={ctx}
              style={{ display: "flex", flexDirection: "column", gap: px(2.2), width: "58%" }}
            >
              <Kicker ctx={ctx} color="rgba(255,255,255,0.88)" />
              <Title ctx={ctx} size={8} color="#fff" />
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
              padding: px(6),
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <BizRow ctx={ctx} tone="light" />
            <AdjustBox
              ctx={ctx}
              style={{ display: "flex", flexDirection: "column", gap: px(2), color: "#fff" }}
            >
              <Kicker ctx={ctx} color={brand.accent} />
              <Title ctx={ctx} size={7.6} color="#fff" />
              <Chips
                items={[...metaItems(content, ctx.businessType), ...content.services]}
                tone="light"
              />
              <div style={{ display: "flex", gap: px(2), alignItems: "center" }}>
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
          <div style={{ position: "relative", flex: "0 0 50%" }}>
            <Img src={content.imageDataUrl} video={content.videoDataUrl} />
          </div>
          <AdjustBox
            ctx={ctx}
            style={{
              flex: "0 0 50%",
              padding: px(5),
              display: "flex",
              flexDirection: "column",
              gap: px(1.7),
              color: "#fff",
              background: `linear-gradient(165deg, ${brand.primary}, ${brand.secondary})`,
            }}
          >
            <BizRow ctx={ctx} tone="light" />
            <Kicker ctx={ctx} color="rgba(255,255,255,0.85)" />
            <Title ctx={ctx} size={5.8} color="#fff" />
            <AdditionalText ctx={ctx} size={2.3} opacity={0.85} />
            <Chips
              items={[...metaItems(content, ctx.businessType), ...content.services]}
              tone="light"
            />
            <div
              style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: px(1.4) }}
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
              color: "#fff",
            }}
          >
            <Kicker ctx={ctx} color="rgba(255,255,255,0.85)" />
            <Title ctx={ctx} size={6.6} color="#fff" />
            <Chips
              items={[...metaItems(content, ctx.businessType), ...content.services]}
              tone="light"
            />
            <div style={{ display: "flex", gap: px(2), alignItems: "center" }}>
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
          <div style={{ position: "relative", flex: "0 0 58%" }}>
            <Img src={content.imageDataUrl} video={content.videoDataUrl} />
          </div>
          <AdjustBox
            ctx={ctx}
            style={{
              flex: 1,
              padding: px(6),
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              textAlign: "center",
              justifyContent: "center",
              gap: px(2),
              color: "#181026",
            }}
          >
            <Kicker ctx={ctx} color={accentColor(ctx)} />
            <Title ctx={ctx} size={6.2} color="#181026" />
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
          <Img src={content.imageDataUrl} video={content.videoDataUrl} style={{ opacity: 0.62 }} />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "radial-gradient(120% 90% at 50% 40%, transparent 30%, rgba(10,7,18,.85) 90%)",
            }}
          />
          <div
            style={{ position: "absolute", inset: px(4.2), border: `1px solid ${brand.accent}88` }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              padding: px(6.5),
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
                gap: px(2.2),
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
        <div style={{ ...base(brand), color: "#fff" }}>
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
              padding: px(6),
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
              <Title ctx={ctx} size={13.5} color="#fff" />
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
          <div style={{ position: "relative", flex: "0 0 72%" }}>
            <Img src={content.imageDataUrl} video={content.videoDataUrl} />
            <div style={{ position: "absolute", left: px(4), top: px(4) }}>
              <BizRow ctx={ctx} tone="light" />
            </div>
          </div>
          <AdjustBox
            ctx={ctx}
            style={{
              flex: 1,
              padding: `${px(3.4)} ${px(5)}`,
              display: "flex",
              alignItems: "center",
              gap: px(3),
              color: "#fff",
              background: `linear-gradient(120deg, ${brand.primary}, ${brand.secondary})`,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: px(0.8), flex: 1 }}>
              <Kicker ctx={ctx} color="rgba(255,255,255,0.85)" />
              <Title ctx={ctx} size={5.2} color="#fff" />
              <ServiceLine ctx={ctx} tone="light" />
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: px(1),
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
        <div style={{ ...base(brand), color: "#fff" }}>
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
              padding: px(6),
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
                gap: px(2.4),
                width: "100%",
              }}
            >
              <Kicker ctx={ctx} color="rgba(255,255,255,0.9)" />
              <Title ctx={ctx} size={9} color="#fff" />
              <div style={{ display: "flex", justifyContent: "center", width: "100%" }}>
                <PriceBadge ctx={ctx} tone="light" />
              </div>
            </AdjustBox>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: px(1.6),
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
        <div style={{ ...base(brand), color: "#fff" }}>
          <Img src={content.imageDataUrl} video={content.videoDataUrl} />
          <div
            style={{
              position: "absolute",
              inset: 0,
              padding: px(5),
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-end",
              gap: px(2.4),
            }}
          >
            <AdjustBox
              ctx={ctx}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: px(2),
                borderRadius: px(3),
                padding: px(4),
                background: `${brand.primary}e6`,
                backdropFilter: "blur(10px)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: px(2.4) }}>
                <Logo ctx={ctx} />
                <div style={{ marginLeft: "auto" }}>
                  <PriceBadge ctx={ctx} tone="light" />
                </div>
              </div>
              <Title ctx={ctx} size={7} color="#fff" />
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
        <div style={{ ...base(brand), color: "#fff" }}>
          <Img src={content.imageDataUrl} video={content.videoDataUrl} />
          <div
            style={{
              position: "absolute",
              inset: 0,
              padding: px(5.5),
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
              style={{ display: "flex", alignItems: "flex-end", gap: px(3), width: "100%" }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: px(1.4), flex: 1 }}>
                <Title ctx={ctx} size={6.4} color="#fff" />
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
            padding: px(5.5),
            display: "flex",
            flexDirection: "column",
            gap: px(3.4),
          }}
        >
          <BizRow ctx={ctx} tone="dark" />
          <div
            style={{
              position: "relative",
              flex: "0 0 52%",
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
              color: "#1b1329",
            }}
          >
            <Kicker ctx={ctx} color={accentColor(ctx)} />
            <Title ctx={ctx} size={7} color="#1b1329" />
            <Chips
              items={[...metaItems(content, ctx.businessType), ...content.services]}
              tone="dark"
            />
            <div style={{ display: "flex", gap: px(2), alignItems: "center", flexWrap: "wrap" }}>
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
            padding: px(6),
            display: "flex",
            flexDirection: "column",
            gap: px(3.2),
          }}
        >
          <BizRow ctx={ctx} tone="dark" />
          <div
            style={{
              position: "relative",
              flex: "0 0 48%",
              overflow: "hidden",
              borderRadius: px(4.5),
              boxShadow: `0 ${px(2.4)} ${px(6)} rgba(24,16,44,0.16)`,
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
              color: "#191128",
            }}
          >
            <Kicker ctx={ctx} color={accentColor(ctx)} />
            <Title ctx={ctx} size={6.6} color="#191128" />
            <AdditionalText ctx={ctx} size={2.6} opacity={0.66} />
            <ServiceLine ctx={ctx} tone="dark" />
            <div style={{ display: "flex", gap: px(2), alignItems: "center", flexWrap: "wrap" }}>
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
            color: "#fff",
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
                padding: px(6),
                display: "flex",
                flexDirection: "column",
                justifyContent: "flex-end",
              }}
            >
              <AdjustBox ctx={ctx} style={{ display: "flex", flexDirection: "column", gap: px(2) }}>
                <Title ctx={ctx} size={9} color="#fff" />
                <Chips
                  items={[...metaItems(content, ctx.businessType), ...content.services]}
                  tone="light"
                />
                <div
                  style={{ display: "flex", gap: px(2), alignItems: "center", flexWrap: "wrap" }}
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
              padding: px(6),
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
                gap: px(2),
                paddingTop: px(10),
              }}
            >
              <Kicker ctx={ctx} color="rgba(255,255,255,0.9)" />
              <Title ctx={ctx} size={7.8} color="#fff" />
              <AdditionalText ctx={ctx} size={2.6} opacity={0.82} />
              <ServiceLine ctx={ctx} tone="light" />
              <div style={{ display: "flex", gap: px(2), alignItems: "center" }}>
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
              padding: px(8),
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
              <Title ctx={ctx} size={7.4} color="#fff" />
              <div
                style={{
                  display: "flex",
                  gap: px(3),
                  flexWrap: "wrap",
                  fontSize: px(2.4),
                  fontWeight: 600,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  fontFamily: fontSecondary(brand),
                  color: "rgba(255,255,255,0.82)",
                }}
              >
                {[...metaItems(content, ctx.businessType), ...content.services]
                  .slice(0, 5)
                  .map((item) => (
                    <span key={item}>{item}</span>
                  ))}
              </div>
              <div style={{ display: "flex", gap: px(2), alignItems: "center", flexWrap: "wrap" }}>
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
            gap: px(3),
          }}
        >
          <div
            style={{
              position: "relative",
              flex: "0 0 60%",
              overflow: "hidden",
              borderRadius: px(3),
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
                  padding: `${px(2)} ${px(3.2)}`,
                  borderRadius: px(2),
                  background: accentColor(ctx),
                  color: "#fff",
                  fontWeight: 800,
                  fontSize: px(4.6),
                  letterSpacing: "-0.02em",
                  fontFamily: font(brand),
                  boxShadow: `0 ${px(1.2)} ${px(3)} rgba(20,12,36,0.28)`,
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
              gap: px(1.6),
              justifyContent: "center",
              color: "#1a1226",
            }}
          >
            <Kicker ctx={ctx} color={accentColor(ctx)} />
            <Title ctx={ctx} size={7.2} color="#1a1226" />
            <Chips
              items={[...metaItems(content, ctx.businessType), ...content.services]}
              tone="dark"
            />
            <div style={{ display: "flex", gap: px(2), alignItems: "center", flexWrap: "wrap" }}>
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
    id: "boardingpass",
    label: "Boarding Pass",
    tags: ["bold", "light", "dense"],
    render: (ctx) => {
      const { content, brand } = ctx;
      const from = codeOf(ctx.businessName, "OUT");
      const to = codeOf(content.subject || content.location, "DXB");
      return (
        <div
          style={{
            ...base(brand),
            background: bgOr(brand, "#eef0f7"),
            padding: px(4.5),
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              background: "#fff",
              borderRadius: px(3),
              overflow: "hidden",
              boxShadow: `0 ${px(2)} ${px(5)} rgba(20,14,38,0.14)`,
            }}
          >
            <div
              style={{
                background: brand.primary,
                padding: `${px(3)} ${px(4)}`,
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
                  color: "rgba(255,255,255,0.86)",
                  fontFamily: fontSecondary(brand),
                }}
              >
                BOARDING PASS
              </span>
            </div>
            <div style={{ position: "relative", flex: "0 0 34%" }}>
              <Img src={content.imageDataUrl} video={content.videoDataUrl} />
            </div>
            <div
              style={{
                padding: `${px(3.5)} ${px(4)}`,
                display: "flex",
                flexDirection: "column",
                gap: px(2.4),
              }}
            >
              <RouteLine from={from} to={to} color={brand.primary} />
              <div style={{ display: "flex", gap: px(5), flexWrap: "wrap" }}>
                <TicketField ctx={ctx} label="Flight" value={content.title} tone="dark" />
                <TicketField ctx={ctx} label="Date" value={content.date} tone="dark" />
                <TicketField ctx={ctx} label="Nights" value={content.meta1} tone="dark" />
              </div>
            </div>
            <Perforation color={bgOr(brand, "#eef0f7")} />
            <div
              style={{
                padding: `${px(3)} ${px(4)} ${px(3.5)}`,
                display: "flex",
                flexDirection: "column",
                gap: px(1.6),
              }}
            >
              <ServiceLine ctx={ctx} tone="dark" />
              <div
                style={{ display: "flex", alignItems: "center", gap: px(2.4), flexWrap: "wrap" }}
              >
                <PriceBadge ctx={ctx} tone="dark" />
                <CtaTag ctx={ctx} tone="dark" />
                <span style={{ marginLeft: "auto" }}>
                  <Barcode color={brand.primary} />
                </span>
              </div>
              <ContactLine ctx={ctx} tone="dark" />
            </div>
          </div>
        </div>
      );
    },
  },
  {
    id: "routeflight",
    label: "Route",
    tags: ["image_first", "bold", "gradient"],
    render: (ctx) => {
      const { content, brand } = ctx;
      return (
        <div style={{ ...base(brand), background: "#0d0a18" }}>
          <Img src={content.imageDataUrl} video={content.videoDataUrl} />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `linear-gradient(to top, ${brand.primary}f2 10%, ${brand.primary}55 44%, transparent 70%)`,
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              padding: px(6),
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <BizRow ctx={ctx} tone="light" />
            <div style={{ display: "flex", flexDirection: "column", gap: px(3) }}>
              <RouteLine
                from={codeOf(ctx.businessName, "OUT")}
                to={codeOf(content.subject || content.location, "DXB")}
                color="#fff"
              />
              <OfferStack ctx={ctx} tone="light" titleSize={8} />
            </div>
          </div>
        </div>
      );
    },
  },
  {
    id: "departureboard",
    label: "Departure Board",
    tags: ["dark", "type_first", "dense"],
    render: (ctx) => {
      const { content, brand } = ctx;
      const rows = [
        ["Destination", content.subject || content.location],
        ["Departs", content.date],
        ["Nights", content.meta1],
      ].filter(([, v]) => !!v) as [string, string][];
      return (
        <div
          style={{
            ...base(brand),
            background: "#0b0d14",
            padding: px(5),
            display: "flex",
            flexDirection: "column",
            gap: px(3),
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <BizRow ctx={ctx} tone="light" />
            <span
              style={{
                fontSize: px(2.1),
                fontWeight: 800,
                letterSpacing: "0.24em",
                color: brand.accent,
                fontFamily: fontSecondary(brand),
              }}
            >
              DEPARTURES
            </span>
          </div>
          <div
            style={{
              position: "relative",
              flex: "0 0 30%",
              overflow: "hidden",
              borderRadius: px(2),
            }}
          >
            <Img
              src={content.imageDataUrl}
              video={content.videoDataUrl}
              style={{ opacity: 0.75 }}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: px(1.4) }}>
            {rows.map(([label, value]) => (
              <div
                key={label}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  gap: px(2),
                  borderBottom: "1px solid rgba(255,255,255,0.14)",
                  paddingBottom: px(1.2),
                }}
              >
                <span
                  style={{
                    fontSize: px(2.1),
                    fontWeight: 700,
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    color: "rgba(255,255,255,0.55)",
                    fontFamily: fontSecondary(brand),
                  }}
                >
                  {label}
                </span>
                <span
                  style={{
                    fontSize: px(3.4),
                    fontWeight: 800,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: brand.accent,
                    fontFamily: font(brand),
                  }}
                >
                  {value}
                </span>
              </div>
            ))}
          </div>
          <OfferStack ctx={ctx} tone="light" titleSize={6.6} chips={false} />
        </div>
      );
    },
  },
  {
    id: "ticketstub",
    label: "Ticket Stub",
    tags: ["light", "image_first", "bold"],
    render: (ctx) => {
      const { content, brand } = ctx;
      return (
        <div
          style={{
            ...base(brand),
            background: bgOr(brand, "#f4f1fb"),
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ position: "relative", flex: "0 0 54%" }}>
            <Img src={content.imageDataUrl} video={content.videoDataUrl} />
            <span
              style={{
                position: "absolute",
                left: px(5),
                top: px(5),
                padding: `${px(1.2)} ${px(2.6)}`,
                borderRadius: px(9),
                background: "rgba(255,255,255,0.92)",
                color: brand.primary,
                fontWeight: 800,
                fontSize: px(2.3),
                letterSpacing: "0.16em",
                fontFamily: fontSecondary(brand),
              }}
            >
              FLIGHT DEAL
            </span>
          </div>
          <Perforation color={bgOr(brand, "#f4f1fb")} />
          <div style={{ flex: 1, padding: `${px(3)} ${px(5.5)} ${px(5)}` }}>
            <OfferStack ctx={ctx} tone="dark" titleSize={7} />
          </div>
        </div>
      );
    },
  },
  {
    id: "luggagetag",
    label: "Luggage Tag",
    tags: ["light", "minimal", "whitespace"],
    render: (ctx) => {
      const { content, brand } = ctx;
      return (
        <div
          style={{
            ...base(brand),
            background: bgOr(brand, `linear-gradient(160deg, ${brand.secondary}22, #ffffff 60%)`),
            padding: px(5),
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: px(2.6),
          }}
        >
          {/* the hole and strap of a tag tied to a case */}
          <span
            style={{
              width: px(3.4),
              height: px(3.4),
              borderRadius: "50%",
              border: `${px(0.8)} solid ${brand.primary}`,
            }}
          />
          <div
            style={{
              flex: 1,
              width: "100%",
              display: "flex",
              flexDirection: "column",
              borderRadius: px(4),
              overflow: "hidden",
              border: `${px(0.5)} solid ${brand.primary}44`,
              background: "#fff",
            }}
          >
            <div style={{ position: "relative", flex: "0 0 46%" }}>
              <Img src={content.imageDataUrl} video={content.videoDataUrl} />
            </div>
            <div
              style={{
                flex: 1,
                padding: px(4),
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
              }}
            >
              <OfferStack ctx={ctx} tone="dark" titleSize={6.4} chips={false} />
            </div>
          </div>
          <BizRow ctx={ctx} tone="dark" />
        </div>
      );
    },
  },
  {
    id: "farebarcode",
    label: "Fare",
    tags: ["minimal", "light", "type_first"],
    render: (ctx) => {
      const { content, brand } = ctx;
      return (
        <div
          style={{
            ...base(brand),
            background: bgOr(brand, "#ffffff"),
            padding: px(6),
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}
          >
            <BizRow ctx={ctx} tone="dark" />
            <Barcode color={brand.primary} height={8} />
          </div>
          <div
            style={{
              position: "relative",
              flex: "0 0 40%",
              overflow: "hidden",
              borderRadius: px(2.5),
              margin: `${px(3)} 0`,
            }}
          >
            <Img src={content.imageDataUrl} video={content.videoDataUrl} />
          </div>
          <OfferStack ctx={ctx} tone="dark" titleSize={7.4} />
        </div>
      );
    },
  },
  {
    id: "gateblocks",
    label: "Gate",
    tags: ["dense", "light", "bold"],
    render: (ctx) => {
      const { content, brand } = ctx;
      const cells = [
        ["Gate", codeOf(content.subject || content.location, "A12")],
        ["Date", content.date],
        ["Nights", content.meta1],
        ["Hotel", content.location],
      ].filter(([, v]) => !!v) as [string, string][];
      return (
        <div
          style={{
            ...base(brand),
            background: bgOr(brand, "#f6f4fd"),
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ position: "relative", flex: "0 0 40%" }}>
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
              gap: px(3),
            }}
          >
            <OfferStack ctx={ctx} tone="dark" titleSize={6.8} chips={false} contact={false} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: px(1.6) }}>
              {cells.slice(0, 4).map(([label, value]) => (
                <div
                  key={label}
                  style={{
                    background: "#fff",
                    borderRadius: px(2),
                    padding: `${px(1.8)} ${px(2.4)}`,
                    border: `1px solid ${brand.primary}22`,
                  }}
                >
                  <TicketField ctx={ctx} label={label} value={value} tone="dark" />
                </div>
              ))}
            </div>
            <ContactLine ctx={ctx} tone="dark" />
          </div>
        </div>
      );
    },
  },
  {
    id: "skytrail",
    label: "Sky Trail",
    tags: ["gradient", "light", "image_first"],
    render: (ctx) => {
      const { content, brand } = ctx;
      return (
        <div
          style={{
            ...base(brand),
            background: `linear-gradient(180deg, ${brand.secondary}, ${brand.primary}dd 58%, ${brand.primary})`,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* a vapour trail arcing away from the plane */}
          <div
            style={{
              position: "absolute",
              left: `-${px(4)}`,
              right: px(10),
              top: "20%",
              height: px(0.6),
              background:
                "repeating-linear-gradient(90deg, rgba(255,255,255,0.75) 0 3%, transparent 3% 6%)",
              transform: "rotate(-8deg)",
            }}
          />
          <span
            style={{
              position: "absolute",
              right: px(8),
              top: "17%",
              width: 0,
              height: 0,
              borderTop: `${px(1.4)} solid transparent`,
              borderBottom: `${px(1.4)} solid transparent`,
              borderLeft: `${px(3)} solid #ffffff`,
              transform: "rotate(-8deg)",
            }}
          />
          <div style={{ padding: `${px(5)} ${px(5)} 0` }}>
            <BizRow ctx={ctx} tone="light" />
          </div>
          <div
            style={{
              position: "relative",
              flex: "0 0 44%",
              margin: `${px(6)} ${px(5)} ${px(4)}`,
              overflow: "hidden",
              borderRadius: px(5),
            }}
          >
            <Img src={content.imageDataUrl} video={content.videoDataUrl} />
          </div>
          <div style={{ flex: 1, padding: `0 ${px(5)} ${px(5)}` }}>
            <OfferStack ctx={ctx} tone="light" titleSize={7} align="center" />
          </div>
        </div>
      );
    },
  },
  {
    id: "windowseat",
    label: "Window Seat",
    tags: ["light", "minimal", "image_first"],
    render: (ctx) => {
      const { content, brand } = ctx;
      return (
        <div
          style={{
            ...base(brand),
            background: bgOr(brand, "#e9e6f3"),
            padding: px(5.5),
            display: "flex",
            flexDirection: "column",
            gap: px(3.4),
          }}
        >
          {/* the view through a cabin window */}
          <div
            style={{
              position: "relative",
              flex: "0 0 50%",
              overflow: "hidden",
              borderRadius: "42% 42% 42% 42% / 30% 30% 30% 30%",
              border: `${px(1.4)} solid #ffffff`,
              boxShadow: `0 ${px(1.6)} ${px(4)} rgba(24,16,44,0.18)`,
            }}
          >
            <Img src={content.imageDataUrl} video={content.videoDataUrl} />
          </div>
          <OfferStack ctx={ctx} tone="dark" titleSize={6.8} align="center" />
        </div>
      );
    },
  },
  {
    id: "lastcall",
    label: "Last Call",
    tags: ["bold", "dark", "type_first"],
    render: (ctx) => {
      const { content, brand } = ctx;
      return (
        <div style={{ ...base(brand), background: "#120d1f" }}>
          <Img src={content.imageDataUrl} video={content.videoDataUrl} style={{ opacity: 0.5 }} />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `linear-gradient(140deg, ${brand.primary}cc, rgba(18,13,31,0.92))`,
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              padding: px(6),
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <BizRow ctx={ctx} tone="light" />
              <span
                style={{
                  padding: `${px(1)} ${px(2.4)}`,
                  borderRadius: px(9),
                  background: brand.accent,
                  color: "#1a1226",
                  fontWeight: 800,
                  fontSize: px(2.2),
                  letterSpacing: "0.16em",
                  fontFamily: fontSecondary(brand),
                }}
              >
                LAST SEATS
              </span>
            </div>
            <OfferStack ctx={ctx} tone="light" titleSize={9.6} gap={2.2} />
            <Barcode color="rgba(255,255,255,0.7)" height={5} />
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
          <div style={{ position: "relative", flex: "0 0 56%" }}>
            <Img src={content.imageDataUrl} video={content.videoDataUrl} />
            <div style={{ position: "absolute", left: px(5), top: px(5) }}>
              <BizRow ctx={ctx} tone="light" />
            </div>
          </div>
          <Scallop color={sand} size={7} />
          <div style={{ flex: 1, padding: `${px(2)} ${px(5.5)} ${px(5)}` }}>
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
              padding: px(6),
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
                padding: px(4.5),
                boxShadow: `0 ${px(2)} ${px(5)} rgba(6,20,28,0.22)`,
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
          <div style={{ position: "relative", flex: "0 0 38%" }}>
            <Img src={content.imageDataUrl} video={content.videoDataUrl} />
          </div>
          <div
            style={{
              flex: 1,
              padding: px(5.5),
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              background: `linear-gradient(180deg, ${brand.primary}, #06222c)`,
            }}
          >
            <OfferStack ctx={ctx} tone="light" titleSize={7.8} />
          </div>
          <div style={{ position: "relative", flex: "0 0 16%" }}>
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
              border: `${px(1)} solid rgba(255,255,255,0.8)`,
            }}
          >
            <Img src={content.imageDataUrl} video={content.videoDataUrl} />
          </div>
          <div
            style={{
              position: "absolute",
              inset: 0,
              padding: px(6),
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
            padding: px(5.5),
            display: "flex",
            flexDirection: "column",
            gap: px(3),
          }}
        >
          <BizRow ctx={ctx} tone="dark" />
          <div
            style={{
              position: "relative",
              flex: "0 0 46%",
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
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 800,
                fontSize: px(3.6),
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
            padding: px(4),
            display: "flex",
          }}
        >
          <div
            style={{
              flex: 1,
              background: "#fff",
              padding: px(3),
              display: "flex",
              flexDirection: "column",
              gap: px(3),
              boxShadow: `0 ${px(1.4)} ${px(3.4)} rgba(20,16,32,0.12)`,
            }}
          >
            <div style={{ position: "relative", flex: "0 0 52%", overflow: "hidden" }}>
              <Img src={content.imageDataUrl} video={content.videoDataUrl} />
              {/* the stamp corner of a card sent home */}
              <span
                style={{
                  position: "absolute",
                  right: px(2.4),
                  top: px(2.4),
                  width: px(11),
                  height: px(13),
                  border: `${px(0.6)} dashed rgba(255,255,255,0.9)`,
                  borderRadius: px(1),
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  fontSize: px(2),
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
              padding: px(6),
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
                gap: px(0.6),
                color: "#fff",
                fontFamily: font(brand),
              }}
            >
              <span style={{ fontSize: px(2), letterSpacing: "0.2em", opacity: 0.8 }}>NGA</span>
              <span style={{ fontSize: px(6.4), fontWeight: 800 }}>
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
              gap: px(3),
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
            padding: px(6),
            display: "flex",
            flexDirection: "column",
            gap: px(3),
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
          <div style={{ position: "relative", flex: 1, overflow: "hidden", borderRadius: px(2) }}>
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
            gap: px(3),
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
              flex: "0 0 38%",
              overflow: "hidden",
              borderRadius: px(2),
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
              padding: px(6),
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
          <div style={{ position: "relative", flex: "0 0 38%" }}>
            <Img src={content.imageDataUrl} video={content.videoDataUrl} />
            <div style={{ position: "absolute", left: px(5), bottom: px(4) }}>
              <BizRow ctx={ctx} tone="light" />
            </div>
          </div>
          <div
            style={{
              flex: 1,
              padding: px(5.5),
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
            padding: px(6),
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
          <div style={{ display: "flex", gap: px(2), justifyContent: "space-between" }}>
            <Stamp ctx={ctx} color={`${brand.primary}aa`} rotate={-7} size={17} />
            <Stamp ctx={ctx} color={`${brand.secondary}aa`} rotate={6} size={17} />
            <Stamp ctx={ctx} color={`${brand.accent}dd`} rotate={-3} size={17} />
          </div>
          <div
            style={{
              position: "relative",
              flex: "0 0 40%",
              overflow: "hidden",
              borderRadius: px(2),
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
              padding: px(6),
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
            gap: px(1),
          }}
        >
          <div style={{ display: "flex", gap: px(1), flex: "0 0 46%" }}>
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
              padding: px(5.5),
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              gap: px(2.4),
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
            padding: px(6),
            display: "flex",
            flexDirection: "column",
            gap: px(2.6),
          }}
        >
          <BizRow ctx={ctx} tone="dark" />
          <span style={{ height: px(0.3), background: `${brand.primary}44` }} />
          <OfferStack ctx={ctx} tone="dark" titleSize={7.8} chips={false} contact={false} />
          <div style={{ position: "relative", flex: 1, overflow: "hidden", borderRadius: px(1.6) }}>
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
              padding: px(6),
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
                  color: "rgba(255,255,255,0.16)",
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
              padding: px(6),
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
              padding: px(6),
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
                borderRadius: px(3.4),
                padding: px(4.4),
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
          <div style={{ position: "relative", flex: "0 0 52%" }}>
            <Img src={content.imageDataUrl} video={content.videoDataUrl} />
            <Snowfall count={18} color="rgba(255,255,255,0.9)" />
          </div>
          {/* a snow line running under the picture */}
          <Scallop color={snow} size={8} count={7} />
          <div style={{ flex: 1, padding: `${px(2.4)} ${px(5.5)} ${px(5)}` }}>
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
              padding: px(6),
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
                padding: `${px(1)} ${px(3)}`,
                borderRadius: px(9),
                background: "rgba(255,255,255,0.9)",
                color: brand.primary,
                fontWeight: 800,
                fontSize: px(2.3),
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
              padding: px(6.5),
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
              flex: "0 0 46%",
              margin: `0 ${px(5)}`,
              overflow: "hidden",
              borderRadius: px(3),
            }}
          >
            <Img src={content.imageDataUrl} video={content.videoDataUrl} />
            <div style={{ position: "absolute", left: 0, right: 0, top: 0 }}>
              <Scallop color="#ffffff" size={6} count={8} flip />
            </div>
          </div>
          <div style={{ flex: 1, padding: `${px(3.5)} ${px(5)} ${px(5)}` }}>
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
            padding: px(4.5),
            display: "flex",
          }}
        >
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              background: "#fff",
              borderRadius: px(3),
              overflow: "hidden",
              boxShadow: `0 ${px(2)} ${px(5)} rgba(12,32,54,0.16)`,
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
                  fontSize: px(2.1),
                  fontWeight: 800,
                  letterSpacing: "0.2em",
                  color: "rgba(255,255,255,0.9)",
                  fontFamily: fontSecondary(brand),
                }}
              >
                SEASON PASS
              </span>
            </div>
            <div style={{ position: "relative", flex: "0 0 40%" }}>
              <Img src={content.imageDataUrl} video={content.videoDataUrl} />
              <Snowfall count={14} />
            </div>
            <div
              style={{
                padding: `${px(3.4)} ${px(4)}`,
                display: "flex",
                flexDirection: "column",
                gap: px(2.2),
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
              <div style={{ display: "flex", gap: px(4), flexWrap: "wrap" }}>
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
      const band = `repeating-linear-gradient(135deg, ${brand.primary} 0 ${px(1.6)}, transparent ${px(1.6)} ${px(3.2)})`;
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
          <div style={{ position: "relative", flex: "0 0 46%" }}>
            <Img src={content.imageDataUrl} video={content.videoDataUrl} />
          </div>
          <div style={{ flex: 1, padding: px(5.5) }}>
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
              border: `${px(0.5)} solid rgba(255,255,255,0.85)`,
              borderRadius: px(1),
            }}
          />
          <Snowfall count={16} />
          <div
            style={{
              position: "absolute",
              inset: 0,
              padding: px(7.5),
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
              padding: px(6),
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <BizRow ctx={ctx} tone="light" />
              <span
                style={{
                  padding: `${px(1)} ${px(2.6)}`,
                  borderRadius: px(1.4),
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
  boardingpass: "Boarding Pass",
  routeflight: "Route",
  departureboard: "Departure Board",
  ticketstub: "Ticket Stub",
  luggagetag: "Luggage Tag",
  farebarcode: "Fare",
  gateblocks: "Gate",
  skytrail: "Sky Trail",
  windowseat: "Window Seat",
  lastcall: "Last Call",
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
    "boardingpass",
    "routeflight",
    "departureboard",
    "ticketstub",
    "luggagetag",
    "farebarcode",
    "gateblocks",
    "skytrail",
    "windowseat",
    "lastcall",
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
];

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
