import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Minus,
  Plus,
  RotateCcw,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  defaultLogoAdjust,
  defaultAdjust,
  type LayerAdjust,
  type LogoAdjust,
  type LogoPlace,
  type PostAdjustments,
} from "@/lib/rafty/types";

type Props = {
  adjustments: PostAdjustments;
  onChange: (next: PostAdjustments) => void;
};

const OFFSET_LIMIT = 12;
const SCALE_MIN = 0.8;
const SCALE_MAX = 1.25;
const STEP = 1;

const clampOffset = (v: number) => Math.max(-OFFSET_LIMIT, Math.min(OFFSET_LIMIT, v));
const clampScale = (v: number) =>
  Math.round(Math.max(SCALE_MIN, Math.min(SCALE_MAX, v)) * 100) / 100;

// The mark has far more room to move than the text does: the text is a whole
// block that the design balanced, while the logo is one object the customer is
// placing on purpose. Kept in step with the bounds the renderer enforces, which
// are the ones that actually hold.
const LOGO_SCALE_MIN = 0.5;
const LOGO_SCALE_MAX = 3;
const LOGO_STEP = 0.1;

const clampLogoScale = (v: number) =>
  Math.round(Math.max(LOGO_SCALE_MIN, Math.min(LOGO_SCALE_MAX, v)) * 10) / 10;

/** Where the mark can go, in the order the buttons read. */
const LOGO_PLACES: { id: LogoPlace; label: string }[] = [
  { id: "design", label: "Template" },
  { id: "topLeft", label: "Top left" },
  { id: "topRight", label: "Top right" },
  { id: "bottomLeft", label: "Bottom left" },
  { id: "bottomRight", label: "Bottom right" },
];

/**
 * Compact touch friendly adjust panel for the dynamic content layer and the
 * uploaded image. It only ever edits PostAdjustments, never the template.
 */
