import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  Pencil,
  Plus,
  Sparkles,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { TemplatePicker } from "@/components/rafty/TemplatePicker";
import { TextItemsEditor } from "@/components/rafty/TextItemsEditor";

import { AppShell } from "@/components/rafty/AppShell";
import { PostCanvas } from "@/components/rafty/PostCanvas";
import { AdjustControls } from "@/components/rafty/AdjustControls";
import { ShareActions } from "@/components/rafty/ShareActions";
import { FormatPicker } from "@/components/rafty/FormatPicker";
import { SlideStrip } from "@/components/rafty/SlideStrip";
import { CarouselPreview } from "@/components/rafty/CarouselPreview";
import { StoryboardPreview } from "@/components/rafty/StoryboardPreview";
import { useRafty } from "@/lib/rafty/store";
import { generateCaption } from "@/lib/rafty/caption";
import { readFileAsDataUrl } from "@/lib/rafty/file";
import { renderNodeToDataUrl } from "@/lib/rafty/download";
import { recommendedFirst, templatesForFormat } from "@/lib/rafty/templates";
import {
  clampDuration,
  FIELD_LABEL_PRESETS,
  FORMAT_SPECS,
  SIZE_OPTIONS,
  sizeFor,
  TYPE_FIELDS,
} from "@/lib/rafty/constants";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { clearDraft, readDraft, writeDraft } from "@/lib/rafty/draft";
import {
  contactSets,
  emptyContent,
  type ContentFormat,
  type PostAdjustments,
  type PostContent,
  type PostTextItem,
  type Slide,
} from "@/lib/rafty/types";
import { id as newId, type PostWithContact } from "@/lib/rafty/repo";
import * as repo from "@/lib/rafty/repo";
import { useServerFn } from "@tanstack/react-start";
import { fetchDiscoveredImage } from "@/lib/scan.functions";

export const Route = createFileRoute("/_authenticated/create")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { post?: string; template?: string; duplicate?: boolean; item?: string } => {
    const out: { post?: string; template?: string; duplicate?: boolean; item?: string } = {};
    if (typeof search["post"] === "string") out.post = search["post"];
    if (typeof search["template"] === "string") out.template = search["template"];
    if (typeof search["item"] === "string") out.item = search["item"];
    if (search["duplicate"] === "1" || search["duplicate"] === true) out.duplicate = true;
    return out;
  },
  head: () => ({
    meta: [
      { title: "Create a post | krijo24" },
      {
        name: "description",
        content: "Upload one image, add a few details and generate a branded post in seconds.",
      },
      { property: "og:title", content: "Create a post | krijo24" },
      { property: "og:description", content: "One image in, a finished branded post out." },
    ],
  }),
  component: () => (
    <AppShell>
      <CreatePage />
    </AppShell>
  ),
});

/** A fresh frame. Every slide owns its own content object, so no two slides
 * ever share mutable state. */
function newSlide(durationMs?: number): Slide {
  return {
    id: newId("slide"),
    content: { ...emptyContent, services: [] },
    adjustments: {},
    ...(durationMs !== undefined ? { durationMs } : {}),
  };
}

/**
 * One content field with editable wording. Businesses name the same thing
 * differently (Nights, Guests, Rooms), so the label is a choice, not a fixed
 * string. A plain number is printed together with its label on the design.
 */
