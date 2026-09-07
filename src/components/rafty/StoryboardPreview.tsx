import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PostCanvas } from "@/components/rafty/PostCanvas";
import type { BrandProfile, BusinessType, FormatSpec, Slide, Template } from "@/lib/rafty/types";

type Props = {
  slides: Slide[];
  template: Template;
  brand: BrandProfile;
  businessName: string;
  businessType: BusinessType;
  showBrandName: boolean;
  showContact: boolean;
  spec: FormatSpec;
  activeIndex: number;
  onSelect: (index: number) => void;
};

/**
 * Storyboard preview for the video format. It plays the cards in order using
 * each card's own duration, with a subtle transition set by the template. It
 * is a preview only: no video file is produced, and the UI says so instead of
 * offering a download that would not work.
 */
export function StoryboardPreview({
  slides,
  template,
  brand,
  businessName,
  businessType,
  showBrandName,
  showContact,
  spec,
  activeIndex,
  onSelect,
}: Props) {
  const [playing, setPlaying] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const durations = useMemo(
    () => slides.map((slide) => slide.durationMs ?? spec.defaultDuration),
    [slides, spec.defaultDuration],
  );
  const total = durations.reduce((sum, ms) => sum + ms, 0);

  useEffect(() => {
    if (!playing || slides.length === 0) return;
    const current = durations[activeIndex] ?? spec.defaultDuration;
    timer.current = setTimeout(() => {
      onSelect((activeIndex + 1) % slides.length);
    }, current);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [playing, activeIndex, durations, slides.length, spec.defaultDuration, onSelect]);

  const slide = slides[activeIndex] ?? slides[0];
  const transition = template.motion?.transition ?? "fade";
  if (!slide) return null;

  return (
    <div className="flex flex-col gap-3">
      <div className="card-soft mx-auto w-full max-w-[320px] overflow-hidden p-2">
        <div key={`${slide.id}-${transition}`} className="krijo-card-in">
          <PostCanvas
            template={template}
            content={slide.content}
            brand={brand}
            businessName={businessName}
            businessType={businessType}
            showBrandName={showBrandName}
            showContact={showContact}
            adjustments={slide.adjustments}
            format="video"
            className="rounded-xl"
          />
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-[320px] items-center gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-10 flex-1 rounded-xl"
          onClick={() => setPlaying((v) => !v)}
        >
          {playing ? <Pause className="mr-1 size-4" /> : <Play className="mr-1 size-4" />}
          {playing ? "Pause" : "Play"}
        </Button>
        <span className="text-xs font-semibold text-muted-foreground">
          {activeIndex + 1} / {slides.length} | {(total / 1000).toFixed(1)}s
        </span>
      </div>

      <div className="mx-auto flex w-full max-w-[320px] gap-1">
        {slides.map((s, index) => (
          <button
            key={s.id}
            type="button"
            aria-label={`Card ${index + 1}`}
            onClick={() => onSelect(index)}
            style={{ flexGrow: durations[index] ?? spec.defaultDuration }}
            className={`h-1.5 rounded-full ${index === activeIndex ? "bg-primary" : "bg-border"}`}
          />
        ))}
      </div>
    </div>
  );
}