export function AdjustControls({ adjustments, onChange }: Props) {
  const text: LayerAdjust = { ...defaultAdjust, ...(adjustments.text ?? {}) };
  const image = { x: 0, y: 0, scale: 1, ...(adjustments.image ?? {}) };
  const logo: LogoAdjust = { ...defaultLogoAdjust, ...(adjustments.logo ?? {}) };

  const setText = (patch: Partial<LayerAdjust>) =>
    onChange({ ...adjustments, text: { ...text, ...patch } });
  const setImage = (patch: Partial<{ x: number; y: number; scale: number }>) =>
    onChange({ ...adjustments, image: { ...image, ...patch } });
  const setLogo = (patch: Partial<LogoAdjust>) =>
    onChange({ ...adjustments, logo: { ...logo, ...patch } });

  const nudgeText = (dx: number, dy: number) =>
    setText({ x: clampOffset(text.x + dx), y: clampOffset(text.y + dy) });
  const resizeText = (delta: number) => setText({ scale: clampScale(text.scale + delta) });

  const nudgeImage = (dx: number, dy: number) =>
    setImage({ x: clampOffset(image.x + dx), y: clampOffset(image.y + dy) });
  const resizeImage = (delta: number) => setImage({ scale: clampScale(image.scale + delta) });

  const nudgeLogo = (dx: number, dy: number) =>
    setLogo({ x: clampOffset(logo.x + dx), y: clampOffset(logo.y + dy) });
  const resizeLogo = (delta: number) => setLogo({ scale: clampLogoScale(logo.scale + delta) });
  /** True while the template still decides where the mark goes. */
  const pinned = logo.place === "design";

  const resetAll = () => onChange({});

  const dirButton = (
    icon: React.ReactNode,
    onClick: () => void,
    label: string,
    disabled = false,
  ) => (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className="size-11 rounded-xl"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
    >
      {icon}
    </Button>
  );

  return (
    <div className="card-soft flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Adjust text position</p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 rounded-lg text-muted-foreground"
          onClick={resetAll}
        >
          <RotateCcw className="mr-1 size-3.5" />
          Reset
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {dirButton(<ArrowUp className="size-4" />, () => nudgeText(0, -1), "Move text up")}
        {dirButton(<ArrowDown className="size-4" />, () => nudgeText(0, 1), "Move text down")}
        {dirButton(<ArrowLeft className="size-4" />, () => nudgeText(-1, 0), "Move text left")}
        {dirButton(<ArrowRight className="size-4" />, () => nudgeText(1, 0), "Move text right")}
        <div className="mx-1 h-8 w-px bg-border" />
        {dirButton(
          <Minus className="size-4" />,
          () => resizeText(-STEP / 100),
          "Decrease text size",
        )}
        {dirButton(<Plus className="size-4" />, () => resizeText(STEP / 100), "Increase text size")}
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-muted-foreground">Align</span>
        {(["left", "center", "right"] as const).map((align) => (
          <Button
            key={align}
            type="button"
            variant={text.align === align ? "default" : "outline"}
            size="icon"
            className="size-10 rounded-xl"
            aria-label={`Align text ${align}`}
            onClick={() => setText({ align })}
          >
            {align === "left" ? (
              <AlignLeft className="size-4" />
            ) : align === "center" ? (
              <AlignCenter className="size-4" />
            ) : (
              <AlignRight className="size-4" />
            )}
          </Button>
        ))}
      </div>

      <div className="h-px bg-border" />

      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Adjust image</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {dirButton(<ArrowUp className="size-4" />, () => nudgeImage(0, -1), "Move image up")}
        {dirButton(<ArrowDown className="size-4" />, () => nudgeImage(0, 1), "Move image down")}
        {dirButton(<ArrowLeft className="size-4" />, () => nudgeImage(-1, 0), "Move image left")}
        {dirButton(<ArrowRight className="size-4" />, () => nudgeImage(1, 0), "Move image right")}
        <div className="mx-1 h-8 w-px bg-border" />
        {dirButton(
          <ZoomOut className="size-4" />,
          () => resizeImage(-STEP / 100),
          "Zoom image out",
        )}
        {dirButton(<ZoomIn className="size-4" />, () => resizeImage(STEP / 100), "Zoom image in")}
      </div>

      <div className="h-px bg-border" />

      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Logo</p>
        <span className="text-xs text-muted-foreground">{Math.round(logo.scale * 100)}%</span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {LOGO_PLACES.map((option) => (
          <Button
            key={option.id}
            type="button"
            variant={logo.place === option.id ? "default" : "outline"}
            size="sm"
            className="h-10 rounded-xl"
            onClick={() => setLogo({ place: option.id })}
          >
            {option.label}
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {dirButton(
          <Minus className="size-4" />,
          () => resizeLogo(-LOGO_STEP),
          "Make the logo smaller",
        )}
        {dirButton(
          <Plus className="size-4" />,
          () => resizeLogo(LOGO_STEP),
          "Make the logo bigger",
        )}
        <div className="mx-1 h-8 w-px bg-border" />
        {/* The nudges move the mark away from the corner it is pinned to, so
            they have nothing to act on while the template is placing it.
            Disabled rather than hidden: a control that vanishes reads as a bug,
            and one that does nothing when pressed reads as a broken one. */}
        {dirButton(
          <ArrowUp className="size-4" />,
          () => nudgeLogo(0, -1),
          "Move the logo up",
          pinned,
        )}
        {dirButton(
          <ArrowDown className="size-4" />,
          () => nudgeLogo(0, 1),
          "Move the logo down",
          pinned,
        )}
        {dirButton(
          <ArrowLeft className="size-4" />,
          () => nudgeLogo(-1, 0),
          "Move the logo left",
          pinned,
        )}
        {dirButton(
          <ArrowRight className="size-4" />,
          () => nudgeLogo(1, 0),
          "Move the logo right",
          pinned,
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Text and picture nudges are kept small so the layout always stays on brand. The logo is
        yours to place: pick a corner, or leave it where the template puts it.
      </p>
    </div>
  );
}
