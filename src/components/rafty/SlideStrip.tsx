import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { clampDuration } from "@/lib/rafty/constants";
import type { ContentFormat, FormatSpec, Slide } from "@/lib/rafty/types";
import { cn } from "@/lib/utils";

type Props = {
  slides: Slide[];
  activeIndex: number;
  format: ContentFormat;
  spec: FormatSpec;
  limits: { min: number; max: number };
  onSelect: (index: number) => void;
  onMove: (index: number, direction: -1 | 1) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onDuration: (index: number, ms: number) => void;
};

/**
 * Slide and card manager for the multi frame formats. Reordering and removal
 * always act on one index, so editing a slide never touches another one.
 */
export function SlideStrip({
  slides,
  activeIndex,
  format,
  spec,
  limits,
  onSelect,
  onMove,
  onAdd,
  onRemove,
  onDuration,
}: Props) {
  const isVideo = format === "video";

  return (
    <div className="card-soft flex flex-col gap-2 p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">{isVideo ? "Cards" : "Slides"}</p>
        <span className="text-xs text-muted-foreground">
          {slides.length} of {limits.max}
        </span>
      </div>

      <ul className="flex flex-col gap-2">
        {slides.map((slide, index) => (
          <li
            key={slide.id}
            className={cn(
              "flex items-center gap-2 rounded-xl border px-2 py-2",
              index === activeIndex ? "border-primary bg-primary-soft" : "border-border bg-card",
            )}
          >
            <button
              type="button"
              onClick={() => onSelect(index)}
              className="flex min-w-0 flex-1 items-center gap-2 text-left"
            >
              <span className="size-8 shrink-0 overflow-hidden rounded-lg bg-muted">
                {slide.content.imageDataUrl ? (
                  <img src={slide.content.imageDataUrl} alt="" className="size-8 object-cover" />
                ) : null}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold">
                  {index + 1}. {slide.content.title || (isVideo ? "Card" : "Slide")}
                </span>
                {isVideo ? (
                  <span className="block text-[11px] text-muted-foreground">
                    {((slide.durationMs ?? spec.defaultDuration) / 1000).toFixed(1)}s
                  </span>
                ) : null}
              </span>
            </button>

            {isVideo ? (
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="size-7 rounded-lg"
                  aria-label={`Shorten card ${index + 1}`}
                  onClick={() =>
                    onDuration(
                      index,
                      clampDuration((slide.durationMs ?? spec.defaultDuration) - 500, spec),
                    )
                  }
                >
                  <span className="text-xs font-bold">-</span>
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="size-7 rounded-lg"
                  aria-label={`Lengthen card ${index + 1}`}
                  onClick={() =>
                    onDuration(
                      index,
                      clampDuration((slide.durationMs ?? spec.defaultDuration) + 500, spec),
                    )
                  }
                >
                  <span className="text-xs font-bold">+</span>
                </Button>
              </div>
            ) : null}

            <div className="flex items-center">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="size-7 rounded-lg"
                aria-label={`Move up ${index + 1}`}
                disabled={index === 0}
                onClick={() => onMove(index, -1)}
              >
                <ChevronUp className="size-3.5" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="size-7 rounded-lg"
                aria-label={`Move down ${index + 1}`}
                disabled={index === slides.length - 1}
                onClick={() => onMove(index, 1)}
              >
                <ChevronDown className="size-3.5" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="size-7 rounded-lg text-muted-foreground"
                aria-label={`Remove ${index + 1}`}
                disabled={slides.length <= limits.min}
                onClick={() => onRemove(index)}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <Button
        type="button"
        variant="outline"
        className="h-10 rounded-xl"
        disabled={slides.length >= limits.max}
        onClick={onAdd}
      >
        <Plus className="mr-1 size-4" />
        Add {isVideo ? "card" : "slide"}
      </Button>
    </div>
  );
}
