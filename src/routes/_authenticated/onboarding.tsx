import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Logo } from "@/components/rafty/Logo";
import { useRafty } from "@/lib/rafty/store";
import { readFileAsDataUrl } from "@/lib/rafty/file";
import {
  BUSINESS_TYPES,
  CURRENCIES,
  CUSTOM_TYPE_SUGGESTIONS,
  DEFAULT_BRAND,
  FONT_LIBRARY,
  LANGUAGES,
  SERVICE_SUGGESTIONS,
} from "@/lib/rafty/constants";
import type { BusinessType, CurrencyCode, LanguageCode } from "@/lib/rafty/types";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [
      { title: "Set up your business | krijo24" },
      {
        name: "description",
        content: "Tell krijo24 about your business, brand colors, fonts, currency and services.",
      },
      { property: "og:title", content: "Set up your business | krijo24" },
      { property: "og:description", content: "A short setup and your first free post is ready." },
    ],
  }),
  component: OnboardingPage,
});

const STEP_KEYS = [
  "onb.type",
  "onb.name",
  "onb.logo",
  "onb.colors",
  "onb.font",
  "onb.currency",
  "onb.services",
  "onb.custom",
  "onb.review",
];

const SUBMIT_STEPS = [
  "Creating your account brand...",
  "Saving your brand identity...",
  "Saving your services...",
  "Finishing up...",
];

