import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Globe, Instagram, Loader2, RefreshCw, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/rafty/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PostCanvas } from "@/components/rafty/PostCanvas";
import { useRafty } from "@/lib/rafty/store";
import * as repo from "@/lib/rafty/repo";
import { renderNodeToDataUrl } from "@/lib/rafty/download";
import { FORMAT_SPECS } from "@/lib/rafty/constants";
import { scanBrandWebsite } from "@/lib/scan.functions";
import { startMetaConnect, disconnectSocial, publishingAvailable } from "@/lib/social.functions";
import type {
  BrandWebsite,
  DiscoveredItem,
  ScheduledPost,
  SocialConnection,
  SocialPlatform,
} from "@/lib/rafty/types";

export const Route = createFileRoute("/_authenticated/website")({
  validateSearch: (search: Record<string, unknown>): { connect?: string } =>
    typeof search["connect"] === "string" ? { connect: search["connect"] } : {},
  head: () => ({
    meta: [
      { title: "Website & auto-posting | krijo24" },
      {
        name: "description",
        content:
          "Scan your own website for offers and products, turn them into branded posts and publish them automatically.",
      },
      { property: "og:title", content: "Website & auto-posting | krijo24" },
      {
        property: "og:description",
        content: "krijo24 reads your website and prepares branded posts for you.",
      },
    ],
  }),
  component: () => (
    <AppShell>
      <WebsitePage />
    </AppShell>
  ),
});

const AUTO_PLATFORMS: SocialPlatform[] = ["instagram", "facebook"];

const CONNECT_MESSAGE: Record<string, { ok: boolean; text: string }> = {
  connected: { ok: true, text: "Your Instagram and Facebook page are connected." },
  cancelled: { ok: false, text: "The connection was cancelled." },
  expired: { ok: false, text: "That connection link expired. Please try again." },
  denied: { ok: false, text: "That connection could not be verified." },
  failed: { ok: false, text: "The connection failed. Please try again." },
};

