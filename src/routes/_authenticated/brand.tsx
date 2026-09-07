import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowDown, ArrowUp, Lock, Plus, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AppShell } from "@/components/rafty/AppShell";
import { useRafty } from "@/lib/rafty/store";
import { readFileAsDataUrl } from "@/lib/rafty/file";
import {
  BUSINESS_TYPES,
  BUSINESS_TYPE_NAMES,
  CUSTOM_TYPE_SUGGESTIONS,
  FONT_CATEGORIES,
  FONT_LIBRARY,
} from "@/lib/rafty/constants";
import {
  contactSets,
  emptyContact,
  type BrandContact,
  type ContactSet,
  type BusinessType,
  type ContentInstructions,
} from "@/lib/rafty/types";

export const Route = createFileRoute("/_authenticated/brand")({
  head: () => ({
    meta: [
      { title: "Brand settings | krijo24" },
      {
        name: "description",
        content: "Colors, fonts, logo, services and how you talk about your business.",
      },
      { property: "og:title", content: "Brand settings | krijo24" },
      { property: "og:description", content: "Everything your templates use to stay on brand." },
    ],
  }),
  component: () => (
    <AppShell>
      <BrandPage />
    </AppShell>
  ),
});

const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

function ColorField({
  label,
  value,
  onChange,
  optional,
}: {
  label: string;
  value: string | null;
  onChange: (hex: string | null) => void;
  optional?: boolean;
}) {
  const [draft, setDraft] = useState(value ?? "");

  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={HEX_RE.test(value ?? "") ? (value as string) : "#ffffff"}
          onChange={(e) => {
            setDraft(e.target.value);
            onChange(e.target.value);
          }}
          className="h-11 w-12 shrink-0 cursor-pointer rounded-xl border bg-card"
          aria-label={`${label} picker`}
        />
        <Input
          value={draft}
          placeholder="#000000"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            const v = draft.trim();
            if (!v) {
              if (optional) onChange(null);
              return;
            }
            if (HEX_RE.test(v)) onChange(v);
            else toast.error(`${label}: enter a valid hex color, for example #6D4DFF.`);
          }}
          className="h-11 flex-1 rounded-xl font-mono uppercase"
        />
        {optional && value ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-11 shrink-0 rounded-xl"
            onClick={() => {
              setDraft("");
              onChange(null);
            }}
          >
            Clear
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function FontPicker({
  label,
  value,
  onChange,
  optional,
}: {
  label: string;
  value: string | null;
  onChange: (family: string | null) => void;
  optional?: boolean;
}) {
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        {optional && value ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 rounded-lg text-xs"
            onClick={() => onChange(null)}
          >
            Remove
          </Button>
        ) : null}
      </div>
      <div className="grid max-h-64 gap-4 overflow-y-auto rounded-xl border bg-card p-3">
        {FONT_CATEGORIES.map((category) => {
          const options = FONT_LIBRARY.filter((f) => f.category === category);
          return (
            <div key={category} className="grid gap-1.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {category}
              </p>
              <div className="grid gap-1.5">
                {options.map((f) => (
                  <button
                    key={f.family}
                    type="button"
                    onClick={() => onChange(f.family)}
                    style={{ fontFamily: `"${f.family}", sans-serif` }}
                    className={`rounded-lg border px-3 py-2 text-left text-sm font-semibold ${
                      value === f.family
                        ? "border-primary bg-primary-soft"
                        : "border-border bg-background"
                    }`}
                  >
                    {f.family}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AddBrandForm({ onDone }: { onDone: () => void }) {
  const { createBrand } = useRafty();
  const [name, setName] = useState("");
  const [type, setType] = useState<BusinessType>("other");
  const [customType, setCustomType] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <div className="grid gap-3 rounded-xl border bg-card p-3">
      <div className="grid gap-1.5">
        <Label>Brand name</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} className="h-10 rounded-xl" />
      </div>
      <div className="grid gap-1.5">
        <Label>Business type</Label>
        <Select value={type} onValueChange={(v) => setType(v as BusinessType)}>
          <SelectTrigger className="h-10 rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BUSINESS_TYPES.map((bt) => (
              <SelectItem key={bt} value={bt}>
                {BUSINESS_TYPE_NAMES[bt]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {type === "other" ? (
        <div className="grid gap-1.5">
          <Label>Custom category</Label>
          <Input
            list="custom-type-suggestions-brand"
            value={customType}
            onChange={(e) => setCustomType(e.target.value)}
            placeholder="For example bakery, gym, clinic"
            className="h-10 rounded-xl"
          />
          <datalist id="custom-type-suggestions-brand">
            {CUSTOM_TYPE_SUGGESTIONS.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </div>
      ) : null}
      <div className="flex gap-2">
        <Button
          className="h-10 flex-1 rounded-xl"
          disabled={busy || !name.trim()}
          onClick={async () => {
            setBusy(true);
            const res = await createBrand({
              name: name.trim(),
              type,
              customType: type === "other" ? customType.trim() || null : null,
            });
            setBusy(false);
            if (!res.ok) {
              toast.error(res.error ?? "Could not add this brand.");
              return;
            }
            toast.success("Brand added.");
            onDone();
          }}
        >
          {busy ? "Adding..." : "Create brand"}
        </Button>
        <Button variant="outline" className="h-10 rounded-xl" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

/** One or more named contact blocks. Most businesses have a single one, a
 * second office or city is added only when it exists, and Create picks which
 * block a post prints. The first block is mirrored into the plain fields so
 * older posts keep rendering the same details. */
function ContactForm({
  value,
  onSave,
}: {
  value: BrandContact;
  onSave: (contact: BrandContact) => Promise<void>;
}) {
  const [sets, setSets] = useState<ContactSet[]>(() => {
    const existing = contactSets(value);
    return existing.length
      ? existing
      : [
          {
            id: "main",
            label: "Main",
            phones: [],
            email: "",
            website: "",
            address: "",
            social: "",
          },
        ];
  });
  const [saving, setSaving] = useState(false);

  const patch = (index: number, part: Partial<ContactSet>) =>
    setSets((prev) => prev.map((s, i) => (i === index ? { ...s, ...part } : s)));

  function addSet() {
    setSets((prev) => [
      ...prev,
      {
        id: `set-${Date.now()}`,
        label: `Location ${prev.length + 1}`,
        phones: [],
        email: "",
        website: "",
        address: "",
        social: "",
      },
    ]);
  }

  async function save() {
    setSaving(true);
    try {
      const cleaned = sets.map((s, i) => ({
        ...s,
        label: s.label.trim() || `Contact ${i + 1}`,
        phones: s.phones.map((p) => p.trim()).filter(Boolean),
      }));
      const first = cleaned[0]!;
      await onSave({
        phones: first.phones,
        email: first.email.trim(),
        website: first.website.trim(),
        address: first.address.trim(),
        social: first.social.trim(),
        sets: cleaned,
      });
      setSets(cleaned);
      toast.success("Contact info saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card-soft grid gap-3 p-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-bold">Contact information</p>
        <p className="text-xs text-muted-foreground">Choose one per post</p>
      </div>

      {sets.map((set, index) => (
        <div key={set.id} className="grid gap-3 rounded-xl border border-border bg-card p-3">
          <div className="flex items-center gap-2">
            <Input
              value={set.label}
              maxLength={30}
              onChange={(e) => patch(index, { label: e.target.value })}
              placeholder="Name this block"
              className="h-9 max-w-48 rounded-lg font-semibold"
            />
            {sets.length > 1 ? (
              <Button
                variant="ghost"
                size="icon"
                className="ml-auto size-9 rounded-xl"
                aria-label="Remove contact block"
                onClick={() => setSets((prev) => prev.filter((_, i) => i !== index))}
              >
                <Trash2 className="size-4" />
              </Button>
            ) : null}
          </div>

          <div className="grid gap-2">
            {set.phones.map((phone, pi) => (
              <div key={pi} className="flex items-center gap-2">
                <Input
                  value={phone}
                  onChange={(e) =>
                    patch(index, {
                      phones: set.phones.map((v, i) => (i === pi ? e.target.value : v)),
                    })
                  }
                  placeholder="Phone number"
                  className="h-10 rounded-xl"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-10 shrink-0 rounded-xl"
                  aria-label="Remove phone"
                  onClick={() => patch(index, { phones: set.phones.filter((_, i) => i !== pi) })}
                >
                  <X className="size-4" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              className="h-9 w-fit rounded-xl"
              onClick={() => patch(index, { phones: [...set.phones, ""] })}
            >
              <Plus className="mr-1 size-3.5" />
              Add phone
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              value={set.email}
              onChange={(e) => patch(index, { email: e.target.value })}
              placeholder="hello@yourbrand.com"
              className="h-10 rounded-xl"
            />
            <Input
              value={set.website}
              onChange={(e) => patch(index, { website: e.target.value })}
              placeholder="yourbrand.com"
              className="h-10 rounded-xl"
            />
            <Input
              value={set.address}
              onChange={(e) => patch(index, { address: e.target.value })}
              placeholder="Street, city"
              className="h-10 rounded-xl"
            />
            <Input
              value={set.social}
              onChange={(e) => patch(index, { social: e.target.value })}
              placeholder="@yourbrand"
              className="h-10 rounded-xl"
            />
          </div>
        </div>
      ))}

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" className="h-10 rounded-xl" onClick={addSet}>
          <Plus className="mr-1 size-4" />
          Add contact block
        </Button>
        <Button className="h-10 rounded-xl" disabled={saving} onClick={save}>
          {saving ? "Saving..." : "Save contact info"}
        </Button>
      </div>
    </div>
  );
}

function BrandPage() {
  const {
    business,
    brand,
    services,
    posts,
    trial,
    plan,
    brands,
    brandSlotsLeft,
    saveBrand,
    addService,
    renameService,
    removeService,
    reorderServices,
    selectBrand,
    t,
  } = useRafty();

  const [newService, setNewService] = useState("");
  const [savingService, setSavingService] = useState(false);
  const [editingService, setEditingService] = useState<string | null>(null);
  const [addingBrand, setAddingBrand] = useState(false);
  const [instructions, setInstructions] = useState<ContentInstructions | null>(null);

  if (!business || !brand) return null;

  const current = instructions ?? brand.instructions;
  const trialLeft = Math.max(0, (trial?.freePostLimit ?? 1) - (trial?.postsCreated ?? 0));

  /** A short read on how this brand is actually being used. */
  const now = new Date();
  const thisMonth = posts.filter((p) => {
    const d = new Date(p.createdAt);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }).length;
  const templatesUsed = new Set(posts.map((p) => p.templateId)).size;
  const lastPost = posts[0]?.createdAt;
  const stats: { label: string; value: string }[] = [
    { label: "Posts created", value: String(posts.length) },
    { label: "This month", value: String(thisMonth) },
    { label: "Templates used", value: String(templatesUsed) },
    { label: "Services saved", value: String(services.length) },
    {
      label: "Last post",
      value: lastPost ? new Date(lastPost).toLocaleDateString() : "—",
    },
    {
      label: business.status === "approved" ? "Plan" : "Free posts left",
      value:
        business.status === "approved"
          ? plan?.active
            ? `${plan.plan} · unlimited`
            : "awaiting activation"
          : String(trialLeft),
    },
  ];

  /** Awaits the database write before clearing the input, so a rejected write
   * never looks like a success. */
  async function submitService() {
    const value = newService.trim();
    if (!value || savingService) return;
    setSavingService(true);
    const res = await addService(value);
    setSavingService(false);
    if (!res.ok) {
      toast.error(res.error ?? "Could not save that service.");
      return;
    }
    setNewService("");
    toast.success(t("brand.saved"));
  }

  async function moveService(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= services.length) return;
    const ids = services.map((s) => s.id);
    const tmp = ids[index]!;
    ids[index] = ids[target]!;
    ids[target] = tmp;
    const res = await reorderServices(ids);
    if (!res.ok) toast.error(res.error ?? "Could not reorder services.");
  }

  return (
    <div className="mx-auto grid max-w-3xl gap-5">
      <div>
        <h1 className="font-display text-2xl font-extrabold">{t("brand.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("brand.status")}: {t(`status.${business.status}`)}
          {business.status !== "approved" ? ` | ${t("trial.remaining")}: ${trialLeft}` : ""}
        </p>
      </div>

      <div className="card-soft grid grid-cols-2 gap-3 p-4 sm:grid-cols-3">
        {stats.map((stat) => (
          <div key={stat.label}>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {stat.label}
            </p>
            <p className="truncate text-lg font-extrabold capitalize">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="card-soft grid gap-4 p-4">
        <p className="text-sm font-bold">Business identity</p>
        <div className="grid gap-1.5">
          <Label>{t("brand.business")}</Label>
          <Input value={business.name} readOnly className="h-11 rounded-xl bg-muted" />
        </div>
        <div className="grid gap-1.5">
          <Label>{t("brand.type")}</Label>
          <Input
            value={business.customType || BUSINESS_TYPE_NAMES[business.type]}
            readOnly
            className="h-11 rounded-xl bg-muted"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Business name and type can only be changed by a krijo24 admin. Contact support if these
          are wrong.
        </p>
      </div>

      <div className="card-soft grid gap-3 p-4">
        <p className="text-sm font-bold">Logo</p>
        <div className="flex items-center gap-3">
          <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-xl border bg-card">
            {brand.logoDataUrl ? (
              <img src={brand.logoDataUrl} alt="" className="size-full object-contain p-1" />
            ) : null}
          </div>
          {brand.logoLocked ? (
            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <Lock className="mt-0.5 size-3.5 shrink-0" />
              <p>
                This logo is locked. Only a krijo24 admin can change it, the database enforces this
                rule.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <label className="inline-flex w-fit">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    await saveBrand({ logoDataUrl: await readFileAsDataUrl(file) });
                    toast.success(t("brand.saved"));
                  }}
                />
                <span className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl border px-4 text-sm font-semibold">
                  <Upload className="size-4" />
                  {t("onb.uploadLogo")}
                </span>
              </label>
              <p className="text-xs text-muted-foreground">
                A logo can only be set once. After saving, only a krijo24 admin can replace it.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="card-soft grid gap-4 p-4">
        <p className="text-sm font-bold">Colors</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <ColorField
            label="Primary color"
            value={brand.primary}
            onChange={(v) => v && saveBrand({ primary: v })}
          />
          <ColorField
            label="Secondary color"
            value={brand.secondary}
            onChange={(v) => v && saveBrand({ secondary: v })}
          />
          <ColorField
            label="Accent color"
            value={brand.accent}
            onChange={(v) => v && saveBrand({ accent: v })}
          />
          <ColorField
            label="Background color (optional)"
            value={brand.background}
            optional
            onChange={(v) => saveBrand({ background: v })}
          />
        </div>
      </div>

      <div className="card-soft grid gap-4 p-4">
        <p className="text-sm font-bold">Fonts</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <FontPicker
            label="Primary font"
            value={brand.fontFamily}
            onChange={(v) => v && saveBrand({ fontFamily: v })}
          />
          <FontPicker
            label="Secondary font (optional)"
            value={brand.fontSecondary}
            optional
            onChange={(v) => saveBrand({ fontSecondary: v })}
          />
        </div>
      </div>

      <div className="card-soft grid gap-4 p-4">
        <p className="text-sm font-bold">Post preferences</p>
        <div className="flex items-center justify-between rounded-xl border bg-card px-4 py-3">
          <div>
            <p className="text-sm font-semibold">Show brand name on posts</p>
            <p className="text-xs text-muted-foreground">
              Off by default. Turn on to print your brand name on generated posts.
            </p>
          </div>
          <Switch
            checked={brand.showBrandName}
            onCheckedChange={async (v) => {
              await saveBrand({ showBrandName: v });
              toast.success(t("brand.saved"));
            }}
          />
        </div>
      </div>

      <ContactForm
        value={brand.contact ?? emptyContact}
        onSave={(contact) => saveBrand({ contact })}
      />

      <div className="card-soft grid gap-3 p-4">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-sm font-bold">{t("brand.services")}</p>
          <p className="text-xs text-muted-foreground">Reusable in every post</p>
        </div>
        {services.length ? (
          <div className="flex flex-wrap gap-2">
            {services.map((s, index) =>
              editingService === s.id ? (
                <div key={s.id} className="flex items-center gap-1.5">
                  <Input
                    autoFocus
                    defaultValue={s.name}
                    maxLength={60}
                    className="h-9 w-40 rounded-full"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                      if (e.key === "Escape") setEditingService(null);
                    }}
                    onBlur={async (e) => {
                      const v = e.target.value.trim();
                      setEditingService(null);
                      if (!v || v === s.name) return;
                      const res = await renameService(s.id, v);
                      if (!res.ok) toast.error(res.error ?? "Could not rename that service.");
                      else toast.success(t("brand.saved"));
                    }}
                  />
                </div>
              ) : (
                <div
                  key={s.id}
                  className="group flex items-center gap-1 rounded-full border border-border bg-card py-1 pl-3 pr-1 text-sm font-semibold"
                >
                  <button
                    type="button"
                    className="max-w-44 truncate hover:text-primary"
                    onClick={() => setEditingService(s.id)}
                    title="Edit service"
                  >
                    {s.name}
                  </button>
                  <button
                    type="button"
                    aria-label="Move up"
                    disabled={index === 0}
                    className="grid size-6 place-items-center rounded-full text-muted-foreground hover:bg-muted disabled:opacity-30"
                    onClick={() => void moveService(index, -1)}
                  >
                    <ArrowUp className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label="Move down"
                    disabled={index === services.length - 1}
                    className="grid size-6 place-items-center rounded-full text-muted-foreground hover:bg-muted disabled:opacity-30"
                    onClick={() => void moveService(index, 1)}
                  >
                    <ArrowDown className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label={t("posts.delete")}
                    className="grid size-6 place-items-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    onClick={async () => {
                      const res = await removeService(s.id);
                      if (!res.ok) toast.error(res.error ?? "Could not delete that service.");
                    }}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ),
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            No services yet. Add the ones you include most often.
          </p>
        )}
        <div className="flex gap-2">
          <Input
            value={newService}
            maxLength={60}
            onChange={(e) => setNewService(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void submitService();
            }}
            placeholder={t("create.addService")}
            className="h-10 rounded-xl"
          />
          <Button
            variant="outline"
            className="h-10 shrink-0 rounded-xl"
            disabled={savingService || !newService.trim()}
            onClick={() => void submitService()}
          >
            <Plus className="mr-1.5 size-4" />
            {savingService ? "Saving..." : t("onb.addService")}
          </Button>
        </div>
      </div>

      <div className="card-soft grid gap-3 p-4">
        <p className="text-sm font-bold">Your usual description</p>
        <p className="text-xs text-muted-foreground">
          Paste a caption you already use. krijo24 matches its style when writing, and only ever
          uses this post's real information.
        </p>
        <Textarea
          value={current.styleSample}
          rows={5}
          maxLength={1200}
          onChange={(e) => setInstructions({ ...current, styleSample: e.target.value })}
          placeholder="Paste one of your own post descriptions here..."
          className="rounded-xl"
        />
        <div className="grid gap-1.5">
          <Label>Hashtags (optional)</Label>
          <Input
            value={current.hashtags}
            onChange={(e) => setInstructions({ ...current, hashtags: e.target.value })}
            placeholder="#yourbrand #city"
            className="h-10 rounded-xl"
          />
        </div>
        <Button
          className="h-10 w-fit rounded-xl"
          onClick={async () => {
            await saveBrand({ instructions: current });
            setInstructions(null);
            toast.success(t("brand.saved"));
          }}
        >
          {t("brand.save")}
        </Button>
      </div>

      <div className="card-soft grid gap-3 p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold">Brands</p>
          <p className="text-xs text-muted-foreground">
            {plan ? `${brands.length} of ${plan.brandLimit} used` : ""} | {brandSlotsLeft} slots
            left
          </p>
        </div>
        <div className="grid gap-2">
          {brands.map((b) => (
            <div
              key={b.id}
              className={`flex items-center justify-between rounded-xl border px-3 py-2 ${
                b.id === business.id ? "border-primary bg-primary-soft" : "border-border bg-card"
              }`}
            >
              <div>
                <p className="text-sm font-semibold">{b.name}</p>
                <p className="text-xs text-muted-foreground">
                  {b.customType || BUSINESS_TYPE_NAMES[b.type]}
                </p>
              </div>
              {b.id === business.id ? (
                <span className="text-xs font-semibold text-primary">Active</span>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl"
                  onClick={() => selectBrand(b.id)}
                >
                  Switch
                </Button>
              )}
            </div>
          ))}
        </div>
        {addingBrand ? (
          <AddBrandForm onDone={() => setAddingBrand(false)} />
        ) : (
          <Button
            variant="outline"
            className="h-10 w-fit rounded-xl"
            disabled={brandSlotsLeft <= 0}
            onClick={() => setAddingBrand(true)}
          >
            <Plus className="mr-1.5 size-4" />
            Add brand
          </Button>
        )}
        {brandSlotsLeft <= 0 ? (
          <p className="text-xs text-muted-foreground">
            Your plan does not have any more brand slots. Upgrade to add another brand.
          </p>
        ) : null}
      </div>
    </div>
  );
}
