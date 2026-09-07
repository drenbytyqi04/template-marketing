import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Facebook, Instagram, Linkedin, LogOut, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/rafty/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRafty } from "@/lib/rafty/store";
import * as repo from "@/lib/rafty/repo";
import { CURRENCIES, LANGUAGES, SOCIAL_PLATFORMS } from "@/lib/rafty/constants";
import type {
  CurrencyCode,
  LanguageCode,
  SocialConnection,
  SocialPlatform,
} from "@/lib/rafty/types";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Account settings | krijo24" },
      {
        name: "description",
        content: "Your krijo24 account: plan, brands, language, social connections and support.",
      },
      { property: "og:title", content: "Account settings | krijo24" },
      { property: "og:description", content: "Manage your krijo24 account, plan and connections." },
    ],
  }),
  component: () => (
    <AppShell>
      <SettingsPage />
    </AppShell>
  ),
});

const PLATFORM_ICON: Record<string, typeof Instagram> = {
  instagram: Instagram,
  facebook: Facebook,
  linkedin: Linkedin,
};

function SettingsPage() {
  const {
    user,
    business,
    brand,
    brands,
    plan,
    brandSlotsLeft,
    language,
    setLanguage,
    saveBrand,
    isAdmin,
    signOut,
  } = useRafty();
  const [connections, setConnections] = useState<SocialConnection[]>([]);
  const [labels, setLabels] = useState<Partial<Record<SocialPlatform, string>>>({});
  const [savingPlatform, setSavingPlatform] = useState<SocialPlatform | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  const load = useCallback(async () => {
    if (!business) return;
    const rows = await repo.listConnections(business.id);
    setConnections(rows);
    setLabels(Object.fromEntries(rows.map((r) => [r.platform, r.accountLabel])));
  }, [business]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!user || !business) return null;

  async function saveLabel(platform: SocialPlatform) {
    if (savingPlatform) return;
    setSavingPlatform(platform);
    const res = await repo.saveConnectionLabel(
      business!.id,
      platform,
      (labels[platform] ?? "").trim(),
    );
    setSavingPlatform(null);
    if (res.error) {
      toast.error("Could not save that handle.");
      return;
    }
    toast.success("Handle saved.");
    void load();
  }

  const planLabel = plan
    ? `${plan.plan.charAt(0).toUpperCase()}${plan.plan.slice(1)} · ${plan.monthlyPrice}€ / ${plan.billingCycle}`
    : "No plan yet";

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <div>
        <h1 className="font-display text-2xl font-extrabold">Account settings</h1>
        <p className="text-sm text-muted-foreground">
          Your account, plan and connections. Brand content settings live in{" "}
          <Link to="/brand" className="font-semibold text-foreground hover:underline">
            Brand
          </Link>
          .
        </p>
      </div>

      <section className="card-soft grid gap-3 p-4">
        <p className="text-sm font-bold">Account</p>
        <div className="grid gap-1 text-sm">
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">Name</span>
            <span className="truncate font-semibold">{user.name || "—"}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">Email</span>
            <span className="truncate font-semibold">{user.email}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">Role</span>
            <span className="font-semibold">{isAdmin ? "Platform admin" : "Business user"}</span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Passwords and email changes are handled by our secure sign-in provider. Contact support to
          change your account email.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="rounded-xl"
            disabled={signingOut}
            onClick={async () => {
              setSigningOut(true);
              await signOut();
            }}
          >
            <LogOut className="mr-1 size-4" />
            {signingOut ? "Signing out..." : "Sign out"}
          </Button>
          {isAdmin ? (
            <Button asChild variant="outline" className="rounded-xl">
              <Link to="/admin">
                <ShieldCheck className="mr-1 size-4" />
                Admin
              </Link>
            </Button>
          ) : null}
        </div>
      </section>

      <section className="card-soft grid gap-3 p-4">
        <div className="flex items-center gap-2">
          <p className="text-sm font-bold">Plan</p>
          <Badge variant={plan?.active ? "default" : "outline"} className="ml-auto">
            {plan?.active ? "Active" : "Awaiting activation"}
          </Badge>
        </div>
        <p className="text-sm font-semibold">{planLabel}</p>
        <div className="grid gap-1 text-sm text-muted-foreground">
          <p>
            Brands: {brands.length} of {plan?.brandLimit ?? 1} used ({brandSlotsLeft} left)
          </p>
          <p>Carousel: {plan?.allowCarousel ? "included" : "not included"}</p>
          <p>Video: {plan?.allowVideo ? "included" : "not included"}</p>
          {plan && plan.partnershipPostsLimit > 0 ? (
            <p>
              Partnership posts: {plan.partnershipPostsUsed} of {plan.partnershipPostsLimit} this
              month
            </p>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">
          Plans are managed by the krijo24 team. Write to{" "}
          <a
            href="mailto:contact@webdoagency.com"
            className="font-semibold text-foreground hover:underline"
          >
            contact@webdoagency.com
          </a>{" "}
          to change your plan.
        </p>
      </section>

      <section className="card-soft grid gap-3 p-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <p className="text-sm font-bold">Language</p>
          <Select value={language} onValueChange={(v) => setLanguage(v as LanguageCode)}>
            <SelectTrigger className="h-11 rounded-xl">
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
        {brand ? (
          <div className="grid gap-1.5">
            <p className="text-sm font-bold">Currency on posts</p>
            <Select
              value={brand.currency}
              onValueChange={(v) => void saveBrand({ currency: v as CurrencyCode })}
            >
              <SelectTrigger className="h-11 rounded-xl">
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
          </div>
        ) : null}
      </section>

      <section className="card-soft grid gap-3 p-4">
        <p className="text-sm font-bold">Social connections</p>
        <p className="text-xs text-muted-foreground">
          Direct publishing is not connected yet, so nothing is ever posted for you. Save the handle
          you want used and we will activate publishing for it once the connection is approved.
        </p>
        {SOCIAL_PLATFORMS.map(({ platform, label, note, available }) => {
          const Icon = PLATFORM_ICON[platform] ?? Instagram;
          const row = connections.find((c) => c.platform === platform);
          return (
            <div key={platform} className="grid gap-2 rounded-xl border border-border bg-card p-3">
              <div className="flex items-center gap-2">
                <Icon className="size-4 text-muted-foreground" />
                <p className="text-sm font-semibold">{label}</p>
                <Badge variant="outline" className="ml-auto text-[10px]">
                  {available ? (row?.status ?? "not connected") : "Connect when available"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">{note}</p>
              <div className="flex gap-2">
                <div className="grid flex-1 gap-1">
                  <Label htmlFor={`handle-${platform}`} className="text-xs">
                    Account or page
                  </Label>
                  <Input
                    id={`handle-${platform}`}
                    value={labels[platform] ?? ""}
                    maxLength={80}
                    onChange={(e) => setLabels((prev) => ({ ...prev, [platform]: e.target.value }))}
                    placeholder="@yourbusiness"
                    className="h-10 rounded-xl"
                  />
                </div>
                <Button
                  variant="outline"
                  className="mt-auto h-10 shrink-0 rounded-xl"
                  disabled={savingPlatform === platform}
                  onClick={() => void saveLabel(platform)}
                >
                  {savingPlatform === platform ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>
          );
        })}
      </section>

      <section className="card-soft grid gap-2 p-4">
        <p className="text-sm font-bold">Support</p>
        <p className="text-sm text-muted-foreground">
          Questions, custom templates or plan changes:{" "}
          <a
            href="mailto:contact@webdoagency.com"
            className="font-semibold text-foreground hover:underline"
          >
            contact@webdoagency.com
          </a>
        </p>
      </section>
    </div>
  );
}
