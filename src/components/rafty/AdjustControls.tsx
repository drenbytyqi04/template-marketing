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
import { defaultAdjust, type LayerAdjust, type PostAdjustments } from "@/lib/rafty/types";

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

/**
 * Compact touch friendly adjust panel for the dynamic content layer and the
 * uploaded image. It only ever edits PostAdjustments, never the template.
 */
export function AdjustControls({ adjustments, onChange }: Props) {
  const text: LayerAdjust = { ...defaultAdjust, ...(adjustments.text ?? {}) };
  const image = { x: 0, y: 0, scale: 1, ...(adjustments.image ?? {}) };

  const setText = (patch: Partial<LayerAdjust>) =>
    onChange({ ...adjustments, text: { ...text, ...patch } });
  const setImage = (patch: Partial<{ x: number; y: number; scale: number }>) =>
    onChange({ ...adjustments, image: { ...image, ...patch } });

  const nudgeText = (dx: number, dy: number) =>
    setText({ x: clampOffset(text.x + dx), y: clampOffset(text.y + dy) });
  const resizeText = (delta: number) => setText({ scale: clampScale(text.scale + delta) });

  const nudgeImage = (dx: number, dy: number) =>
    setImage({ x: clampOffset(image.x + dx), y: clampOffset(image.y + dy) });
  const resizeImage = (delta: number) => setImage({ scale: clampScale(image.scale + delta) });

  const resetAll = () => onChange({});

  const dirButton = (icon: React.ReactNode, onClick: () => void, label: string) => (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className="size-11 rounded-xl"
      aria-label={label}
      onClick={onClick}
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

      <p className="text-xs text-muted-foreground">
        Nudges are kept small so the layout always stays on brand.
      </p>
    </div>
  );
}
