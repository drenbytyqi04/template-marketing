import { PostCanvas } from "@/components/rafty/PostCanvas";
import type { BrandProfile, BusinessType, ContentFormat, Slide, Template } from "@/lib/rafty/types";

type Props = {
  slides: Slide[];
  template: Template;
  brand: BrandProfile;
  businessName: string;
  businessType: BusinessType;
  showBrandName: boolean;
  showContact: boolean;
  format: ContentFormat;
  activeIndex: number;
  onSelect: (index: number) => void;
  /** Live nodes for the export pipeline, one per slide, in display order. */
  nodesRef: React.MutableRefObject<(HTMLDivElement | null)[]>;
};

/**
 * Vertical slide preview. Each slide renders from its own slide state through
 * the shared canvas, so slides stay independent and the exporter reads the
 * exact nodes the user is looking at.
 */
export function CarouselPreview({
  slides,
  template,
  brand,
  businessName,
  businessType,
  showBrandName,
  showContact,
  format,
  activeIndex,
  onSelect,
  nodesRef,
}: Props) {
  return (
    <div className="flex flex-col gap-3">
      {slides.map((slide, index) => (
        <button
          key={slide.id}
          type="button"
          onClick={() => onSelect(index)}
          className={`card-soft relative overflow-hidden p-2 text-left transition ${
            index === activeIndex ? "ring-2 ring-primary" : ""
          }`}
        >
          <PostCanvas
            ref={(node) => {
              nodesRef.current[index] = node;
            }}
            template={template}
            content={slide.content}
            brand={brand}
            businessName={businessName}
            businessType={businessType}
            showBrandName={showBrandName}
            showContact={showContact}
            adjustments={slide.adjustments}
            format={format}
            className="rounded-xl"
          />
          <span className="absolute right-4 top-4 rounded-full bg-foreground/70 px-2 py-0.5 text-[11px] font-semibold text-background">
            {index + 1} / {slides.length}
          </span>
        </button>
      ))}
    </div>
  );
}
