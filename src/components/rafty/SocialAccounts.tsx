import { useCallback, useEffect, useState } from "react";
import { Instagram, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  disconnectSocial,
  listPublications,
  listSocialAccounts,
  publishingAvailable,
  startMetaConnect,
} from "@/lib/social.functions";

type Publication = {
  id: string;
  platform: string;
  account_label: string;
  caption: string;
  status: string;
  error_message: string | null;
  published_at: string | null;
  created_at: string;
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Queued",
  publishing: "Publishing",
  published: "Published",
  failed: "Failed",
};

type Account = {
  id: string;
  platform: "instagram" | "facebook";
  label: string;
  username: string;
  profilePictureUrl: string | null;
  needsReconnect: boolean;
};

/**
 * Connecting and disconnecting Instagram, in one place.
 *
 * Connection used to live on the Website page while Settings offered a text box
 * for a handle and a note saying publishing was not connected - so the screen
 * called Social connections was the one screen that could not connect anything.
 * This is the single surface for it, and what it shows is the real state of the
 * stored accounts rather than a label someone typed.
 */
export function SocialAccounts({ businessId }: { businessId: string }) {
  const loadAccounts = useServerFn(listSocialAccounts);
  const checkAvailable = useServerFn(publishingAvailable);
  const connect = useServerFn(startMetaConnect);
  const disconnect = useServerFn(disconnectSocial);
  const loadHistory = useServerFn(listPublications);

  const [available, setAvailable] = useState<boolean | null>(null);
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState<Account | null>(null);
  const [history, setHistory] = useState<Publication[]>([]);

  const load = useCallback(async () => {
    const [config, list, published] = await Promise.all([
      checkAvailable({}).catch(() => ({ available: false })),
      loadAccounts({ data: { businessId } }).catch(() => ({ accounts: [] })),
      loadHistory({ data: { businessId } }).catch(() => ({ publications: [] })),
    ]);
    setAvailable(config.available);
    setAccounts(list.accounts.filter((a): a is Account => a.platform === "instagram"));
    setHistory((published.publications as Publication[]).filter((p) => p.platform === "instagram"));
  }, [businessId, checkAvailable, loadAccounts, loadHistory]);

  useEffect(() => {
    void load();
  }, [load]);

  async function beginConnect() {
    setBusy(true);
    try {
      const res = await connect({ data: { businessId } });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      // Meta's consent screen is a full page, not a popup: leaving and coming
      // back through the callback is the whole flow.
      window.location.href = res.url;
    } catch {
      toast.error("Could not start the Instagram connection.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmDisconnect() {
    const account = confirming;
    if (!account) return;
    setConfirming(null);
    setBusy(true);
    try {
      await disconnect({ data: { businessId, platform: "instagram", accountId: account.id } });
      toast.success(`${account.label} disconnected.`);
      await load();
    } catch {
      toast.error("Could not disconnect that account.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card-soft grid gap-3 p-4">
      <div className="flex items-center gap-2">
        <Instagram className="size-4 text-muted-foreground" aria-hidden />
        <p className="text-sm font-bold">Instagram</p>
      </div>
      <p className="text-xs text-muted-foreground">
        Connect an Instagram Professional account and publish your designs to it directly.
      </p>

      {available === false ? (
        <p className="rounded-xl border border-dashed bg-muted/40 p-3 text-xs text-muted-foreground">
          Instagram publishing is not configured on this installation yet.
        </p>
      ) : accounts === null ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
          Loading...
        </p>
      ) : accounts.length === 0 ? (
        <Button className="h-11 rounded-xl" disabled={busy} onClick={() => void beginConnect()}>
          {busy ? <Loader2 className="mr-1.5 size-4 animate-spin" aria-hidden /> : null}
          Connect Instagram
        </Button>
      ) : (
        <div className="grid gap-2">
          {accounts.map((account) => (
            <div
              key={account.id}
              className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
            >
              {account.profilePictureUrl ? (
                <img
                  src={account.profilePictureUrl}
                  alt=""
                  className="size-9 shrink-0 rounded-full object-cover"
                />
              ) : (
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
                  <Instagram className="size-4 text-muted-foreground" aria-hidden />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{account.label}</p>
                <p className="text-xs text-muted-foreground">Instagram Professional</p>
              </div>
              <Badge
                variant="outline"
                className={`text-[10px] ${account.needsReconnect ? "text-destructive" : ""}`}
              >
                {account.needsReconnect ? "Needs reconnecting" : "Connected"}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0 rounded-lg"
                disabled={busy}
                onClick={() => setConfirming(account)}
              >
                Disconnect
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            className="h-10 rounded-xl"
            disabled={busy}
            onClick={() => void beginConnect()}
          >
            Connect another account
          </Button>
        </div>
      )}

      {history.length ? (
        <div className="grid gap-2 border-t pt-3">
          <p className="text-xs font-semibold">Recent Instagram posts</p>
          {history.slice(0, 8).map((item) => (
            <div
              key={item.id}
              className="grid gap-0.5 rounded-xl border border-border bg-card p-2.5"
            >
              <div className="flex items-center gap-2">
                <p className="truncate text-xs font-semibold">{item.account_label}</p>
                <Badge
                  variant="outline"
                  className={`ml-auto shrink-0 text-[10px] ${
                    item.status === "failed" ? "text-destructive" : ""
                  }`}
                >
                  {STATUS_LABEL[item.status] ?? item.status}
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {new Date(item.published_at ?? item.created_at).toLocaleDateString()}
              </p>
              {item.caption ? (
                <p className="line-clamp-2 text-[11px] text-muted-foreground">{item.caption}</p>
              ) : null}
              {/* The stored reason is for support, not for the person: what they
                  can act on is that it failed and can be tried again. */}
              {item.status === "failed" ? (
                <p className="text-[11px] text-destructive">
                  This one did not go out. Open the post and publish it again.
                </p>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      <AlertDialog open={!!confirming} onOpenChange={(open) => !open && setConfirming(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect Instagram?</AlertDialogTitle>
            <AlertDialogDescription>
              You will not be able to publish to {confirming?.label} until you reconnect it. Posts
              already published stay in your history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction className="rounded-xl" onClick={() => void confirmDisconnect()}>
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