function WebsitePage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { business, brand, templates, plan, posts, refresh } = useRafty();

  const scan = useServerFn(scanBrandWebsite);
  const connect = useServerFn(startMetaConnect);
  const disconnect = useServerFn(disconnectSocial);
  const checkAvailable = useServerFn(publishingAvailable);

  const [site, setSite] = useState<BrandWebsite | null>(null);
  const [items, setItems] = useState<DiscoveredItem[]>([]);
  const [connections, setConnections] = useState<SocialConnection[]>([]);
  const [schedules, setSchedules] = useState<ScheduledPost[]>([]);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!business) return;
    const [website, discovered, conns, queue] = await Promise.all([
      repo.getWebsite(business.id),
      repo.listDiscovered(business.id),
      repo.listConnections(business.id),
      repo.listSchedules(business.id),
    ]);
    setSite(website);
    setItems(discovered);
    setConnections(conns);
    setSchedules(queue);
  }, [business]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void checkAvailable({}).then((res) => setAvailable(res.available));
  }, [checkAvailable]);

  useEffect(() => {
    if (!search.connect) return;
    const message = CONNECT_MESSAGE[search.connect];
    if (message?.ok) toast.success(message.text);
    else toast.error(message?.text ?? "The connection did not complete.");
    void load();
    navigate({ to: "/website", search: {}, replace: true });
  }, [search.connect, load, navigate]);

  const patch = useCallback(
    async (next: Partial<BrandWebsite>) => {
      if (!business || !site) return;
      setSite({ ...site, ...next });
      const res = await repo.saveWebsite(business.id, next);
      if (res.error) toast.error("That change could not be saved.");
    },
    [business, site],
  );

  async function runScan() {
    if (!business || !site?.url.trim()) {
      toast.error("Add your website address first.");
      return;
    }
    setScanning(true);
    const res = await scan({ data: { businessId: business.id, url: site.url.trim() } });
    setScanning(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(
      res.found === 0
        ? "Nothing readable was found on that page."
        : `${res.found} item(s) read, ${res.added} new.`,
    );
    void load();
  }

  async function startConnect() {
    if (!business) return;
    setBusy(true);
    const res = await connect({ data: { businessId: business.id } });
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    window.location.href = res.url;
  }

  const connected = connections.filter((c) => c.status === "connected" || c.status === "ready");
  const canAutoPublish = business?.status === "approved" && !!plan?.active;

  if (!business || !brand || !site) return null;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <div>
        <h1 className="font-display text-2xl font-extrabold">Website & auto-posting</h1>
        <p className="text-sm text-muted-foreground">
          krijo24 reads your own website, turns each offer into a branded post and can publish it
          for you.
        </p>
      </div>

      <section className="card-soft grid gap-3 p-4">
        <div className="flex items-center gap-2">
          <Globe className="size-4 text-muted-foreground" />
          <p className="text-sm font-bold">Your website</p>
          {site.lastScannedAt ? (
            <Badge variant="outline" className="ml-auto text-[10px]">
              Last scan {new Date(site.lastScannedAt).toLocaleDateString()}
            </Badge>
          ) : null}
        </div>
        <div className="grid gap-1">
          <Label htmlFor="site-url" className="text-xs">
            Page with your products or offers
          </Label>
          <Input
            id="site-url"
            value={site.url}
            maxLength={500}
            placeholder="https://yourbusiness.com/offers"
            className="h-11 rounded-xl"
            onChange={(e) => setSite({ ...site, url: e.target.value })}
            onBlur={() => void patch({ url: site.url })}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button className="rounded-xl" disabled={scanning} onClick={() => void runScan()}>
            {scanning ? (
              <Loader2 className="mr-1 size-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-1 size-4" />
            )}
            {scanning ? "Reading your site..." : "Scan now"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Only public pages of your own website are read, and only when robots.txt allows it.
        </p>
      </section>

      <section className="card-soft grid gap-3 p-4">
        <p className="text-sm font-bold">Automatic posts</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1">
            <Label className="text-xs">Scan the site</Label>
            <Select
              value={site.scanFrequency}
              onValueChange={(v) => void patch({ scanFrequency: v as BrandWebsite["scanFrequency"] })}
            >
              <SelectTrigger className="h-11 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="off">Only when I press scan</SelectItem>
                <SelectItem value="daily">Every day</SelectItem>
                <SelectItem value="weekly">Every week</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1">
            <Label className="text-xs">With new items</Label>
            <Select
              value={site.autoMode}
              onValueChange={(v) => void patch({ autoMode: v as BrandWebsite["autoMode"] })}
            >
              <SelectTrigger className="h-11 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="off">Just list them for me</SelectItem>
                <SelectItem value="draft">Create posts I can review</SelectItem>
                <SelectItem value="publish" disabled={!canAutoPublish || connected.length === 0}>
                  Create and publish automatically
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1">
            <Label className="text-xs">Template used</Label>
            <Select
              value={site.defaultTemplateId ?? ""}
              onValueChange={(v) => void patch({ defaultTemplateId: v })}
            >
              <SelectTrigger className="h-11 rounded-xl">
                <SelectValue placeholder="Choose a template" />
              </SelectTrigger>
              <SelectContent>
                {templates.slice(0, 40).map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1">
            <Label htmlFor="post-time" className="text-xs">
              Posting time
            </Label>
            <Input
              id="post-time"
              type="time"
              value={site.postTime}
              className="h-11 rounded-xl"
              onChange={(e) => void patch({ postTime: e.target.value })}
            />
          </div>
        </div>
        <div className="grid gap-2">
          <Label className="text-xs">Publish to</Label>
          {AUTO_PLATFORMS.map((platform) => (
            <label
              key={platform}
              className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
            >
              <Switch
                checked={site.platforms.includes(platform)}
                onCheckedChange={(checked) =>
                  void patch({
                    platforms: checked
                      ? [...site.platforms, platform]
                      : site.platforms.filter((p) => p !== platform),
                  })
                }
              />
              <span className="text-sm font-semibold capitalize">{platform}</span>
            </label>
          ))}
        </div>
        {!canAutoPublish ? (
          <p className="text-xs text-muted-foreground">
            Automatic publishing unlocks once your brand is approved and your plan is active.
          </p>
        ) : null}
      </section>

      <section className="card-soft grid gap-3 p-4">
        <div className="flex items-center gap-2">
          <Instagram className="size-4 text-muted-foreground" />
          <p className="text-sm font-bold">Publishing connection</p>
          <Badge variant={connected.length ? "default" : "outline"} className="ml-auto text-[10px]">
            {connected.length ? "Connected" : "Not connected"}
          </Badge>
        </div>
        {available === false ? (
          <p className="text-sm text-muted-foreground">
            Direct publishing is not switched on for this krijo24 installation yet. Write to
            contact@webdoagency.com and we will activate it for your account.
          </p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              Connect the Facebook page that owns your Instagram business account. krijo24 only
              posts what you approve, and you can disconnect at any time.
            </p>
            {connected.length ? (
              <div className="grid gap-2">
                {connected.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center gap-2 rounded-xl border border-border bg-card p-3"
                  >
                    <span className="text-sm font-semibold capitalize">{c.platform}</span>
                    <span className="truncate text-xs text-muted-foreground">{c.accountLabel}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-auto rounded-lg"
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);
                        await disconnect({
                          data: {
                            businessId: business.id,
                            platform: c.platform as "instagram" | "facebook",
                          },
                        });
                        setBusy(false);
                        void load();
                      }}
                    >
                      Disconnect
                    </Button>
                  </div>
                ))}
              </div>
            ) : null}
            <Button
              variant={connected.length ? "outline" : "default"}
              className="rounded-xl"
              disabled={busy}
              onClick={() => void startConnect()}
            >
              {connected.length ? "Reconnect" : "Connect Instagram & Facebook"}
            </Button>
          </>
        )}
      </section>

      <RenderBooth
        businessId={business.id}
        posts={posts}
        schedules={schedules}
        onDone={() => void refresh()}
      />

      <section className="card-soft grid gap-3 p-4">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-muted-foreground" />
          <p className="text-sm font-bold">Found on your website</p>
          <Badge variant="outline" className="ml-auto text-[10px]">
            {items.filter((i) => i.status === "new").length} new
          </Badge>
        </div>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing yet. Add your website address and press Scan now.
          </p>
        ) : (
          <ul className="grid gap-2">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
              >
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt=""
                    loading="lazy"
                    className="size-14 shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <div className="size-14 shrink-0 rounded-lg bg-muted" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{item.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {[item.price ? `${item.price} ${item.currency || ""}`.trim() : "", item.sourceUrl]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {item.status === "new" ? (
                    <Button
                      size="sm"
                      className="rounded-lg"
                      onClick={() =>
                        navigate({
                          to: "/create",
                          search: {
                            item: item.id,
                            ...(site.defaultTemplateId
                              ? { template: site.defaultTemplateId }
                              : {}),
                          },
                        })
                      }
                    >
                      Make post
                    </Button>
                  ) : (
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {item.status}
                    </Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-lg"
                    aria-label="Remove item"
                    onClick={async () => {
                      await repo.removeDiscovered(item.id);
                      void load();
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/**
 * Publishing sends the exact rendered image, and rendering can only happen in a
 * browser. Any queued post that has no stored image yet is rendered here, once,
 * off screen, using the same export path as download and share.
 */
function RenderBooth({
  businessId,
  posts,
  schedules,
  onDone,
}: {
  businessId: string;
  posts: repo.PostWithContact[];
  schedules: ScheduledPost[];
  onDone: () => void;
}) {
  const { brand, business, templates } = useRafty();
  const [pending, setPending] = useState<repo.PostWithContact[]>([]);
  const [working, setWorking] = useState(false);
  const nodes = useRef<Record<string, HTMLDivElement | null>>({});
  const handled = useRef<Set<string>>(new Set());

  const queuedIds = useMemo(
    () => new Set(schedules.filter((s) => s.status === "queued").map((s) => s.postId)),
    [schedules],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const missing = await repo.listPostsMissingRender(businessId);
      if (cancelled) return;
      setPending(
        posts.filter(
          (post) => queuedIds.has(post.id) && missing.includes(post.id) && !handled.current.has(post.id),
        ),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [businessId, posts, queuedIds]);

  useEffect(() => {
    if (!pending.length || working || !brand || !business) return;
    setWorking(true);
    void (async () => {
      for (const post of pending) {
        const node = nodes.current[post.id];
        if (!node) continue;
        try {
          const spec = FORMAT_SPECS[post.format ?? "post"];
          const dataUrl = await renderNodeToDataUrl(node, {
            width: spec.width,
            height: spec.height,
          });
          await repo.savePostRender(businessId, post.id, dataUrl);
          handled.current.add(post.id);
        } catch {
          // A failed render simply stays pending; the queue reports it clearly.
        }
      }
      setWorking(false);
      setPending([]);
      onDone();
    })();
  }, [pending, working, brand, business, businessId, onDone]);

  if (!pending.length || !brand || !business) return null;

  return (
    <>
      <section className="card-soft flex items-center gap-2 p-4">
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Preparing {pending.length} scheduled post{pending.length === 1 ? "" : "s"} for publishing...
        </p>
      </section>
      <div aria-hidden className="pointer-events-none fixed -left-[3000px] top-0 w-[1080px]">
        {pending.map((post) => {
          const template = templates.find((tpl) => tpl.id === post.templateId);
          if (!template) return null;
          return (
            <PostCanvas
              key={post.id}
              ref={(node) => {
                nodes.current[post.id] = node;
              }}
              template={template}
              content={post.content}
              brand={brand}
              businessName={business.name}
              businessType={business.type}
              showBrandName={post.showBrandName}
              showContact={post.showContact ?? false}
              adjustments={post.adjustments}
              format={post.format ?? "post"}
            />
          );
        })}
      </div>
    </>
  );
}
