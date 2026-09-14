import { formatPrice } from "./constants";
import { INK } from "./tokens";
import type {
  BrandProfile,
  BusinessType,
  ContentFormat,
  PostAdjustments,
  PostContent,
  Template,
  TemplateCollection,
  TemplateTag,
  TemplateVariant,
  TemplateZone,
} from "./types";

/**
 * Deterministic template system.
 *
 * Layout is owned 100 percent by the engines registered here. AI only writes
 * text. Placeholders a design may draw on: title, subject, location, price,
 * date, meta1, meta2, services, additionalText, cta, image, logo, business
 * name.
 *
 * The library is currently empty. The previous set of 142 designs was removed
 * to make room for a new system, and the machinery they were built on stayed:
 * the render context, the container relative unit, the brand colour helpers,
 * the uploaded template renderer and the selectors the app picks with. A new
 * design is an entry in `engines` plus an entry in `globalTemplates`.
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

/** Every size in a design is container relative, so a thumbnail and a 1080
 * pixel export are the same drawing at two scales. */
const px = (n: number) => `${n}cqw`;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const font = (brand: BrandProfile) =>
  `"${brand.fontFamily}", "Sora", ui-sans-serif, system-ui, sans-serif`;

const fontSecondary = (brand: BrandProfile) =>
  `"${brand.fontSecondary || brand.fontFamily}", "Sora", ui-sans-serif, system-ui, sans-serif`;

/** The picture under a design: uploaded footage first, then the still, then a
 * plain ground so a design never renders on nothing. */
function Img({ src, video }: { src: string | null; video?: string | null | undefined }) {
  const style: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    height: "100%",
    width: "100%",
    objectFit: "cover",
  };
  if (video)
    return (
      <video src={video} autoPlay loop muted playsInline crossOrigin="anonymous" style={style} />
    );
  if (!src)
    return (
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(140deg, #e9e4f7, #d6cbf3)",
        }}
      />
    );
  return <img src={src} alt="" crossOrigin="anonymous" style={style} />;
}

const base = (brand: BrandProfile): React.CSSProperties => ({
  position: "absolute",
  inset: 0,
  fontFamily: font(brand),
  overflow: "hidden",
});

/* --------------------------------- engines --------------------------------- */

type Engine = {
  id: string;
  label: string;
  tags: TemplateTag[];
  render: (ctx: RenderCtx) => React.ReactNode;
};

const engines: Engine[] = [];

export const engineIds = [...engines.map((e) => e.id), "custom"];

const engineMap = new Map(engines.map((e) => [e.id, e]));

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

/* --------------------------------- fallback -------------------------------- */

/**
 * What a post renders on when its design is not in the library.
 *
 * It is never offered in the picker and never counted as a template. It exists
 * so a post saved against a design that has since been removed still shows its
 * own picture and words instead of crashing the page it appears on.
 */
function renderFallback(ctx: RenderCtx): React.ReactNode {
  const { content, brand } = ctx;
  const price = formatPrice(content.price, brand.currency);
  return (
    <div style={{ ...base(brand), color: INK.onDark }}>
      <Img src={content.imageDataUrl} video={content.videoDataUrl} />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(to top, rgba(10,12,20,0.86) 6%, rgba(10,12,20,0.24) 38%, rgba(10,12,20,0) 62%)",
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
        {content.title ? (
          <h2
            style={{
              margin: 0,
              fontSize: px(7),
              lineHeight: 1.05,
              fontWeight: 800,
              letterSpacing: "-0.03em",
              fontFamily: font(brand),
            }}
          >
            {content.title}
          </h2>
        ) : null}
        {price ? (
          <span
            style={{
              fontSize: px(4.2),
              fontWeight: 800,
              whiteSpace: "nowrap",
              fontFamily: font(brand),
            }}
          >
            {price}
          </span>
        ) : null}
      </div>
    </div>
  );
}

/**
 * A stand-in for a design that is no longer in the library.
 *
 * A post keeps the id of the design it was built on. When that design is gone
 * the post is still a real post, so it is handed this and rendered by the
 * fallback above rather than disappearing from the page.
 */
export function removedTemplate(id: string): Template {
  return {
    id,
    name: "Design removed",
    engine: "removed",
    tags: ["image_first"],
    variant: { align: "left", tone: "dark", badge: "pill", accent: "primary" },
    scope: "global",
    businessId: null,
    archived: false,
  };
}

/* -------------------------------- selectors -------------------------------- */

/** The library. Empty until the new system's designs are added. */
export const globalTemplates: Template[] = [];

/** The set of designs a trade owns. A trade listed here is shown its own set
 * and nothing else, so a property brand never scrolls through flight offers. */
const OWN_COLLECTION: Partial<Record<BusinessType, TemplateCollection>> = {};

/**
 * Templates a business is allowed to pick from.
 *
 * A trade with its own set sees that set alone, plus whatever it uploaded
 * itself. A trade without its own set keeps the whole library, minus the
 * designs another trade owns: those are built around fields such as a
 * property's rooms and floor area and would print half empty.
 *
 * The list handed in is already narrowed to one format. A format the trade set
 * does not cover would otherwise offer nothing at all, so there the plain
 * library stands in, without occasion designs or another trade's set.
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
  // An engine that is not registered is not an error to throw at the reader:
  // the post still has a picture and words, so those are what it shows.
  const engine = engineMap.get(template.engine);
  return engine ? engine.render(ctx) : renderFallback(ctx);
}
