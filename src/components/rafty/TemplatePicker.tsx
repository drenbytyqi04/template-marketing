import { useMemo, useState } from "react";
import { Star } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PostCanvas } from "@/components/rafty/PostCanvas";
import { LazyMount } from "@/components/rafty/LazyMount";
import { placeholderContent } from "@/lib/rafty/placeholder";
import { useRafty } from "@/lib/rafty/store";
import type {
  BrandProfile,
  BusinessType,
  ContentFormat,
  Template,
  TemplateCategory,
} from "@/lib/rafty/types";
import { cn } from "@/lib/utils";

type Filter = "all" | "favorites" | "used";

/** The occasions a design can be made for, in the order they are offered. */
const CATEGORIES: { key: TemplateCategory; label: string }[] = [
  { key: "flights", label: "Flight tickets" },
  { key: "sea", label: "Beach holidays" },
  { key: "world", label: "World trips" },
  { key: "winter", label: "Winter season" },
];

/**
 * Visual template chooser. Opens over the Create page, so the draft in the
 * form is never lost: tapping a thumbnail only opens a larger preview, and
 * nothing changes until "Use template" is pressed.
 */
export function TemplatePicker({
  templates,
  value,
  onSelect,
  brand,
  businessType,
  businessName,
  format,
}: {
  templates: Template[];
  value: string;
  onSelect: (templateId: string) => void;
  brand: BrandProfile;
  businessType: BusinessType;
  businessName: string;
  format: ContentFormat;
}) {
  const { favorites, templateUsage, toggleFavorite } = useRafty();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [preview, setPreview] = useState<Template | null>(null);
  const [category, setCategory] = useState<TemplateCategory | "all">("all");

  const content = useMemo(() => placeholderContent(businessType), [businessType]);

  /** Only the occasions this brand actually has designs for. A trade with its
   * own set has none, so the row disappears instead of filtering to nothing. */
  const occasions = useMemo(
    () => CATEGORIES.filter((c) => templates.some((x) => x.category === c.key)),
    [templates],
  );

  const selected = templates.find((x) => x.id === value) ?? templates[0];

  const list = useMemo(() => {
    const scoped =
      category === "all" ? templates : templates.filter((x) => x.category === category);
    if (filter === "favorites") return scoped.filter((x) => favorites.includes(x.id));
    if (filter === "used")
      return scoped
        .filter((x) => (templateUsage[x.id] ?? 0) > 0)
        .sort((a, b) => (templateUsage[b.id] ?? 0) - (templateUsage[a.id] ?? 0));
    return scoped;
  }, [templates, filter, category, favorites, templateUsage]);

  /** The named sets lead, each under its own heading, then the standard
   * library. Filtering by favourites or usage answers a different question, so
   * those views stay one flat list in their own order. */
  const groups = useMemo(() => {
    if (filter !== "all" || category !== "all")
      return [{ key: "flat", label: null as string | null, items: list }];
    const byCategory = CATEGORIES.map((c) => ({
      key: c.key as string,
      label: c.label as string | null,
      items: list.filter((x) => x.category === c.key),
    })).filter((g) => g.items.length > 0);
    const mine = list.filter((x) => x.scope === "custom");
    const property = list.filter((x) => !x.category && x.collection === "realestate");
    const fresh = list.filter((x) => !x.category && x.collection === "signature");
    const rest = list.filter((x) => x.scope !== "custom" && !x.category && !x.collection);
    return [
      ...(mine.length ? [{ key: "mine", label: "Your templates", items: mine }] : []),
      ...(property.length
        ? [{ key: "realestate", label: "Property listings", items: property }]
        : []),
      ...byCategory,
      ...(fresh.length ? [{ key: "signature", label: "New designs", items: fresh }] : []),
      ...(rest.length
        ? [
            {
              key: "library",
              label:
                mine.length || property.length || byCategory.length || fresh.length
                  ? "All templates"
                  : null,
              items: rest,
            },
          ]
        : []),
    ];
  }, [list, filter, category]);

  const tabs: { key: Filter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "favorites", label: "Favourites" },
    { key: "used", label: "Most used" },
  ];

  function use(tpl: Template) {
    onSelect(tpl.id);
    setPreview(null);
    setOpen(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setPreview(null);
      }}
    >
      <DialogTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-2 text-left transition hover:border-primary/60"
        >
          <span className="w-11 shrink-0 overflow-hidden rounded-md">
            {selected ? (
              <PostCanvas
                template={selected}
                content={content}
                brand={brand}
                businessName={businessName}
                businessType={businessType}
                format={format}
              />
            ) : null}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">
              {selected?.name ?? "Choose a template"}
            </span>
            <span className="block text-xs text-muted-foreground">Tap to change template</span>
          </span>
        </button>
      </DialogTrigger>

      <DialogContent className="max-h-[88vh] max-w-3xl overflow-hidden p-0">
        <DialogHeader className="border-b px-4 py-3">
          <DialogTitle className="text-base">{preview ? preview.name : "Templates"}</DialogTitle>
        </DialogHeader>

        {preview ? (
          <div className="flex max-h-[74vh] flex-col gap-4 overflow-y-auto p-4">
            <div className="mx-auto w-full max-w-[320px]">
              <PostCanvas
                template={preview}
                content={content}
                brand={brand}
                businessName={businessName}
                businessType={businessType}
                format={format}
                className="rounded-xl"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={() => setPreview(null)}
              >
                Back
              </Button>
              <Button type="button" className="flex-1 rounded-xl" onClick={() => use(preview)}>
                Use template
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex gap-2 px-4 pt-3">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setFilter(tab.key)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                    filter === tab.key
                      ? "border-primary bg-primary-soft"
                      : "border-border bg-card text-muted-foreground",
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-2 px-4 pt-2" hidden={occasions.length === 0}>
              {[{ key: "all" as const, label: "All occasions" }, ...occasions].map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => setCategory(c.key)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-[11px] font-semibold transition",
                    category === c.key
                      ? "border-primary bg-primary-soft"
                      : "border-border bg-card text-muted-foreground",
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>

            <div className="max-h-[62vh] overflow-y-auto px-4 pb-4 pt-3">
              {list.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  {filter === "favorites"
                    ? "No favourites yet. Tap the star on a template."
                    : "No templates used yet."}
                </p>
              ) : (
                <div className="flex flex-col gap-5">
                  {groups.map((group) => (
                    <section key={group.key} className="flex flex-col gap-2">
                      {group.label ? (
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {group.label}
                        </h3>
                      ) : null}
                      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
                        {group.items.map((tpl) => (
                          <div key={tpl.id} className="relative">
                            <button
                              type="button"
                              onClick={() => setPreview(tpl)}
                              className={cn(
                                "block w-full overflow-hidden rounded-lg border p-1 text-left transition",
                                tpl.id === value
                                  ? "border-primary ring-2 ring-primary/40"
                                  : "border-border",
                              )}
                            >
                              <LazyMount>
                                <PostCanvas
                                  template={tpl}
                                  content={content}
                                  brand={brand}
                                  businessName={businessName}
                                  businessType={businessType}
                                  format={format}
                                  className="rounded-md"
                                />
                              </LazyMount>
                              <span className="mt-1 block truncate text-[11px] font-semibold">
                                {tpl.name}
                                {tpl.scope === "custom" ? " • yours" : ""}
                              </span>
                            </button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              aria-label="Favourite"
                              className="absolute right-1 top-1 size-7 rounded-full bg-background/80"
                              onClick={() => void toggleFavorite(tpl.id)}
                            >
                              <Star
                                className={cn(
                                  "size-3.5",
                                  favorites.includes(tpl.id)
                                    ? "fill-primary text-primary"
                                    : "text-muted-foreground",
                                )}
                              />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
