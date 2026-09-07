import { motion } from "framer-motion";
import { Film, Images, Image as ImageIcon, Lock, Smartphone } from "lucide-react";
import { CONTENT_FORMATS, FORMAT_SPECS } from "@/lib/rafty/constants";
import type { ContentFormat } from "@/lib/rafty/types";
import { cn } from "@/lib/utils";

const ICONS: Record<ContentFormat, typeof ImageIcon> = {
  post: ImageIcon,
  carousel: Images,
  video: Film,
  story: Smartphone,
};

/**
 * Compact segmented format switcher. One row, small footprint, a sliding
 * indicator behind the active option. Formats outside the active plan stay
 * visible but locked, the database also refuses them, so this is only a hint.
 */
export function FormatPicker({
  value,
  onChange,
  allowed,
}: {
  value: ContentFormat;
  onChange: (next: ContentFormat) => void;
  allowed?: ContentFormat[];
}) {
  return (
    <div
      role="tablist"
      aria-label="Format"
      className="flex w-full items-center gap-0.5 rounded-full border border-border bg-card p-1"
    >
      {CONTENT_FORMATS.map((format) => {
        const Icon = ICONS[format];
        const active = value === format;
        const enabled = !allowed || allowed.includes(format);
        return (
          <button
            key={format}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={!enabled}
            title={enabled ? undefined : "Available on a higher plan"}
            onClick={() => enabled && onChange(format)}
            className={cn(
              "relative flex flex-1 items-center justify-center gap-1.5 rounded-full px-2 py-2 text-[13px] font-semibold transition-colors",
              active ? "text-accent-foreground" : "text-muted-foreground hover:text-foreground",
              !enabled && "cursor-not-allowed opacity-50 hover:text-muted-foreground",
            )}
          >
            {active ? (
              <motion.span
                layoutId="format-indicator"
                className="absolute inset-0 rounded-full bg-primary-soft"
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
              />
            ) : null}
            <span className="relative flex items-center gap-1.5">
              {enabled ? <Icon className="size-4" /> : <Lock className="size-3.5" />}
              <span className="hidden sm:inline">{FORMAT_SPECS[format].label}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
