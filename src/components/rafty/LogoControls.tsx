import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { defaultLogoAdjust, type LogoAdjust, type LogoPlace } from "@/lib/rafty/types";
import type { PostAdjustments } from "@/lib/rafty/types";

type Props = {
  adjustments: PostAdjustments;
  onChange: (next: PostAdjustments) => void;
  /** The brand's own colours, offered as the first answers to "which colour".
   * A recolour is almost always one of these. */
  palette?: { primary: string; secondary: string; accent: string };
};

// The mark has far more room to move than the text nudges do: the text is a
// whole block the design balanced, while the logo is one object the customer is
// placing on purpose. Kept in step with the bounds the renderer enforces, which
// are the ones that actually hold.
const SCALE_MIN = 0.5;
const SCALE_MAX = 3;
const SCALE_STEP = 0.1;
const OFFSET_LIMIT = 12;

const clampScale = (v: number) => Math.round(Math.max(SCALE_MIN, Math.min(SCALE_MAX, v)) * 10) / 10;
const clampOffset = (v: number) => Math.max(-OFFSET_LIMIT, Math.min(OFFSET_LIMIT, v));

/** Where the mark can go, in the order the buttons read: the template's own
 * answer, then the frame read left to right, top to bottom. */
const PLACES: { id: LogoPlace; label: string }[] = [
  { id: "design", label: "Template" },
  { id: "topLeft", label: "Top left" },
  { id: "topCenter", label: "Top center" },
  { id: "topRight", label: "Top right" },
  { id: "center", label: "Center" },
  { id: "bottomLeft", label: "Bottom left" },
  { id: "bottomCenter", label: "Bottom center" },
  { id: "bottomRight", label: "Bottom right" },
];

/**
 * Size and place the brand mark on this post.
 *
 * This sits with "Show brand name" and "Show contact info" rather than in the
 * adjust panel, though it edits the same PostAdjustments the text and picture
 * nudges do. The adjust panel opens only after a post has been generated, and
 * behind a button that has to be found first - which is two doors in front of a
 * control whose whole job is answering "where does my logo go". The other
 * decisions about what the brand shows on a post are made here, before
 * generating, and so is this one.
 */
export function LogoControls({ adjustments, onChange, palette }: Props) {
  const logo: LogoAdjust = { ...defaultLogoAdjust, ...(adjustments.logo ?? {}) };
  const set = (patch: Partial<LogoAdjust>) =>
    onChange({ ...adjustments, logo: { ...logo, ...patch } });

  /** True while the template still decides where the mark goes, which is what
   * leaves the nudges with nothing to act on. */
  const placedByTemplate = logo.place === "design";

  const arrow = (icon: React.ReactNode, dx: number, dy: number, label: string) => (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className="size-10 rounded-xl"
      aria-label={label}
      disabled={placedByTemplate}
      onClick={() => set({ x: clampOffset(logo.x + dx), y: clampOffset(logo.y + dy) })}
    >
      {icon}
    </Button>
  );

  return (
    <div className="grid gap-3 rounded-xl border border-border bg-card px-3 py-2.5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Logo</p>
        <span className="text-xs text-muted-foreground">{Math.round(logo.scale * 100)}%</span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {PLACES.map((option) => (
          <Button
            key={option.id}
            type="button"
            variant={logo.place === option.id ? "default" : "outline"}
            size="sm"
            className="h-9 rounded-xl"
            onClick={() => set({ place: option.id })}
          >
            {option.label}
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-10 rounded-xl"
          aria-label="Make the logo smaller"
          onClick={() => set({ scale: clampScale(logo.scale - SCALE_STEP) })}
        >
          <Minus className="size-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-10 rounded-xl"
          aria-label="Make the logo bigger"
          onClick={() => set({ scale: clampScale(logo.scale + SCALE_STEP) })}
        >
          <Plus className="size-4" />
        </Button>
        <div className="mx-1 h-8 w-px bg-border" />
        {/* Disabled rather than hidden: a control that vanishes reads as a bug,
            and one that does nothing when pressed reads as a broken one. */}
        {arrow(<ArrowUp className="size-4" />, 0, -1, "Move the logo up")}
        {arrow(<ArrowDown className="size-4" />, 0, 1, "Move the logo down")}
        {arrow(<ArrowLeft className="size-4" />, -1, 0, "Move the logo left")}
        {arrow(<ArrowRight className="size-4" />, 1, 0, "Move the logo right")}
      </div>

      <div className="grid gap-1.5 border-t border-border pt-2.5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Logo colour
          </p>
          {/* Shown only when there is something to undo. A reset button beside
              an untouched control is one more thing to read and nothing to do. */}
          {logo.tint ? (
            <button
              type="button"
              className="text-xs font-semibold text-muted-foreground underline-offset-4 hover:underline"
              onClick={() => set({ tint: null })}
            >
              Original
            </button>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Swatch
            value={null}
            active={!logo.tint}
            label="Logo as uploaded"
            onPick={() => set({ tint: null })}
          />
          {TINTS.map((option) => (
            <Swatch
              key={option.value}
              value={option.value}
              active={sameColour(logo.tint, option.value)}
              label={option.label}
              onPick={() => set({ tint: option.value })}
            />
          ))}
          {brandTints(palette).map((option) => (
            <Swatch
              key={option.value}
              value={option.value}
              active={sameColour(logo.tint, option.value)}
              label={option.label}
              onPick={() => set({ tint: option.value })}
            />
          ))}
          <label
            className="relative size-8 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-border"
            title="Any other colour"
            style={{
              background: "conic-gradient(#ef4444,#f59e0b,#22c55e,#3b82f6,#a855f7,#ef4444)",
            }}
          >
            <input
              type="color"
              className="absolute inset-0 cursor-pointer opacity-0"
              value={logo.tint ?? "#ffffff"}
              onChange={(e) => set({ tint: e.target.value })}
            />
          </label>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Pick a corner, or leave it where the template puts it. A colour here changes the mark on
        this post only — your uploaded logo is untouched.
      </p>
    </div>
  );
}

/** The two that answer most of it: a dark logo over a photograph needs to be
 * white, a light one on a pale template needs to be black. */
const TINTS = [
  { value: "#ffffff", label: "White" },
  { value: "#111111", label: "Black" },
];

function brandTints(palette: Props["palette"]) {
  if (!palette) return [];
  const seen = new Set(TINTS.map((t) => t.value.toLowerCase()));
  const out: { value: string; label: string }[] = [];
  for (const [label, value] of [
    ["Brand", palette.primary],
    ["Secondary", palette.secondary],
    ["Accent", palette.accent],
  ] as const) {
    const key = value?.toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({ value, label });
  }
  return out;
}

/** Hex comparison, because a colour picker returns lowercase and a brand stores
 * whatever was typed into it. */
function sameColour(a: string | null | undefined, b: string) {
  return !!a && a.toLowerCase() === b.toLowerCase();
}

function Swatch({
  value,
  active,
  label,
  onPick,
}: {
  value: string | null;
  active: boolean;
  label: string;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={label}
      onClick={onPick}
      className={`grid size-8 shrink-0 place-items-center rounded-lg border text-[10px] font-bold transition-colors ${
        active ? "border-primary ring-2 ring-primary" : "border-border"
      }`}
      style={value ? { background: value } : undefined}
    >
      {/* The uploaded logo has no colour to show, so it says so. */}
      {value ? null : <span className="text-muted-foreground">Orig</span>}
    </button>
  );
}
