import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Minus,
  Plus,
  Star,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AppShell } from "@/components/rafty/AppShell";
import { PostCanvas } from "@/components/rafty/PostCanvas";
import { LazyMount } from "@/components/rafty/LazyMount";
import { placeholderContent } from "@/lib/rafty/placeholder";

import { useRafty } from "@/lib/rafty/store";
import { readFileAsDataUrl } from "@/lib/rafty/file";
import * as repo from "@/lib/rafty/repo";
import type {
  CustomTemplateRequest,
  Template,
  TemplateTag,
  TemplateZone,
  ZoneKey,
} from "@/lib/rafty/types";

export const Route = createFileRoute("/_authenticated/templates")({
  head: () => ({
    meta: [
      { title: "Templates | krijo24" },
      {
        name: "description",
        content: "A library of visual post templates, plus your own uploaded designs.",
      },
      { property: "og:title", content: "Templates | krijo24" },
      { property: "og:description", content: "Pick a look, then bring your own content." },
    ],
  }),
  component: () => (
    <AppShell>
      <TemplatesPage />
    </AppShell>
  ),
});

const ALL_TAGS: TemplateTag[] = [
  "editorial",
  "minimal",
  "bold",
  "luxury",
  "whitespace",
  "dense",
  "image_first",
  "type_first",
  "gradient",
  "dark",
  "light",
  "glass",
  "blur",
  "asymmetric",
  "centered",
  "split",
  "offer",
];

const TAG_LABELS: Record<TemplateTag, string> = {
  editorial: "Editorial",
  minimal: "Minimal",
  bold: "Bold",
  luxury: "Luxury",
  whitespace: "Whitespace",
  dense: "Dense",
  image_first: "Image first",
  type_first: "Type first",
  gradient: "Gradient",
  dark: "Dark",
  light: "Light",
  glass: "Glass",
  blur: "Blur",
  asymmetric: "Asymmetric",
  centered: "Centered",
  split: "Split",
  offer: "Offer",
};

const ZONE_KEYS: ZoneKey[] = [
  "title",
  "subject",
  "price",
  "location",
  "date",
  "services",
  "additionalText",
  "cta",
  "brandName",
  "logo",
];

const ZONE_LABELS: Record<ZoneKey, string> = {
  title: "Title",
  subject: "Subject",
  price: "Price",
  location: "Location",
  date: "Date",
  services: "Services",
  additionalText: "Additional text",
  cta: "Call to action",
  brandName: "Brand name",
  logo: "Logo",
};

const REQUIREMENTS_TEXT =
  "Design needs: leave empty space where dynamic text will be placed, do not bake any of that text into the image, keep those areas transparent or a flat background, minimum size 1080x1350 pixels, aspect ratio 4:5.";

function defaultZone(key: ZoneKey): TemplateZone {
  return {
    key,
    x: 10,
    y: 10,
    width: 80,
    size: key === "logo" ? 14 : 6,
    align: "left",
    color: "#ffffff",
    weight: key === "title" ? "extra" : "regular",
    uppercase: false,
  };
}

function readImageSize(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error("Could not read this image."));
    img.src = dataUrl;
  });
}

