import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { LogOut } from "lucide-react";
import { Logo } from "@/components/rafty/Logo";
import { useRafty } from "@/lib/rafty/store";
import * as repo from "@/lib/rafty/repo";
import {
  BUSINESS_TYPE_NAMES,
  PLAN_NAMES,
  PRICE_POINTS,
  partnershipPostsFor,
  tierForPrice,
} from "@/lib/rafty/constants";
import type {
  AccountPlan,
  Business,
  BusinessStatus,
  CustomTemplateRequest,
  Post,
  TrialUsage,
} from "@/lib/rafty/types";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin | krijo24" },
      { name: "description", content: "Platform administration." },
      { property: "og:title", content: "Admin | krijo24" },
      { property: "og:description", content: "Platform administration." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

const STATUSES: BusinessStatus[] = ["pending", "approved", "rejected", "suspended"];
const STATUS_FILTERS: (BusinessStatus | "all")[] = ["all", ...STATUSES];

function statusTone(status: BusinessStatus) {
  if (status === "approved") return "default" as const;
  if (status === "pending") return "secondary" as const;
  return "outline" as const;
}

function timeAgo(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${Math.max(mins, 0)}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

type Profile = { id: string; email: string; displayName: string };

function AdminPage() {
  const { ready, isAdmin, user, signOut } = useRafty();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [trials, setTrials] = useState<TrialUsage[]>([]);
  const [requests, setRequests] = useState<CustomTemplateRequest[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [plans, setPlans] = useState<AccountPlan[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [customTemplates, setCustomTemplates] = useState<
    { id: string; businessId: string; name: string; archived: boolean }[]
  >([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<BusinessStatus | "all">("all");
  const [loading, setLoading] = useState(false);
  const [openBusinessId, setOpenBusinessId] = useState<string | null>(null);
  const [attachRequest, setAttachRequest] = useState<CustomTemplateRequest | null>(null);

  // Every read below only returns rows for platform admins. Access is enforced
  // server side by RLS and is_super_admin(), this page never assumes a role.
  const load = useCallback(async () => {
    setLoading(true);
    const [b, tr, rq, ps, pl, pr, ct] = await Promise.all([
      repo.adminListBusinesses(),
      repo.adminListTrials(),
      repo.listRequests(),
      repo.adminListPosts(),
      repo.adminListPlans(),
      repo.adminListProfiles(),
      repo.adminListCustomTemplates(),
    ]);
    setBusinesses(b);
    setTrials(tr);
    setRequests(rq);
    setPosts(ps);
    setPlans(pl);
    setProfiles(pr);
    setCustomTemplates(ct);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (!isAdmin) {
      navigate({ to: "/create", replace: true });
      return;
    }
    void load();
  }, [ready, isAdmin, navigate, load]);

  const planFor = useCallback(
    (ownerUserId: string) => plans.find((p) => p.userId === ownerUserId) ?? null,
    [plans],
  );
  const trialFor = useCallback(
    (businessId: string) => trials.find((t) => t.businessId === businessId) ?? null,
    [trials],
  );
  const profileFor = useCallback(
    (ownerUserId: string) => profiles.find((p) => p.id === ownerUserId) ?? null,
    [profiles],
  );
  const postCount = useCallback(
    (businessId: string) => posts.filter((p) => p.businessId === businessId).length,
    [posts],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return businesses.filter((b) => {
      if (statusFilter !== "all" && b.status !== statusFilter) return false;
      if (!q) return true;
      const email = profiles.find((p) => p.id === b.ownerUserId)?.email ?? "";
      return (
        b.name.toLowerCase().includes(q) ||
        email.toLowerCase().includes(q) ||
        BUSINESS_TYPE_NAMES[b.type].toLowerCase().includes(q)
      );
    });
  }, [businesses, profiles, query, statusFilter]);

  async function setStatus(business: Business, status: BusinessStatus) {
    const price = planFor(business.ownerUserId)?.monthlyPrice ?? 100;
    const res =
      status === "approved"
        ? await repo.adminActivateAccount(business.id, price)
        : await repo.adminSetStatus(business.id, status);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success(
      status === "approved"
        ? `Approved and activated at ${price} €. Posts are now unlimited.`
        : `Status set to ${status}`,
    );
    await load();
  }

  /** Price is the entitlement source of truth, the database derives the rest. */
  async function setPlan(ownerUserId: string, monthlyPrice: number, active: boolean) {
    const { error } = await repo.adminSetPlan(ownerUserId, monthlyPrice, active);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success(active ? `Plan active at ${monthlyPrice} €` : "Plan saved, not active");
    await load();
  }

  if (!ready || !isAdmin) return <div className="page-bg min-h-screen" />;

  const byStatus = (status: BusinessStatus) => businesses.filter((b) => b.status === status).length;
  const activeAccounts = businesses.filter(
    (b) => b.status === "approved" && planFor(b.ownerUserId)?.active,
  );
  const paidPlans = plans.filter((p) => p.active);
  const monthlyRevenue = paidPlans.reduce((sum, p) => sum + p.monthlyPrice, 0);
  const tierCounts = (["starter", "growth", "studio", "partnership"] as const).map((tier) => ({
    tier,
    count: paidPlans.filter((p) => p.plan === tier).length,
  }));
  const typeCounts = Object.entries(
    businesses.reduce<Record<string, number>>((acc, b) => {
      const key = b.customType || BUSINESS_TYPE_NAMES[b.type];
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);

  const openBusiness = businesses.find((b) => b.id === openBusinessId) ?? null;

  return (
    <div className="page-bg min-h-screen">
      <header className="glass-panel sticky top-0 z-40 border-x-0 border-t-0">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link to="/">
            <Logo height={36} />
          </Link>
          <span className="rounded-lg bg-primary-soft px-2 py-1 text-xs font-bold">Admin</span>
          <p className="ml-auto truncate text-xs text-muted-foreground">{user?.email}</p>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-xl"
            aria-label="Sign out"
            onClick={async () => {
              await queryClient.cancelQueries();
              queryClient.clear();
              await signOut();
              navigate({ to: "/auth", replace: true });
            }}
          >
            <LogOut className="size-4" />
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <Tabs defaultValue="overview">
          <TabsList className="mb-5 flex h-auto w-full flex-wrap justify-start gap-1 rounded-xl bg-card p-1">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="accounts">Accounts</TabsTrigger>
            <TabsTrigger value="templates">Custom templates</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: "Active accounts", value: activeAccounts.length },
                { label: "Paid plans", value: paidPlans.length },
                { label: "Monthly revenue", value: `${monthlyRevenue} €` },
                { label: "New, not approved", value: byStatus("pending") },
                { label: "Brands", value: businesses.length },
                { label: "Posts created", value: posts.length },
                { label: "Custom templates", value: customTemplates.length },
                {
                  label: "Suspended or rejected",
                  value: byStatus("suspended") + byStatus("rejected"),
                },
              ].map((card) => (
                <div key={card.label} className="card-soft p-5">
                  <p className="text-sm text-muted-foreground">{card.label}</p>
                  <p className="font-display text-3xl font-extrabold">{card.value}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-3">
              <div className="card-soft p-5">
                <h2 className="mb-3 font-display text-lg font-extrabold">Plans</h2>
                <div className="grid gap-2 text-sm">
                  {tierCounts.map((row) => (
                    <div key={row.tier} className="flex justify-between gap-3">
                      <span className="text-muted-foreground">{PLAN_NAMES[row.tier]}</span>
                      <span className="font-semibold">{row.count}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card-soft p-5">
                <h2 className="mb-3 font-display text-lg font-extrabold">Business types</h2>
                <div className="grid gap-2 text-sm">
                  {typeCounts.map(([label, count]) => (
                    <div key={label} className="flex justify-between gap-3">
                      <span className="truncate text-muted-foreground">{label}</span>
                      <span className="font-semibold">{count}</span>
                    </div>
                  ))}
                  {typeCounts.length === 0 ? (
                    <p className="text-muted-foreground">No brands yet.</p>
                  ) : null}
                </div>
              </div>

              <div className="card-soft p-5">
                <h2 className="mb-3 font-display text-lg font-extrabold">Recent</h2>
                <div className="grid gap-2 text-sm">
                  {businesses.slice(0, 6).map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setOpenBusinessId(b.id)}
                      className="flex items-center gap-3 text-left"
                    >
                      <span className="min-w-0 flex-1 truncate font-semibold">{b.name}</span>
                      <Badge variant={statusTone(b.status)}>{b.status}</Badge>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {timeAgo(b.createdAt)}
                      </span>
                    </button>
                  ))}
                  {businesses.length === 0 ? (
                    <p className="text-muted-foreground">No brands yet.</p>
                  ) : null}
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="accounts">
            <div className="mb-4 flex flex-wrap gap-2">
              <Input
                placeholder="Search brand, email or type"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-11 max-w-sm rounded-xl bg-card"
              />
              <Select
                value={statusFilter}
                onValueChange={(v) => setStatusFilter(v as BusinessStatus | "all")}
              >
                <SelectTrigger className="h-11 w-40 rounded-xl bg-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_FILTERS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s === "all" ? "All statuses" : s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {loading ? (
                <span className="self-center text-xs text-muted-foreground">Loading...</span>
              ) : null}
            </div>

            <div className="grid gap-3">
              {filtered.map((b) => {
                const plan = planFor(b.ownerUserId);
                const profile = profileFor(b.ownerUserId);
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setOpenBusinessId(b.id)}
                    className="card-soft flex flex-wrap items-center gap-3 p-4 text-left transition hover:border-primary/40"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold">{b.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {profile?.email || "unknown account"} ·{" "}
                        {b.customType || BUSINESS_TYPE_NAMES[b.type]} · {postCount(b.id)} posts
                      </p>
                    </div>
                    <Badge variant={plan?.active ? "default" : "outline"}>
                      {plan?.active ? `${plan.monthlyPrice} € active` : "no active plan"}
                    </Badge>
                    <Badge variant={statusTone(b.status)}>{b.status}</Badge>
                  </button>
                );
              })}
              {filtered.length === 0 ? (
                <p className="text-sm text-muted-foreground">No accounts match this search.</p>
              ) : null}
            </div>
          </TabsContent>

          <TabsContent value="templates">
            <div className="grid gap-3">
              {requests.map((r) => {
                const business = businesses.find((b) => b.id === r.businessId);
                return (
                  <div key={r.id} className="card-soft flex flex-wrap items-center gap-3 p-4">
                    {r.previewDataUrl ? (
                      <img
                        src={r.previewDataUrl}
                        alt=""
                        className="size-14 rounded-lg object-cover"
                      />
                    ) : null}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold">{r.fileName}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {business?.name || r.businessName || "Unknown brand"} · {timeAgo(r.createdAt)}
                      </p>
                    </div>
                    <Badge variant={r.templateId ? "default" : "secondary"}>
                      {r.templateId ? "connected" : r.status}
                    </Badge>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="rounded-xl"
                        disabled={!!r.templateId}
                        onClick={() => setAttachRequest(r)}
                      >
                        Connect to account
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-xl"
                        onClick={async () => {
                          await repo.updateRequest(r.id, { status: "rejected" });
                          if (r.templateId) await repo.archiveTemplate(r.templateId);
                          await load();
                        }}
                      >
                        Reject
                      </Button>
                    </div>
                  </div>
                );
              })}
              {requests.length === 0 ? (
                <p className="text-sm text-muted-foreground">No uploaded designs waiting.</p>
              ) : null}
            </div>

            <h2 className="mb-3 mt-8 font-display text-lg font-extrabold">
              Live custom templates
            </h2>
            <div className="grid gap-2">
              {customTemplates.map((tpl) => {
                const business = businesses.find((b) => b.id === tpl.businessId);
                return (
                  <div
                    key={tpl.id}
                    className="card-soft flex flex-wrap items-center gap-3 px-4 py-3 text-sm"
                  >
                    <span className="min-w-0 flex-1 truncate font-semibold">{tpl.name}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {business?.name ?? "unknown brand"}
                    </span>
                    {tpl.archived ? (
                      <Badge variant="outline">archived</Badge>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-xl"
                        onClick={async () => {
                          await repo.archiveTemplate(tpl.id);
                          await load();
                        }}
                      >
                        Archive
                      </Button>
                    )}
                  </div>
                );
              })}
              {customTemplates.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No custom templates connected yet. Each one belongs to a single brand.
                </p>
              ) : null}
            </div>
          </TabsContent>
        </Tabs>
      </main>

      <AccountDialog
        business={openBusiness}
        plan={openBusiness ? planFor(openBusiness.ownerUserId) : null}
        profile={openBusiness ? profileFor(openBusiness.ownerUserId) : null}
        trial={openBusiness ? trialFor(openBusiness.id) : null}
        posts={openBusiness ? postCount(openBusiness.id) : 0}
        templates={
          openBusiness ? customTemplates.filter((t) => t.businessId === openBusiness.id).length : 0
        }
        onClose={() => setOpenBusinessId(null)}
        onStatus={setStatus}
        onPlan={setPlan}
      />

      <AttachTemplateDialog
        request={attachRequest}
        businessName={
          businesses.find((b) => b.id === attachRequest?.businessId)?.name ||
          attachRequest?.businessName ||
          ""
        }
        onClose={() => setAttachRequest(null)}
        onDone={async () => {
          setAttachRequest(null);
          await load();
        }}
      />
    </div>
  );
}

/** One brand, its account and its plan in a single manageable view. */
function AccountDialog({
  business,
  plan,
  profile,
  trial,
  posts,
  templates,
  onClose,
  onStatus,
  onPlan,
}: {
  business: Business | null;
  plan: AccountPlan | null;
  profile: Profile | null;
  trial: TrialUsage | null;
  posts: number;
  templates: number;
  onClose: () => void;
  onStatus: (business: Business, status: BusinessStatus) => Promise<void>;
  onPlan: (ownerUserId: string, monthlyPrice: number, active: boolean) => Promise<void>;
}) {
  if (!business) return null;
  const price = plan?.monthlyPrice ?? 100;
  const active = plan?.active ?? false;
  const liveForCustomer = business.status === "approved" && active;

  return (
    <Dialog open onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="truncate">{business.name}</DialogTitle>
          <DialogDescription className="truncate">
            {profile?.email || "unknown account"} ·{" "}
            {business.customType || BUSINESS_TYPE_NAMES[business.type]}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div
            className={`rounded-xl border p-3 text-sm font-semibold ${
              liveForCustomer
                ? "border-primary/40 bg-primary-soft"
                : "border-amber-400/60 bg-amber-50 text-amber-800"
            }`}
          >
            {liveForCustomer
              ? "Live: unlimited posts on this plan."
              : "Not live yet: the customer stays on the free trial allowance until the brand is approved and the plan is active."}
          </div>

          <div className="grid grid-cols-2 gap-2 text-sm">
            <Stat label="Status" value={business.status} />
            <Stat label="Onboarded" value={business.onboarded ? "yes" : "no"} />
            <Stat label="Posts" value={String(posts)} />
            <Stat label="Custom templates" value={String(templates)} />
            <Stat
              label="Trial usage"
              value={`${trial?.postsCreated ?? 0}/${trial?.freePostLimit ?? 1}`}
            />
            <Stat label="Joined" value={new Date(business.createdAt).toLocaleDateString()} />
          </div>

          <div className="grid gap-2">
            <p className="text-sm font-bold">Plan</p>
            <Select
              value={String(price)}
              onValueChange={(v) => void onPlan(business.ownerUserId, Number(v), active)}
            >
              <SelectTrigger className="h-11 rounded-xl bg-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRICE_POINTS.map((p) => (
                  <SelectItem key={p} value={String(p)}>
                    {p} € · {PLAN_NAMES[tierForPrice(p)]}
                    {partnershipPostsFor(p) > 0 ? ` · ${partnershipPostsFor(p)} posts` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {active ? "Plan active" : "Plan not active"}
                {plan ? ` · brand limit ${plan.brandLimit}` : ""}
              </span>
              <Switch
                className="ml-auto"
                checked={active}
                onCheckedChange={(v) => void onPlan(business.ownerUserId, price, v)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Carousel {plan?.allowCarousel ? "on" : "off"} · Video {plan?.allowVideo ? "on" : "off"}
            </p>
          </div>

          <div className="grid gap-2">
            <p className="text-sm font-bold">Brand status</p>
            {business.status !== "approved" ? (
              <Button
                className="h-11 rounded-xl"
                onClick={() => void onStatus(business, "approved")}
              >
                Approve and activate at {price} €
              </Button>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {STATUSES.filter((s) => s !== business.status && s !== "approved").map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => void onStatus(business, s)}
                >
                  Set {s}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="truncate font-semibold">{value}</p>
    </div>
  );
}

/** Connects one uploaded design to the brand that uploaded it, nobody else. */
function AttachTemplateDialog({
  request,
  businessName,
  onClose,
  onDone,
}: {
  request: CustomTemplateRequest | null;
  businessName: string;
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(request ? request.fileName.replace(/\.[a-z0-9]+$/i, "") : "");
  }, [request]);

  if (!request) return null;

  return (
    <Dialog open onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Connect template</DialogTitle>
          <DialogDescription>
            This design becomes a private template for {businessName || "this brand"} only.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          {request.previewDataUrl ? (
            <div className="aspect-[4/5] w-32 overflow-hidden rounded-xl border bg-muted">
              <img src={request.previewDataUrl} alt="" className="size-full object-cover" />
            </div>
          ) : null}
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Template name"
            className="h-11 rounded-xl"
          />
          <Button
            className="h-11 rounded-xl"
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              const res = await repo.adminAttachTemplateToBusiness({
                requestId: request.id,
                businessId: request.businessId,
                filePath: request.filePath,
                name: name.trim() || request.fileName,
              });
              setSaving(false);
              if (res.error) {
                toast.error(res.error);
                return;
              }
              toast.success("Template connected to that account.");
              await onDone();
            }}
          >
            {saving ? "Connecting..." : "Connect to this account"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
