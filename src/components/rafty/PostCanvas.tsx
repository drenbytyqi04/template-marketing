import { forwardRef, useMemo } from "react";
import { renderTemplate } from "@/lib/rafty/templates";
import { ExtraTextLayer } from "./ExtraTextLayer";
import { SAFE_INSETS, sizeFor } from "@/lib/rafty/constants";

import type {
  BrandProfile,
  BusinessType,
  ContentFormat,
  PostAdjustments,
  PostContent,
  Template,
} from "@/lib/rafty/types";
import { contactSets } from "@/lib/rafty/types";
import { cn } from "@/lib/utils";

type Props = {
  template: Template;
  content: PostContent;
  brand: BrandProfile;
  businessName: string;
  businessType: BusinessType;
  showBrandName?: boolean;
  showContact?: boolean;
  adjustments?: PostAdjustments;
  /** Overrides the template format, used by previews that force one shape. */
  format?: ContentFormat;
  className?: string;
};

/** Single rendering model for every format. The aspect ratio comes from the
 * shared size table, all template sizing is container relative, so
 * thumbnails, slide previews and exports render identically. Pure render of
 * its props: no internal state, so it never goes stale and is safe to key by
 * post, slide or template id. */
export const PostCanvas = forwardRef<HTMLDivElement, Props>(function PostCanvas(
  {
    template,
    content,
    brand,
    businessName,
    businessType,
    showBrandName,
    showContact,
    adjustments,
    format,
    className,
  },
  ref,
) {
  const activeFormat = format ?? template.format ?? "post";
  const size = sizeFor(activeFormat, content.sizeKey);
  const safe = SAFE_INSETS[activeFormat];

  // The post chooses which brand contact block it prints, so every template
  // and the exporter read one already resolved contact object.
  const effectiveBrand = useMemo(() => {
    const sets = contactSets(brand.contact);
    const chosen = sets.find((s) => s.id === content.contactSetId);
    if (!chosen) return brand;
    const { id: _id, label: _label, ...fields } = chosen;
    return { ...brand, contact: { ...(brand.contact ?? {}), ...fields } };
  }, [brand, content.contactSetId]);

  return (
    <div
      ref={ref}
      className={cn("krijo-safe relative w-full overflow-hidden bg-muted", className)}
      style={{
        containerType: "inline-size",
        aspectRatio: `${size.width} / ${size.height}`,
        ...({
          "--safe-t": `${safe.top}cqw`,
          "--safe-b": `${safe.bottom}cqw`,
        } as React.CSSProperties),
      }}
      data-safe={safe.top || safe.bottom ? "on" : "off"}
    >
      {renderTemplate(template, {
        content,
        brand: effectiveBrand,
        businessName,
        businessType,
        showBrandName: showBrandName ?? false,
        showContact: showContact ?? false,
        ...(adjustments ? { adjustments } : {}),
      })}
      <ExtraTextLayer items={content.extras} brand={brand} />
    </div>
  );
});