function FieldRow({
  fieldKey,
  label,
  presets,
  value,
  onValue,
  onLabel,
}: {
  fieldKey: string;
  label: string;
  presets: string[];
  value: string;
  onValue: (v: string) => void;
  onLabel: (v: string) => void;
}) {
  return (
    <div className="grid gap-1.5">
      <div className="flex items-center gap-1">
        <Label htmlFor={fieldKey} className="truncate">
          {label}
        </Label>
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={`Rename ${label}`}
              className="rounded-md p-1 text-muted-foreground hover:text-foreground"
            >
              <Pencil className="size-3" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-56 p-3">
            <p className="mb-2 text-xs font-semibold text-muted-foreground">Call this field</p>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {presets.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => onLabel(preset)}
                  className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                    preset === label ? "border-primary bg-primary-soft" : "border-border bg-card"
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
            <Input
              defaultValue={label}
              maxLength={24}
              placeholder="Your own wording"
              className="h-9 rounded-lg"
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v) onLabel(v);
              }}
            />
          </PopoverContent>
        </Popover>
      </div>
      <Input
        id={fieldKey}
        value={value}
        onChange={(e) => onValue(e.target.value)}
        className="h-11 rounded-xl"
      />
    </div>
  );
}

function CreatePage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const {
    business,
    brand,
    services,
    posts,
    templates,
    formats,
    canCreatePost,
    createPost,
    addService,
    t,
  } = useRafty();

  const existing = search.post ? posts.find((p) => p.id === search.post) : undefined;
  const isDuplicate = !!existing && !!search.duplicate;

  /** An unfinished post is restored when the user comes back from another page.
   * Opening a saved post, a website item or a template link always wins. */
  const [draft] = useState(() =>
    search.post || search.item || search.template ? null : readDraft(business?.id),
  );

  const [format, setFormat] = useState<ContentFormat>(existing?.format ?? draft?.format ?? "post");
  const [templateId, setTemplateId] = useState<string>(
    existing?.templateId ?? search.template ?? draft?.templateId ?? "",
  );
  const [sizeKey, setSizeKey] = useState<string>(existing?.content.sizeKey ?? draft?.sizeKey ?? "");
  const [slides, setSlides] = useState<Slide[]>(() => {
    if (!existing && draft?.slides?.length) return draft.slides;
    if (existing?.slides?.length) {
      return existing.slides.map((slide) => ({
        ...slide,
        content: { ...slide.content },
        adjustments: { ...slide.adjustments },
        ...(isDuplicate ? { id: newId("slide"), imagePath: null } : {}),
      }));
    }
    return [
      {
        id: newId("slide"),
        content: existing ? { ...existing.content } : { ...emptyContent, services: [] },
        adjustments: isDuplicate ? {} : { ...(existing?.adjustments ?? {}) },
        ...(isDuplicate ? {} : { imagePath: existing?.imagePath ?? null }),
      },
    ];
  });
  const [activeIndex, setActiveIndex] = useState(draft && !existing ? (draft.activeIndex ?? 0) : 0);
  const [showBrandName, setShowBrandName] = useState<boolean>(
    existing?.showBrandName ?? draft?.showBrandName ?? brand?.showBrandName ?? false,
  );
  // Contact details are brand data, so posts show them by default whenever the
  // brand actually saved some. The toggle stays available per post.
  const brandHasContact = Boolean(
    brand &&
    (brand.contact.phones.some((p) => p.trim()) ||
      brand.contact.email.trim() ||
      brand.contact.website.trim() ||
      brand.contact.address.trim() ||
      brand.contact.social.trim()),
  );
  const [showContact, setShowContact] = useState<boolean>(
    existing?.showContact ?? draft?.showContact ?? brandHasContact,
  );
  const [postId, setPostId] = useState<string | null>(
    isDuplicate ? null : (existing?.id ?? draft?.postId ?? null),
  );
  const [generated, setGenerated] = useState(existing ? !isDuplicate : Boolean(draft?.generated));
  const [showAdjust, setShowAdjust] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [newService, setNewService] = useState("");
  const [savingService, setSavingService] = useState(false);

  const [saving, setSaving] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const slideNodes = useRef<(HTMLDivElement | null)[]>([]);

  // Prefill from an item found on the brand's own website. Only the text and
  // the picture come across: the template still owns the whole layout.
  const loadItemImage = useServerFn(fetchDiscoveredImage);
  const prefilled = useRef(false);
  useEffect(() => {
    const itemId = search.item;
    if (!itemId || !business || existing || prefilled.current) return;
    prefilled.current = true;
    void (async () => {
      const item = (await repo.listDiscovered(business.id)).find((row) => row.id === itemId);
      if (!item) return;
      const image = item.imageUrl
        ? await loadItemImage({ data: { businessId: business.id, itemId } })
        : null;
      setSlides((prev) =>
        prev.map((slide, i) =>
          i === 0
            ? {
                ...slide,
                content: {
                  ...slide.content,
                  title: item.title.slice(0, 90),
                  price: item.price,
                  additionalText: item.description.slice(0, 160),
                  ...(image?.ok ? { imageDataUrl: image.dataUrl } : {}),
                },
              }
            : slide,
        ),
      );
      await repo.setDiscoveredStatus(itemId, "used");
    })();
  }, [search.item, business, existing, loadItemImage]);

  const spec = FORMAT_SPECS[format];
  const size = sizeFor(format, sizeKey);
  const sizes = SIZE_OPTIONS[format];
  /** Business type only reorders the list, it never removes a template. */
  const formatTemplates = useMemo(
    () => recommendedFirst(templatesForFormat(templates, format), business?.type ?? "other"),
    [templates, format, business?.type],
  );
  const template = useMemo(
    () => formatTemplates.find((x) => x.id === templateId) ?? formatTemplates[0],
    [formatTemplates, templateId],
  );

  // Keeps the in progress post alive across navigation inside the app.
  useEffect(() => {
    if (!business) return;
    writeDraft({
      businessId: business.id,
      format,
      templateId: templateId || (template?.id ?? ""),
      sizeKey: sizeKey || sizeFor(format, sizeKey).key,
      slides,
      activeIndex,
      showBrandName,
      showContact,
      generated,
      postId,
    });
  }, [
    business,
    format,
    templateId,
    template?.id,
    sizeKey,
    slides,
    activeIndex,
    showBrandName,
    showContact,
    generated,
    postId,
  ]);

  if (!business || !brand || !template) return null;

  const limits = {
    min: template.slides?.min ?? spec.minSlides,
    max: template.slides?.max ?? spec.maxSlides,
  };
  const multi = limits.max > 1;
  const active = slides[Math.min(activeIndex, slides.length - 1)] ?? slides[0]!;
  const content = active.content;
  const fields = TYPE_FIELDS[business.type];
  /** Saved wording wins over the business type default. */
  const labelFor = (key: string, fallbackKey: string) =>
    content.labels?.[key]?.trim() || t(fallbackKey);
  const presetsFor = (key: keyof typeof FIELD_LABEL_PRESETS) =>
    FIELD_LABEL_PRESETS[key].map((k) => t(k));
  const sets = contactSets(brand.contact);
  /** Only the two headline fields stay visible, the rest is optional detail. */
  const primaryFields = fields.slice(0, 2);
  const secondaryFields = fields.slice(2);

  const locked = !canCreatePost && !postId;

  /** Patches only the active frame. */
  const set = (patch: Partial<PostContent>) =>
    setSlides((prev) =>
      prev.map((slide, i) =>
        i === activeIndex ? { ...slide, content: { ...slide.content, ...patch } } : slide,
      ),
    );

  /** Patches every frame, used for post level choices such as size, field
   * wording and the contact block. */
  const setAll = (patch: Partial<PostContent>) =>
    setSlides((prev) =>
      prev.map((slide) => ({ ...slide, content: { ...slide.content, ...patch } })),
    );

  const setAdjustments = (next: PostAdjustments) =>
    setSlides((prev) =>
      prev.map((slide, i) => (i === activeIndex ? { ...slide, adjustments: next } : slide)),
    );

  /** Switching format keeps what the user already typed. Extra frames are
   * dropped or added to match the new format, the first frame always carries
   * over so nobody retypes an offer just to see it as a story. */
  function changeFormat(next: ContentFormat) {
    if (next === format) return;
    const nextSpec = FORMAT_SPECS[next];
    const nextTemplate = templatesForFormat(templates, next)[0];
    const nextMax = nextTemplate?.slides?.max ?? nextSpec.maxSlides;
    setFormat(next);
    setTemplateId(nextTemplate?.id ?? "");
    setSizeKey(SIZE_OPTIONS[next][0]!.key);
    setSlides((prev) => {
      const kept = prev
        .slice(0, Math.max(1, Math.min(nextSpec.defaultSlides, nextMax)))
        .map((slide) => ({
          ...slide,
          content: { ...slide.content },
          adjustments: { ...slide.adjustments },
          ...(next === "video" ? { durationMs: slide.durationMs ?? nextSpec.defaultDuration } : {}),
        }));
      while (kept.length < nextSpec.defaultSlides && kept.length < nextMax) {
        kept.push(newSlide(next === "video" ? nextSpec.defaultDuration : undefined));
      }
      return kept;
    });
    setActiveIndex(0);
    setPostId(null);
    setGenerated(false);
    setShowAdjust(false);
    slideNodes.current = [];
  }

  /** Saves a typed service to the brand so it never has to be retyped, then
   * selects it on this post. Awaited, so a failed write is reported. */
  async function saveTypedService() {
    const value = newService.trim();
    if (!value || savingService) return;
    setSavingService(true);
    const res = await addService(value);
    setSavingService(false);
    if (!res.ok) {
      toast.error(res.error ?? "Could not save that service.");
      return;
    }
    if (!content.services.includes(value)) set({ services: [...content.services, value] });
    setNewService("");
    toast.success("Saved to your brand.");
  }

  async function onImage(file: File) {
    set({ imageDataUrl: await readFileAsDataUrl(file) });
  }

  function captionFor(seed: number) {
    return generateCaption({
      content: slides[0]!.content,
      businessType: business!.type,
      businessName: business!.name,
      currency: brand!.currency,
      instructions: brand!.instructions,
      services: slides[0]!.content.services,
      seed,
    });
  }

  function refreshCaption() {
    const caption = captionFor(Date.now());
    setSlides((prev) =>
      prev.map((slide, i) =>
        i === 0 ? { ...slide, content: { ...slide.content, caption } } : slide,
      ),
    );
  }

  function generate() {
    if (locked) {
      toast.error(t("create.trialUsed"));
      return;
    }
    refreshCaption();
    setGenerated(true);
    setShowAdjust(false);
  }

  function setDefaultDuration(ms: number) {
    const value = clampDuration(ms, spec);
    setSlides((prev) => prev.map((slide) => ({ ...slide, durationMs: value })));
  }

  function setCardDuration(index: number, ms: number) {
    setSlides((prev) =>
      prev.map((slide, i) =>
        i === index ? { ...slide, durationMs: clampDuration(ms, spec) } : slide,
      ),
    );
  }

  function moveSlide(index: number, direction: -1 | 1) {
    setSlides((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      const a = next[index]!;
      const b = next[target]!;
      next[index] = b;
      next[target] = a;
      return next;
    });
    slideNodes.current = [];
    setActiveIndex(index + direction);
  }

  function addSlide() {
    if (slides.length >= limits.max) return;
    setSlides((prev) => [...prev, newSlide(format === "video" ? spec.defaultDuration : undefined)]);
    setActiveIndex(slides.length);
  }

  function removeSlide(index: number) {
    if (slides.length <= limits.min) return;
    setSlides((prev) => prev.filter((_, i) => i !== index));
    slideNodes.current = [];
    setActiveIndex((prev) => Math.max(0, Math.min(prev, slides.length - 2)));
  }

  async function persist() {
    setSaving(true);
    try {
      const first = slides[0]!;
      const post: PostWithContact = {
        id: postId ?? newId("post"),
        businessId: business!.id,
        templateId: template!.id,
        format,
        content: first.content,
        adjustments: first.adjustments,
        slides: multi ? slides : [],
        ...(multi ? {} : { imagePath: first.imagePath ?? null }),
        showBrandName,
        showContact,
        shareStatus: {},
        createdAt: new Date().toISOString(),
      };
      const saved = await createPost(post);
      if (saved) {
        setPostId(saved.id);
        toast.success(t("create.saved"));
        // Store the exact rendered image so scheduling and publishing send
        // precisely what is on screen. Failure here never blocks the save.
        const node = canvasRef.current;
        if (node && format === "post") {
          void (async () => {
            try {
              const dataUrl = await renderNodeToDataUrl(node, {
                width: size.width,
                height: size.height,
              });
              await repo.savePostRender(business!.id, saved.id, dataUrl);
            } catch {
              /* the Website page re-renders anything still missing */
            }
          })();
        }
      } else {
        toast.error("Could not save the post. Please try again.");
      }
    } finally {
      setSaving(false);
    }
  }

  function resetAll() {
    clearDraft();
    setPostId(null);
    setSlides(
      Array.from({ length: spec.defaultSlides }, () =>
        newSlide(format === "video" ? spec.defaultDuration : undefined),
      ),
    );
    setActiveIndex(0);
    setShowBrandName(brand!.showBrandName);
    setShowContact(brandHasContact);
    setGenerated(false);
    setShowAdjust(false);
    slideNodes.current = [];
    navigate({ to: "/create", search: {} });
  }

  const frameLabel = format === "video" ? "card" : "slide";

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
      <section className={`flex flex-col gap-4 ${generated ? "order-2 lg:order-1" : ""}`}>
        <FormatPicker value={format} onChange={changeFormat} allowed={formats} />

        {sizes.length > 1 ? (
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Size
            </span>
            <div className="flex flex-wrap gap-1.5">
              {sizes.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  title={option.note}
                  onClick={() => {
                    setSizeKey(option.key);
                    setAll({ sizeKey: option.key });
                  }}
                  className={`rounded-full border px-3 py-1 text-xs font-bold transition-colors ${
                    option.key === size.key
                      ? "border-primary bg-primary-soft text-accent-foreground"
                      : "border-border bg-card text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <span className="ml-auto hidden text-xs text-muted-foreground sm:block">
              {size.note}
            </span>
          </div>
        ) : null}

        {locked ? (
          <div className="card-soft p-4 text-sm">
            <p className="font-semibold">{t("create.trialUsed")}</p>
            <Button asChild variant="outline" size="sm" className="mt-3 rounded-xl">
              <Link to="/brand">{t("brand.title")}</Link>
            </Button>
          </div>
        ) : null}

        {multi ? (
          <SlideStrip
            slides={slides}
            activeIndex={activeIndex}
            format={format}
            spec={spec}
            limits={limits}
            onSelect={setActiveIndex}
            onMove={moveSlide}
            onAdd={addSlide}
            onRemove={removeSlide}
            onDuration={setCardDuration}
          />
        ) : null}

        {format === "video" ? (
          <div className="card-soft flex items-center justify-between gap-3 p-4">
            <div>
              <p className="text-sm font-semibold">Time per card</p>
              <p className="text-xs text-muted-foreground">
                Sets every card, then fine tune single cards above.
              </p>
            </div>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-9 rounded-xl"
                aria-label="Shorter cards"
                onClick={() =>
                  setDefaultDuration((active.durationMs ?? spec.defaultDuration) - 500)
                }
              >
                -
              </Button>
              <span className="w-14 text-center text-sm font-semibold">
                {((active.durationMs ?? spec.defaultDuration) / 1000).toFixed(1)}s
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-9 rounded-xl"
                aria-label="Longer cards"
                onClick={() =>
                  setDefaultDuration((active.durationMs ?? spec.defaultDuration) + 500)
                }
              >
                +
              </Button>
            </div>
          </div>
        ) : null}

        <div className="card-soft flex flex-col gap-4 p-4">
          <Label>
            {t("create.image")}
            {multi ? ` (${frameLabel} ${activeIndex + 1})` : ""}
          </Label>
          <label className="relative block cursor-pointer overflow-hidden rounded-xl border border-dashed bg-card">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void onImage(file);
              }}
            />
            {content.imageDataUrl ? (
              <img src={content.imageDataUrl} alt="" className="aspect-[4/3] w-full object-cover" />
            ) : (
              <div className="flex aspect-[4/3] flex-col items-center justify-center gap-2 text-muted-foreground">
                <ImageIcon className="size-6" />
                <span className="text-sm font-semibold">{t("create.upload")}</span>
              </div>
            )}
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            {primaryFields.map((f) => (
              <FieldRow
                key={f.key}
                fieldKey={f.key}
                label={labelFor(f.key, f.labelKey)}
                presets={presetsFor(f.key)}
                value={content[f.key]}
                onValue={(v) => set({ [f.key]: v } as Partial<PostContent>)}
                onLabel={(v) => setAll({ labels: { ...(content.labels ?? {}), [f.key]: v } })}
              />
            ))}
          </div>

          <div className="grid gap-2 border-t pt-4">
            <Label>Text on the design (optional)</Label>
            <TextItemsEditor
              items={content.extras ?? []}
              onChange={(extras: PostTextItem[]) => set({ extras })}
              newId={() => newId("text")}
            />
          </div>

          {services.length ? (
            <div className="grid gap-2 border-t pt-4">
              <Label>{t("create.services")}</Label>
              <div className="flex flex-wrap gap-2">
                {services.map((s) => {
                  const isOn = content.services.includes(s.name);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() =>
                        set({
                          services: isOn
                            ? content.services.filter((x) => x !== s.name)
                            : [...content.services, s.name],
                        })
                      }
                      className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${
                        isOn
                          ? "border-primary bg-primary-soft text-accent-foreground"
                          : "border-border bg-card"
                      }`}
                    >
                      {s.name}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            className="flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
          >
            {moreOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
            More details (optional)
          </button>

          {moreOpen ? (
            <div className="grid gap-4 border-t pt-4">
              <div className="grid gap-3 sm:grid-cols-2">
                {secondaryFields.map((f) => (
                  <FieldRow
                    key={f.key}
                    fieldKey={f.key}
                    label={labelFor(f.key, f.labelKey)}
                    presets={presetsFor(f.key)}
                    value={content[f.key]}
                    onValue={(v) => set({ [f.key]: v } as Partial<PostContent>)}
                    onLabel={(v) => setAll({ labels: { ...(content.labels ?? {}), [f.key]: v } })}
                  />
                ))}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="new-service">{t("create.addService")}</Label>
                <div className="flex gap-2">
                  <Input
                    id="new-service"
                    value={newService}
                    maxLength={60}
                    onChange={(e) => setNewService(e.target.value)}
                    placeholder={t("create.addService")}
                    className="h-10 rounded-xl"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 shrink-0 rounded-xl"
                    disabled={savingService || !newService.trim()}
                    onClick={() => void saveTypedService()}
                  >
                    <Plus className="mr-1.5 size-4" />
                    Save to brand
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-border bg-card px-3 py-2.5">
                <p className="text-sm font-semibold">Show brand name</p>
                <Switch checked={showBrandName} onCheckedChange={setShowBrandName} />
              </div>

              <div className="grid gap-2 rounded-xl border border-border bg-card px-3 py-2.5">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">Show contact info</p>
                  <Switch checked={showContact} onCheckedChange={setShowContact} />
                </div>
                {showContact && sets.length > 1 ? (
                  <Select
                    value={content.contactSetId ?? sets[0]!.id}
                    onValueChange={(v) => setAll({ contactSetId: v })}
                  >
                    <SelectTrigger className="h-10 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {sets.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : null}
              </div>
            </div>
          ) : null}

          {generated ? (
            <div className="grid gap-1.5">
              <div className="flex items-center gap-2">
                <Label htmlFor="caption">{t("create.caption")}</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="ml-auto h-8 rounded-lg"
                  onClick={refreshCaption}
                >
                  <Wand2 className="mr-1 size-3.5" />
                  Regenerate
                </Button>
              </div>
              <Textarea
                id="caption"
                value={slides[0]!.content.caption}
                onChange={(e) =>
                  setSlides((prev) =>
                    prev.map((slide, i) =>
                      i === 0
                        ? { ...slide, content: { ...slide.content, caption: e.target.value } }
                        : slide,
                    ),
                  )
                }
                rows={6}
                className="rounded-xl"
              />
            </div>
          ) : null}
        </div>

        {generated ? (
          <Button
            variant="outline"
            className="h-11 rounded-xl"
            onClick={() => setShowAdjust((v) => !v)}
          >
            {showAdjust ? "Hide adjust" : "Adjust"}
          </Button>
        ) : null}

        {generated && showAdjust ? (
          <AdjustControls adjustments={active.adjustments} onChange={setAdjustments} />
        ) : null}
      </section>

      <section className={`flex flex-col gap-4 ${generated ? "order-1 lg:order-2" : ""}`}>
        <div className="mx-auto w-full max-w-[520px]">
          <Label className="mb-1.5 block text-xs uppercase tracking-wide text-muted-foreground">
            {t("create.template")}
          </Label>
          <TemplatePicker
            templates={formatTemplates}
            value={template.id}
            onSelect={setTemplateId}
            brand={brand}
            businessType={business.type}
            businessName={business.name}
            format={format}
          />
        </div>

        <div className="mx-auto w-full max-w-[520px]">
          {format === "carousel" ? (
            <CarouselPreview
              slides={slides}
              template={template}
              brand={brand}
              businessName={business.name}
              businessType={business.type}
              showBrandName={showBrandName}
              showContact={showContact}
              format={format}
              activeIndex={activeIndex}
              onSelect={setActiveIndex}
              nodesRef={slideNodes}
            />
          ) : format === "video" ? (
            <StoryboardPreview
              slides={slides}
              template={template}
              brand={brand}
              businessName={business.name}
              businessType={business.type}
              showBrandName={showBrandName}
              showContact={showContact}
              spec={spec}
              activeIndex={activeIndex}
              onSelect={setActiveIndex}
            />
          ) : (
            <div
              className={`card-soft mx-auto overflow-hidden p-2 ${format === "story" ? "max-w-[320px]" : ""}`}
            >
              <PostCanvas
                ref={canvasRef}
                template={template}
                content={content}
                brand={brand}
                businessName={business.name}
                businessType={business.type}
                showBrandName={showBrandName}
                showContact={showContact}
                adjustments={active.adjustments}
                format={format}
                className="rounded-xl"
              />
            </div>
          )}
        </div>

        <div className="mx-auto w-full max-w-[520px]">
          {generated ? (
            <ShareActions
              canvasRef={canvasRef}
              filename={slides[0]!.content.title || business.name}
              caption={slides[0]!.content.caption}
              onSave={persist}
              saving={saving}
              size={{ width: size.width, height: size.height }}
              {...(format === "carousel" ? { slideNodes } : {})}
              exportable={spec.exportable}
            />
          ) : (
            <Button className="h-12 w-full rounded-xl" onClick={generate} disabled={locked}>
              <Sparkles className="mr-1 size-4" />
              {t("create.generate")}
            </Button>
          )}
        </div>

        {generated ? (
          <button
            className="mx-auto text-xs font-semibold text-muted-foreground underline-offset-4 hover:underline"
            onClick={resetAll}
          >
            Start something new
          </button>
        ) : null}
      </section>
    </div>
  );
}
