/**
 * The design scales every template measures itself against.
 *
 * Before this file the library had grown 23 padding values, 22 gaps, 16 corner
 * radii, 21 type sizes and 72 hardcoded colours - among them the same near
 * black written eight slightly different ways. No single one of those is
 * visible, but together they are exactly what separates a set of designs that
 * were laid out on a system from a set that was laid out by eye: edges that
 * almost line up, type that almost steps, greys that almost match.
 *
 * Every value is in cqw, the container relative unit the whole template system
 * is sized in, so a scale step means the same thing on a thumbnail and on a
 * 1080 pixel export.
 */

/** Spacing, on a ~1.4 ratio. Gaps, padding and insets pick from here. */
export const SPACE = {
  /** hairline gaps inside a control */
  xxs: 0.4,
  xs: 0.8,
  sm: 1.2,
  md: 1.8,
  lg: 2.6,
  xl: 3.6,
  xxl: 5,
  /** page margins on a poster */
  page: 7,
} as const;

/** Type sizes, on a ~1.28 ratio, from a caption to a hero headline. */
export const TYPE = {
  micro: 1.8,
  label: 2.2,
  body: 2.6,
  lead: 3.2,
  h4: 4.2,
  h3: 5.4,
  h2: 7,
  h1: 9,
  hero: 11.5,
} as const;

/** Corner radii. Four steps and a pill, nothing between them. */
export const RADIUS = {
  xs: 0.6,
  sm: 1.2,
  md: 2.4,
  lg: 4,
  pill: 9,
} as const;

/** Type weights, used as a pair: one heavy, one plain, nothing in between. */
export const WEIGHT = { plain: 500, medium: 600, bold: 700, heavy: 800 } as const;

/** Letter spacing: tight on big type, wide on small caps. */
export const TRACK = {
  tight: "-0.03em",
  snug: "-0.01em",
  normal: "0",
  wide: "0.16em",
  wider: "0.24em",
} as const;

/**
 * One ink, in the strengths a design actually needs, instead of eight near
 * blacks that differ by a hue nobody can see.
 */
export const INK = {
  strong: "#111725",
  body: "rgba(17,23,37,0.78)",
  muted: "rgba(17,23,37,0.55)",
  faint: "rgba(17,23,37,0.35)",
  onDark: "#ffffff",
  onDarkBody: "rgba(255,255,255,0.86)",
  onDarkMuted: "rgba(255,255,255,0.62)",
  onDarkFaint: "rgba(255,255,255,0.32)",
} as const;

/** Three elevations rather than a new shadow each time something floats. */
export const ELEVATION = {
  low: (u: (n: number) => string) => `0 ${u(0.8)} ${u(2)} rgba(17,23,37,0.10)`,
  mid: (u: (n: number) => string) => `0 ${u(1.8)} ${u(4.4)} rgba(17,23,37,0.18)`,
  high: (u: (n: number) => string) => `0 ${u(3)} ${u(8)} rgba(17,23,37,0.30)`,
} as const;

/* --------------------------- brand colour helpers -------------------------- */

type Rgb = { r: number; g: number; b: number };

function parseHex(value: string): Rgb | null {
  const hex = value.trim().replace("#", "");
  const full = hex.length === 3 ? hex.replace(/(.)/g, "$1$1") : hex;
  if (full.length !== 6 || /[^0-9a-fA-F]/.test(full)) return null;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

const clamp255 = (n: number) => Math.min(255, Math.max(0, Math.round(n)));
const toHex = ({ r, g, b }: Rgb) =>
  `#${[r, g, b].map((n) => clamp255(n).toString(16).padStart(2, "0")).join("")}`;

/** The brand colour carried toward white, for tinted grounds and soft fills. */
export function tint(color: string, amount: number): string {
  const rgb = parseHex(color);
  if (!rgb) return color;
  return toHex({
    r: rgb.r + (255 - rgb.r) * amount,
    g: rgb.g + (255 - rgb.g) * amount,
    b: rgb.b + (255 - rgb.b) * amount,
  });
}

/** The brand colour carried toward black, for deep grounds and pressed states. */
export function shade(color: string, amount: number): string {
  const rgb = parseHex(color);
  if (!rgb) return color;
  return toHex({ r: rgb.r * (1 - amount), g: rgb.g * (1 - amount), b: rgb.b * (1 - amount) });
}

/** The brand colour at an opacity, without writing rgba by hand. */
export function alpha(color: string, value: number): string {
  const rgb = parseHex(color);
  if (!rgb) return color;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${Math.min(1, Math.max(0, value))})`;
}

/** Relative luminance, per WCAG, used to decide what can be read on a colour. */
export function luminance(color: string): number {
  const rgb = parseHex(color);
  if (!rgb) return 0;
  const channel = (n: number) => {
    const c = n / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
}

/** Contrast ratio between two solid colours, 1 to 21. */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Whether type on this colour should be the light ink or the dark one. */
export function inkOn(background: string): "light" | "dark" {
  return luminance(background) > 0.42 ? "dark" : "light";
}