function OnboardingPage() {
  const { ready, user, business, completeOnboarding, t, language, setLanguage } = useRafty();
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [type, setType] = useState<BusinessType>("travel_agency");
  const [customType, setCustomType] = useState("");
  const [name, setName] = useState("");
  const [logoDataUrl, setLogo] = useState<string | null>(null);
  const [primary, setPrimary] = useState(DEFAULT_BRAND.primary);
  const [secondary, setSecondary] = useState(DEFAULT_BRAND.secondary);
  const [accent, setAccent] = useState(DEFAULT_BRAND.accent);
  const [fontFamily, setFont] = useState<string>(DEFAULT_BRAND.fontFamily);
  const [fontSecondary, setFontSecondary] = useState<string | null>(null);
  const [currency, setCurrency] = useState<CurrencyCode>(DEFAULT_BRAND.currency);
  const [services, setServices] = useState<string[]>([]);
  const [customService, setCustomService] = useState("");
  const [custom, setCustom] = useState<{
    fileName: string;
    fileType: string;
    previewDataUrl: string | null;
  } | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitStep, setSubmitStep] = useState(0);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const submitGuard = useRef(false);

  useEffect(() => {
    if (!ready) return;
    if (!user) navigate({ to: "/auth", replace: true });
    else if (business?.onboarded) navigate({ to: "/create", replace: true });
  }, [ready, user, business, navigate]);

  const suggestions = useMemo(() => SERVICE_SUGGESTIONS[type], [type]);
  const canNext =
    step === 0
      ? type !== "other" || customType.trim().length > 1
      : step === 1
        ? name.trim().length > 1
        : true;

  async function submit() {
    if (submitGuard.current) return;
    submitGuard.current = true;
    setSubmitting(true);
    setSubmitError(null);
    setSubmitStep(0);
    try {
      setSubmitStep(0);
      await new Promise((r) => setTimeout(r, 150));
      setSubmitStep(1);
      await new Promise((r) => setTimeout(r, 150));
      setSubmitStep(2);
      await completeOnboarding({
        type,
        customType: type === "other" ? customType.trim() : null,
        name: name.trim(),
        logoDataUrl,
        primary,
        secondary,
        accent,
        fontFamily,
        fontSecondary,
        currency,
        language,
        services,
        customTemplate: custom,
      });
      setSubmitStep(3);
      toast.success(t("onb.done"));
      navigate({ to: "/create", replace: true });
    } catch (err) {
      submitGuard.current = false;
      setSubmitting(false);
      setSubmitError(
        err instanceof Error ? err.message : "Something went wrong. Please try again.",
      );
    }
  }

  return (
    <div className="page-bg min-h-screen">
      <header className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-5">
        <Link to="/">
          <Logo height={36} />
        </Link>
        <span className="ml-auto text-xs font-semibold text-muted-foreground">
          {t("onb.step")} {step + 1} {t("onb.of")} {STEP_KEYS.length}
        </span>
      </header>

      <div className="mx-auto max-w-2xl px-4 pb-24">
        <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="brand-gradient h-full rounded-full transition-all"
            style={{ width: `${((step + 1) / STEP_KEYS.length) * 100}%` }}
          />
        </div>

        <div className="card-soft flex flex-col gap-5 p-5 sm:p-6">
          <div>
            <h1 className="font-display text-xl font-extrabold">{t("onb.title")}</h1>
            <p className="text-sm text-muted-foreground">{t(STEP_KEYS[step]!)}</p>
          </div>

          {step === 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {BUSINESS_TYPES.map((bt) => (
                <button
                  key={bt}
                  type="button"
                  onClick={() => setType(bt)}
                  className={`flex items-center justify-between rounded-2xl border p-4 text-left text-sm font-semibold transition-colors ${
                    type === bt ? "border-primary bg-primary-soft" : "border-border bg-card"
                  }`}
                >
                  {t(`type.${bt}`)}
                  {type === bt ? <Check className="size-4 text-primary" /> : null}
                </button>
              ))}
              {type === "other" ? (
                <div className="sm:col-span-2">
                  <Label className="mb-2 block" htmlFor="customType">
                    {t("onb.customType")}
                  </Label>
                  <Input
                    id="customType"
                    list="custom-type-suggestions"
                    value={customType}
                    onChange={(e) => setCustomType(e.target.value)}
                    placeholder={t("onb.customTypeHint")}
                    className="h-11 rounded-xl bg-card"
                  />
                  <datalist id="custom-type-suggestions">
                    {CUSTOM_TYPE_SUGGESTIONS.map((s) => (
                      <option key={s} value={s} />
                    ))}
                  </datalist>
                </div>
              ) : null}
              <div className="sm:col-span-2">
                <Label className="mb-2 block">{t("onb.language")}</Label>
                <Select value={language} onValueChange={(v) => setLanguage(v as LanguageCode)}>
                  <SelectTrigger className="rounded-xl bg-card">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map((l) => (
                      <SelectItem key={l.code} value={l.code}>
                        {l.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : null}

          {step === 1 ? (
            <div className="grid gap-2">
              <Label htmlFor="bname">{t("onb.name")}</Label>
              <Input
                id="bname"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder=""
                className="h-12 rounded-xl"
              />
            </div>
          ) : null}

          {step === 2 ? (
            <div className="flex flex-col gap-3">
              <div className="grid size-24 place-items-center overflow-hidden rounded-2xl border bg-card">
                {logoDataUrl ? (
                  <img src={logoDataUrl} alt="" className="size-full object-contain p-2" />
                ) : (
                  <Upload className="size-5 text-muted-foreground" />
                )}
              </div>
              <label className="w-fit">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) setLogo(await readFileAsDataUrl(file));
                  }}
                />
                <span className="inline-flex h-11 cursor-pointer items-center rounded-xl border bg-card px-4 text-sm font-semibold">
                  {t("onb.uploadLogo")}
                </span>
              </label>
              <p className="text-xs text-muted-foreground">
                A logo can only be set once. After you finish setup, only a krijo24 admin can
                replace it.
              </p>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="grid gap-2">
                <Label htmlFor="primary">{t("onb.primary")}</Label>
                <input
                  id="primary"
                  type="color"
                  value={primary}
                  onChange={(e) => setPrimary(e.target.value)}
                  className="h-12 w-full rounded-xl border bg-card"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="secondary">{t("onb.secondary")}</Label>
                <input
                  id="secondary"
                  type="color"
                  value={secondary}
                  onChange={(e) => setSecondary(e.target.value)}
                  className="h-12 w-full rounded-xl border bg-card"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="accent">Accent color</Label>
                <input
                  id="accent"
                  type="color"
                  value={accent}
                  onChange={(e) => setAccent(e.target.value)}
                  className="h-12 w-full rounded-xl border bg-card"
                />
              </div>
            </div>
          ) : null}

          {step === 4 ? (
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label>{t("onb.font")}</Label>
                <div className="grid max-h-60 gap-2 overflow-y-auto rounded-xl border bg-card p-2">
                  {FONT_LIBRARY.map((f) => (
                    <button
                      key={f.family}
                      type="button"
                      onClick={() => setFont(f.family)}
                      style={{ fontFamily: `"${f.family}", sans-serif` }}
                      className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left text-base font-semibold ${
                        fontFamily === f.family
                          ? "border-primary bg-primary-soft"
                          : "border-border bg-background"
                      }`}
                    >
                      {f.family}
                      {fontFamily === f.family ? <Check className="size-4 text-primary" /> : null}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <Label>Secondary font (optional)</Label>
                  {fontSecondary ? (
                    <button
                      type="button"
                      className="text-xs font-semibold text-muted-foreground"
                      onClick={() => setFontSecondary(null)}
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
                <div className="grid max-h-48 gap-2 overflow-y-auto rounded-xl border bg-card p-2">
                  {FONT_LIBRARY.map((f) => (
                    <button
                      key={f.family}
                      type="button"
                      onClick={() => setFontSecondary(f.family)}
                      style={{ fontFamily: `"${f.family}", sans-serif` }}
                      className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left text-base font-semibold ${
                        fontSecondary === f.family
                          ? "border-primary bg-primary-soft"
                          : "border-border bg-background"
                      }`}
                    >
                      {f.family}
                      {fontSecondary === f.family ? (
                        <Check className="size-4 text-primary" />
                      ) : null}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {step === 5 ? (
            <Select value={currency} onValueChange={(v) => setCurrency(v as CurrencyCode)}>
              <SelectTrigger className="h-12 rounded-xl bg-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}

          {step === 6 ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">{t("onb.servicesHint")}</p>
              <div className="flex flex-wrap gap-2">
                {[...new Set([...suggestions, ...services])].map((s) => {
                  const active = services.includes(s);
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() =>
                        setServices((prev) => (active ? prev.filter((x) => x !== s) : [...prev, s]))
                      }
                      className={`rounded-full border px-3.5 py-2 text-sm font-semibold ${
                        active
                          ? "border-primary bg-primary-soft text-accent-foreground"
                          : "border-border bg-card"
                      }`}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-2">
                <Input
                  value={customService}
                  onChange={(e) => setCustomService(e.target.value)}
                  className="h-11 rounded-xl"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 shrink-0 rounded-xl"
                  onClick={() => {
                    const v = customService.trim();
                    if (!v) return;
                    setServices((prev) => (prev.includes(v) ? prev : [...prev, v]));
                    setCustomService("");
                  }}
                >
                  {t("onb.addService")}
                </Button>
              </div>
            </div>
          ) : null}

          {step === 7 ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">{t("onb.customHint")}</p>
              {custom ? (
                <div className="flex items-center gap-3 rounded-xl border bg-card p-3 text-sm">
                  <span className="truncate font-semibold">{custom.fileName}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="ml-auto rounded-lg"
                    onClick={() => setCustom(null)}
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              ) : null}
              <label className="w-fit">
                <input
                  type="file"
                  accept="image/png,image/jpeg,application/pdf"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const isImage = file.type.startsWith("image/");
                    setCustom({
                      fileName: file.name,
                      fileType: file.type,
                      previewDataUrl: isImage ? await readFileAsDataUrl(file) : null,
                    });
                  }}
                />
                <span className="inline-flex h-11 cursor-pointer items-center rounded-xl border bg-card px-4 text-sm font-semibold">
                  {t("tpl.upload")}
                </span>
              </label>
            </div>
          ) : null}

          {step === 8 ? (
            <div className="grid gap-4">
              <dl className="grid gap-3 text-sm">
                {[
                  [
                    t("onb.type"),
                    type === "other" && customType.trim() ? customType.trim() : t(`type.${type}`),
                  ],
                  [t("onb.name"), name || "-"],
                  [t("onb.font"), fontSecondary ? `${fontFamily} + ${fontSecondary}` : fontFamily],
                  [t("onb.currency"), currency],
                  [
                    t("onb.language"),
                    LANGUAGES.find((l) => l.code === language)?.label ?? "English",
                  ],
                  [t("onb.services"), services.length ? services.join(", ") : "-"],
                  [t("onb.custom"), custom?.fileName ?? "-"],
                ].map(([k, v]) => (
                  <div key={k} className="flex gap-3 border-b pb-2 last:border-0">
                    <dt className="w-32 shrink-0 text-muted-foreground">{k}</dt>
                    <dd className="font-semibold">{v}</dd>
                  </div>
                ))}
              </dl>
              {submitting ? (
                <div className="flex items-center gap-2 rounded-xl border bg-primary-soft px-4 py-3 text-sm font-semibold text-primary">
                  <span className="size-2 animate-pulse rounded-full bg-primary" />
                  {SUBMIT_STEPS[submitStep]}
                </div>
              ) : null}
              {submitError ? (
                <p className="text-sm font-semibold text-destructive">{submitError}</p>
              ) : null}
            </div>
          ) : null}

          <div className="mt-2 flex gap-2">
            {step > 0 ? (
              <Button
                variant="outline"
                className="h-12 flex-1 rounded-xl"
                disabled={submitting}
                onClick={() => setStep((s) => s - 1)}
              >
                {t("onb.back")}
              </Button>
            ) : null}
            {step < STEP_KEYS.length - 1 ? (
              <Button
                className="h-12 flex-1 rounded-xl"
                disabled={!canNext}
                onClick={() => setStep((s) => s + 1)}
              >
                {t("onb.next")}
              </Button>
            ) : (
              <Button
                className="h-12 flex-1 rounded-xl"
                onClick={() => void submit()}
                disabled={!name.trim() || submitting}
              >
                {submitting ? SUBMIT_STEPS[submitStep] : t("onb.submit")}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
