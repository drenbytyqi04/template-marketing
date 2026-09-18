import { useCallback, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { CheckCircle2, ExternalLink, Instagram, Loader2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { listSocialAccounts, publishNow } from "@/lib/social.functions";

/** Instagram's own limit. Shown rather than enforced silently, so a long
 * caption is the writer's decision and not a surprise truncation. */
const CAPTION_MAX = 2200;

type Account = {
  id: string;
  platform: "instagram" | "facebook";
  label: string;
  username: string;
  profilePictureUrl: string | null;
  needsReconnect: boolean;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessId: string;
  /** The saved post to publish. Null while it is still being saved. */
  postId: string | null;
  /** The caption the post was built with, as a starting point. */
  defaultCaption: string;
  /** A data url of the exact image that will be published. */
  previewUrl: string | null;
  /** Where "Connect Instagram" sends someone who has no account yet. */
  connectTo?: string;
};

type Result =
  | { kind: "idle" }
  | { kind: "done"; permalink: string | null; accountLabel: string }
  | { kind: "error"; message: string; reconnect?: boolean };

/**
 * Publishing a finished post to a connected Instagram account.
 *
 * It sends three identifiers and a caption, and nothing else: the server holds
 * the token, decides whether this brand may use that account, and reads the
 * image from storage itself. There is no version of this dialog that could
 * publish somewhere the signed-in person is not entitled to.
 */
export function PublishDialog({
  open,
  onOpenChange,
  businessId,
  postId,
  defaultCaption,
  previewUrl,
  connectTo = "/settings",
}: Props) {
  const loadAccounts = useServerFn(listSocialAccounts);
  const publish = useServerFn(publishNow);

  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [accountId, setAccountId] = useState("");
  const [caption, setCaption] = useState(defaultCaption);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result>({ kind: "idle" });

  const load = useCallback(async () => {
    setAccounts(null);
    try {
      const res = await loadAccounts({ data: { businessId } });
      const usable = res.accounts.filter((a): a is Account => a.platform === "instagram");
      setAccounts(usable);
      const first = usable.find((a) => !a.needsReconnect) ?? usable[0];
      if (first) setAccountId(first.id);
    } catch {
      setAccounts([]);
    }
  }, [businessId, loadAccounts]);

  // Reload every time it opens: an account may have been connected or
  // disconnected in another tab since the last look.
  useEffect(() => {
    if (!open) return;
    setResult({ kind: "idle" });
    setCaption(defaultCaption);
    void load();
  }, [open, defaultCaption, load]);

  const selected = accounts?.find((a) => a.id === accountId) ?? null;

  async function run() {
    if (!postId || !selected) return;
    setBusy(true);
    setResult({ kind: "idle" });
    try {
      const res = await publish({ data: { businessId, postId, accountId, caption } });
      if (res.ok) {
        setResult({
          kind: "done",
          permalink: res.permalink ?? null,
          accountLabel: res.accountLabel,
        });
      } else if (res.error === "reconnect") {
        setResult({
          kind: "error",
          message: "Your Instagram connection needs to be renewed.",
          reconnect: true,
        });
      } else {
        setResult({ kind: "error", message: res.error });
      }
    } catch {
      setResult({ kind: "error", message: "We could not publish this post. Please try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Instagram className="size-4" aria-hidden />
            Publish to Instagram
          </DialogTitle>
          <DialogDescription>
            This publishes the finished design exactly as it was exported.
          </DialogDescription>
        </DialogHeader>

        {result.kind === "done" ? (
          <div className="grid gap-4 py-2 text-center">
            <CheckCircle2 className="mx-auto size-10 text-primary" aria-hidden />
            <div>
              <p className="text-sm font-bold">Published successfully</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Your post is live on {result.accountLabel}.
              </p>
            </div>
            <DialogFooter className="sm:justify-center">
              {result.permalink ? (
                <Button asChild variant="outline" className="rounded-xl">
                  <a href={result.permalink} target="_blank" rel="noopener noreferrer">
                    View post
                    <ExternalLink className="ml-1.5 size-3.5" aria-hidden />
                  </a>
                </Button>
              ) : null}
              <Button className="rounded-xl" onClick={() => onOpenChange(false)}>
                Done
              </Button>
            </DialogFooter>
          </div>
        ) : accounts === null ? (
          <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Loading your accounts...
          </p>
        ) : accounts.length === 0 ? (
          <div className="grid gap-3 py-2">
            <p className="text-sm text-muted-foreground">No Instagram account connected.</p>
            <Button asChild className="rounded-xl">
              <Link to={connectTo} onClick={() => onOpenChange(false)}>
                Connect Instagram
              </Link>
            </Button>
          </div>
        ) : (
          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="publish-account">Instagram account</Label>
              <select
                id="publish-account"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="h-11 rounded-xl border border-border bg-card px-3 text-sm font-semibold"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                    {a.needsReconnect ? " (needs reconnecting)" : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-1.5">
              <div className="flex items-baseline justify-between">
                <Label htmlFor="publish-caption">Caption</Label>
                <span
                  className={`text-xs ${
                    caption.length > CAPTION_MAX ? "text-destructive" : "text-muted-foreground"
                  }`}
                >
                  {caption.length} / {CAPTION_MAX}
                </span>
              </div>
              <Textarea
                id="publish-caption"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                rows={5}
                className="rounded-xl"
              />
            </div>

            {previewUrl ? (
              <div className="grid gap-1.5">
                <Label>Preview</Label>
                <img
                  src={previewUrl}
                  alt="The design that will be published"
                  className="mx-auto w-40 rounded-xl border border-border"
                />
              </div>
            ) : null}

            {result.kind === "error" ? (
              <div className="grid gap-2 rounded-xl border border-destructive/40 bg-destructive/5 p-3">
                <p role="alert" className="text-sm font-semibold text-destructive">
                  {result.message}
                </p>
                {result.reconnect ? (
                  <Button asChild size="sm" variant="outline" className="rounded-lg">
                    <Link to={connectTo} onClick={() => onOpenChange(false)}>
                      Reconnect Instagram
                    </Link>
                  </Button>
                ) : null}
              </div>
            ) : null}

            <DialogFooter>
              <Button
                className="rounded-xl"
                onClick={() => void run()}
                disabled={
                  busy ||
                  !postId ||
                  !selected ||
                  selected.needsReconnect ||
                  caption.length > CAPTION_MAX
                }
              >
                {busy ? (
                  <>
                    <Loader2 className="mr-1.5 size-4 animate-spin" aria-hidden />
                    Publishing...
                  </>
                ) : (
                  "Publish"
                )}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