function UploadWizard({ businessId, onDone }: { businessId: string; onDone: () => void }) {
  const [stage, setStage] = useState<"pick" | "requirements" | "map">("pick");
  const [file, setFile] = useState<File | null>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [dims, setDims] = useState<{ width: number; height: number } | null>(null);
  const [zones, setZones] = useState<TemplateZone[]>([]);
  const [selectedKey, setSelectedKey] = useState<ZoneKey | null>(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const selectedZone = zones.find((z) => z.key === selectedKey) ?? null;
  const isGoodRatio = dims ? Math.abs(dims.width / dims.height - 4 / 5) < 0.02 : true;

  function updateZone(key: ZoneKey, patch: Partial<TemplateZone>) {
    setZones((prev) => prev.map((z) => (z.key === key ? { ...z, ...patch } : z)));
  }

  function placeAt(clientPercentX: number, clientPercentY: number) {
    if (!selectedKey) return;
    const exists = zones.some((z) => z.key === selectedKey);
    if (exists) {
      updateZone(selectedKey, { x: clientPercentX, y: clientPercentY });
    } else {
      setZones((prev) => [
        ...prev,
        { ...defaultZone(selectedKey), x: clientPercentX, y: clientPercentY },
      ]);
    }
  }

  async function save() {
    setSaving(true);
    const requirements = REQUIREMENTS_TEXT;
    const templateId = await repo.saveCustomTemplate({
      businessId,
      name: name.trim() || (file?.name ?? "Custom template"),
      engine: "custom",
      variant: { align: "left", tone: "dark", badge: "pill" },
      backgroundDataUrl: dataUrl,
      requirements,
      zones,
      lockedDesign: true,
    });
    setSaving(false);
    if (!templateId) {
      toast.error("Could not save this template. Please try again.");
      return;
    }
    if (zones.length === 0) {
      toast.success(
        "Saved as a locked background. Only zones you map later can be edited per post.",
      );
    } else {
      toast.success("Custom template saved.");
    }
    onDone();
  }

  return (
    <div className="card-soft grid gap-4 p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold">Add your own template</p>
        <Button variant="ghost" size="icon" className="rounded-xl" onClick={onDone}>
          <X className="size-4" />
        </Button>
      </div>

      {stage === "pick" ? (
        <div className="grid gap-3">
          <p className="text-sm text-muted-foreground">
            Upload your design as a PNG or JPG. It will never be distorted, restyled, or marked with
            any krijo24 branding.
          </p>
          <label className="w-fit">
            <input
              type="file"
              accept="image/png,image/jpeg"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const url = await readFileAsDataUrl(f);
                setFile(f);
                setDataUrl(url);
                try {
                  setDims(await readImageSize(url));
                } catch {
                  setDims(null);
                }
                setStage("requirements");
              }}
            />
            <span className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-xl border px-4 text-sm font-semibold">
              <Upload className="size-4" />
              Choose image
            </span>
          </label>
        </div>
      ) : null}

      {stage === "requirements" && dataUrl ? (
        <div className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
            <div className="aspect-[4/5] w-full overflow-hidden rounded-xl border bg-muted">
              <img src={dataUrl} alt="" className="size-full object-cover" />
            </div>
            <div className="grid gap-2 text-sm">
              <p className="text-muted-foreground">{REQUIREMENTS_TEXT}</p>
              {dims ? (
                <p className="font-semibold">
                  Detected size: {dims.width}x{dims.height}px
                </p>
              ) : null}
              {!isGoodRatio ? (
                <div className="flex items-start gap-2 rounded-xl border border-amber-400/60 bg-amber-50 p-3 text-amber-800">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  <p>
                    This image is not a 4:5 ratio. It will still be saved, but it may be cropped
                    when used on a post. For best results use 1080x1350 or another 4:5 size.
                  </p>
                </div>
              ) : null}
              {dims && (dims.width < 1080 || dims.height < 1350) ? (
                <div className="flex items-start gap-2 rounded-xl border border-amber-400/60 bg-amber-50 p-3 text-amber-800">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  <p>This image is smaller than the recommended minimum of 1080x1350 pixels.</p>
                </div>
              ) : null}
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="h-10 rounded-xl" onClick={() => setStage("pick")}>
              Choose a different image
            </Button>
            <Button className="ml-auto h-10 rounded-xl" onClick={() => setStage("map")}>
              Continue to mapping
            </Button>
          </div>
        </div>
      ) : null}

      {stage === "map" && dataUrl ? (
        <div className="grid gap-4">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Template name"
            className="h-10 rounded-xl border bg-card px-3 text-sm"
          />
          <p className="text-sm text-muted-foreground">
            Tap a field below, then tap on the design to place it. Use the controls to fine tune
            position and size. If you don't map any zone, this becomes a locked background image
            only.
          </p>
          <div className="flex flex-wrap gap-2">
            {ZONE_KEYS.map((key) => {
              const placed = zones.some((z) => z.key === key);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedKey(key)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                    selectedKey === key
                      ? "border-primary bg-primary-soft"
                      : placed
                        ? "border-foreground/30 bg-card"
                        : "border-border bg-background text-muted-foreground"
                  }`}
                >
                  {ZONE_LABELS[key]}
                  {placed ? " •" : ""}
                </button>
              );
            })}
          </div>

          <div
            className="relative aspect-[4/5] w-full max-w-sm cursor-crosshair overflow-hidden rounded-xl border bg-muted"
            onClick={(e) => {
              if (!selectedKey) {
                toast.error("Pick a field to place first.");
                return;
              }
              const rect = e.currentTarget.getBoundingClientRect();
              const px = ((e.clientX - rect.left) / rect.width) * 100;
              const py = ((e.clientY - rect.top) / rect.height) * 100;
              placeAt(Math.round(px), Math.round(py));
            }}
          >
            <img src={dataUrl} alt="" className="pointer-events-none size-full object-cover" />
            {zones.map((z) => (
              <div
                key={z.key}
                className={`absolute -translate-x-1/2 -translate-y-1/2 rounded border px-1.5 py-0.5 text-[10px] font-bold ${
                  selectedKey === z.key
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-white/70 bg-black/50 text-white"
                }`}
                style={{ left: `${z.x}%`, top: `${z.y}%` }}
              >
                {ZONE_LABELS[z.key]}
              </div>
            ))}
          </div>

          {selectedZone ? (
            <div className="grid gap-3 rounded-xl border bg-card p-3">
              <p className="text-sm font-semibold">{ZONE_LABELS[selectedZone.key]}</p>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="grid gap-1">
                  <span className="font-semibold text-muted-foreground">Position</span>
                  <div className="flex flex-wrap gap-1.5">
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-8 rounded-lg"
                      onClick={() =>
                        updateZone(selectedZone.key, { y: Math.max(0, selectedZone.y - 3) })
                      }
                    >
                      <ArrowUp className="size-3.5" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-8 rounded-lg"
                      onClick={() =>
                        updateZone(selectedZone.key, { y: Math.min(100, selectedZone.y + 3) })
                      }
                    >
                      <ArrowDown className="size-3.5" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-8 rounded-lg"
                      onClick={() =>
                        updateZone(selectedZone.key, { x: Math.max(0, selectedZone.x - 3) })
                      }
                    >
                      <ArrowLeft className="size-3.5" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-8 rounded-lg"
                      onClick={() =>
                        updateZone(selectedZone.key, { x: Math.min(100, selectedZone.x + 3) })
                      }
                    >
                      <ArrowRight className="size-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="grid gap-1">
                  <span className="font-semibold text-muted-foreground">Size</span>
                  <div className="flex flex-wrap gap-1.5">
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-8 rounded-lg"
                      onClick={() =>
                        updateZone(selectedZone.key, { size: Math.max(2, selectedZone.size - 1) })
                      }
                    >
                      <Minus className="size-3.5" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-8 rounded-lg"
                      onClick={() =>
                        updateZone(selectedZone.key, { size: Math.min(40, selectedZone.size + 1) })
                      }
                    >
                      <Plus className="size-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="grid gap-1">
                  <span className="font-semibold text-muted-foreground">Width</span>
                  <div className="flex flex-wrap gap-1.5">
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-8 rounded-lg"
                      onClick={() =>
                        updateZone(selectedZone.key, {
                          width: Math.max(10, selectedZone.width - 5),
                        })
                      }
                    >
                      <Minus className="size-3.5" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-8 rounded-lg"
                      onClick={() =>
                        updateZone(selectedZone.key, {
                          width: Math.min(100, selectedZone.width + 5),
                        })
                      }
                    >
                      <Plus className="size-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="grid gap-1">
                  <span className="font-semibold text-muted-foreground">Color</span>
                  <input
                    type="color"
                    value={selectedZone.color}
                    onChange={(e) => updateZone(selectedZone.key, { color: e.target.value })}
                    className="h-8 w-full cursor-pointer rounded-lg border"
                  />
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="w-fit rounded-lg text-destructive"
                onClick={() => {
                  setZones((prev) => prev.filter((z) => z.key !== selectedZone.key));
                  setSelectedKey(null);
                }}
              >
                Remove this zone
              </Button>
            </div>
          ) : null}

          {zones.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No zones mapped yet. Saving now will lock this as a background only image, nothing on
              it will be editable per post.
            </p>
          ) : null}

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="h-10 rounded-xl"
              onClick={() => setStage("requirements")}
            >
              Back
            </Button>
            <Button
              className="ml-auto h-10 rounded-xl"
              disabled={saving}
              onClick={() => void save()}
            >
              {saving ? "Saving..." : "Save template"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function TemplatesPage() {
  const { business, brand, templates, favorites, toggleFavorite, refresh, t } = useRafty();
  const placeholder = useMemo(
    () => placeholderContent(business?.type ?? "other"),
    [business?.type],
  );

  const [tag, setTag] = useState<TemplateTag | "all">("all");
  const [wizardOpen, setWizardOpen] = useState(false);
  const [requests, setRequests] = useState<CustomTemplateRequest[]>([]);

  useEffect(() => {
    if (!business) return;
    let cancelled = false;
    void repo.listRequests(business.id).then((rows) => {
      if (!cancelled) setRequests(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [business, wizardOpen]);

  const custom = useMemo(() => templates.filter((x) => x.scope === "custom"), [templates]);
  const global = useMemo(() => templates.filter((x) => x.scope === "global"), [templates]);

  const filteredCustom = useMemo(
    () => (tag === "all" ? custom : custom.filter((x) => (x.tags ?? []).includes(tag))),
    [custom, tag],
  );
  const filteredGlobal = useMemo(
    () => (tag === "all" ? global : global.filter((x) => (x.tags ?? []).includes(tag))),
    [global, tag],
  );

  if (!business) return null;

  const ordered: Template[] = [...filteredCustom, ...filteredGlobal];

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end gap-3">
        <div className="mr-auto">
          <h1 className="font-display text-2xl font-extrabold">{t("tpl.title")}</h1>
          <p className="text-sm text-muted-foreground">{templates.length} templates</p>
        </div>
        <Select value={tag} onValueChange={(v) => setTag(v as TemplateTag | "all")}>
          <SelectTrigger className="h-11 w-[200px] rounded-xl bg-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("tpl.all")}</SelectItem>
            {ALL_TAGS.map((tg) => (
              <SelectItem key={tg} value={tg}>
                {TAG_LABELS[tg]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button className="h-11 rounded-xl" onClick={() => setWizardOpen(true)}>
          <Upload className="mr-2 size-4" />
          {t("tpl.upload")}
        </Button>
      </div>

      {wizardOpen ? (
        <div className="mb-6">
          <UploadWizard
            businessId={business.id}
            onDone={() => {
              setWizardOpen(false);
              refresh();
            }}
          />
        </div>
      ) : null}

      {requests.length ? (
        <div className="card-soft mb-6 grid gap-2 p-4 text-sm">
          <p className="font-semibold">{t("tpl.mine")}</p>
          {requests.map((r) => (
            <div key={r.id} className="flex items-center gap-3 text-muted-foreground">
              <span className="truncate">{r.fileName}</span>
              <span className="ml-auto shrink-0 font-semibold text-foreground">
                {t(`tpl.${r.status}`)}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 xl:grid-cols-5">
        {ordered.map((tpl) => (
          <article key={tpl.id} className="card-soft relative overflow-hidden">
            <div className="overflow-hidden p-1.5">
              {brand && business ? (
                <LazyMount>
                  <PostCanvas
                    template={tpl}
                    content={placeholder}
                    brand={brand}
                    businessName={business.name}
                    businessType={business.type}
                    className="rounded-md"
                  />
                </LazyMount>
              ) : (
                <div className="aspect-[4/5] w-full rounded-md bg-muted" />
              )}
            </div>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label="Favourite"
              className="absolute right-1.5 top-1.5 size-7 rounded-full bg-background/80"
              onClick={() => void toggleFavorite(tpl.id)}
            >
              <Star
                className={
                  favorites.includes(tpl.id)
                    ? "size-3.5 fill-primary text-primary"
                    : "size-3.5 text-muted-foreground"
                }
              />
            </Button>
            <div className="flex items-center gap-2 px-2 pb-2">
              <div className="min-w-0">
                <p className="truncate text-[11px] font-bold">{tpl.name}</p>
                <p className="truncate text-[10px] text-muted-foreground">
                  {tpl.scope === "custom"
                    ? "Your template"
                    : (tpl.tags ?? []).map((x) => TAG_LABELS[x]).join(", ")}
                </p>
              </div>
              <Button
                asChild
                size="sm"
                variant="ghost"
                className="ml-auto h-7 shrink-0 rounded-lg px-2 text-[11px]"
              >
                <Link to="/create" search={{ template: tpl.id }}>
                  {t("tpl.select")}
                </Link>
              </Button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
