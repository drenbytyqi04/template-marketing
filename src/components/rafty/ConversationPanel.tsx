import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Loader2, Plus, Send } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import * as repo from "@/lib/rafty/repo";
import {
  CONVERSATION_STATUS_LABELS,
  CONVERSATION_TOPICS,
  topicLabel,
  type ConversationStatus,
  type ConversationTopic,
  type SupportConversation,
  type SupportMessage,
} from "@/lib/rafty/types";

/**
 * One brand's conversations with krijo24, from either side.
 *
 * The same component serves the customer and the admin, because it is the same
 * thread: two renderings of it would be two places for the history to disagree
 * about what was said. What differs is small and stated here - who may move the
 * status, and who may open a new request - rather than spread across two files
 * that then drift apart.
 */

type Props = {
  businessId: string;
  role: "client" | "admin";
  /** Told when something changed, so a list of threads elsewhere can refresh. */
  onChanged?: () => void;
};

const STATUS_TONE: Record<ConversationStatus, "default" | "secondary" | "outline"> = {
  active: "secondary",
  in_progress: "default",
  resolved: "outline",
};

/** Date and time, both. "2 hours ago" is friendlier and useless for a support
 * thread: the question is when it was sent, which is what gets quoted back. */
export function when(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function unread(conversation: SupportConversation, role: "client" | "admin"): boolean {
  const seen = role === "admin" ? conversation.adminReadAt : conversation.clientReadAt;
  if (!seen) return true;
  return new Date(conversation.lastMessageAt).getTime() > new Date(seen).getTime();
}

export function ConversationPanel({ businessId, role, onChanged }: Props) {
  const [conversations, setConversations] = useState<SupportConversation[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState("");
  const [composing, setComposing] = useState(false);
  const [topic, setTopic] = useState<ConversationTopic>("plan");
  const [subject, setSubject] = useState("");
  const [first, setFirst] = useState("");
  const bottom = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const rows =
      role === "admin"
        ? (await repo.adminListConversations()).filter((c) => c.businessId === businessId)
        : await repo.listConversations(businessId);
    setConversations(rows);
    setLoading(false);
  }, [businessId, role]);

  useEffect(() => {
    void load();
  }, [load]);

  const openThread = useCallback(
    async (id: string) => {
      setOpenId(id);
      setMessages(await repo.listConversationMessages(id));
      // Opening it is reading it. Marked for this side only; the database keeps
      // one side from clearing the other's mark.
      await repo.markConversationRead(id, role);
      setConversations((prev) =>
        prev.map((c) =>
          c.id === id
            ? {
                ...c,
                ...(role === "admin"
                  ? { adminReadAt: new Date().toISOString() }
                  : { clientReadAt: new Date().toISOString() }),
              }
            : c,
        ),
      );
      onChanged?.();
    },
    [role, onChanged],
  );

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "nearest" });
  }, [messages]);

  const open = conversations.find((c) => c.id === openId) ?? null;

  async function send() {
    const body = draft.trim();
    if (!open || !body || busy) return;
    setBusy(true);
    const res = await repo.sendConversationMessage(open.id, body);
    setBusy(false);
    if (res.error) {
      toast.error("Could not send that message.");
      return;
    }
    setDraft("");
    setMessages(await repo.listConversationMessages(open.id));
    await load();
    onChanged?.();
  }

  async function startNew() {
    const title = subject.trim();
    const body = first.trim();
    if (!title || !body || busy) return;
    setBusy(true);
    const res = await repo.startConversation({ businessId, topic, subject: title, body });
    setBusy(false);
    if (res.error || !res.id) {
      toast.error(res.error ?? "Could not send that request.");
      return;
    }
    setComposing(false);
    setSubject("");
    setFirst("");
    setTopic("plan");
    toast.success("Sent. krijo24 will answer in this thread.");
    await load();
    await openThread(res.id);
    onChanged?.();
  }

  async function changeStatus(next: ConversationStatus) {
    if (!open) return;
    const res = await repo.setConversationStatus(open.id, next);
    if (res.error) {
      toast.error("Could not change the status.");
      return;
    }
    setConversations((prev) => prev.map((c) => (c.id === open.id ? { ...c, status: next } : c)));
    onChanged?.();
  }

  if (loading) {
    return (
      <div className="grid place-items-center py-8 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }

  if (open) {
    return (
      <div className="grid gap-3">
        <div className="flex items-start gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="-ml-2 size-8 shrink-0 rounded-lg"
            aria-label="Back to all requests"
            onClick={() => {
              setOpenId(null);
              setMessages([]);
            }}
          >
            <ArrowLeft className="size-4" />
          </Button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">{open.subject}</p>
            <p className="truncate text-xs text-muted-foreground">
              {topicLabel(open.topic)} · opened {when(open.createdAt)}
            </p>
          </div>
          {role === "admin" ? (
            <Select
              value={open.status}
              onValueChange={(v) => void changeStatus(v as ConversationStatus)}
            >
              <SelectTrigger className="h-8 w-[9.5rem] shrink-0 rounded-lg text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(CONVERSATION_STATUS_LABELS) as ConversationStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>
                    {CONVERSATION_STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Badge variant={STATUS_TONE[open.status]} className="shrink-0">
              {CONVERSATION_STATUS_LABELS[open.status]}
            </Badge>
          )}
        </div>

        <div className="grid max-h-80 gap-2 overflow-y-auto rounded-xl border border-border bg-muted/40 p-3">
          {messages.map((m) => {
            // Whoever is reading sees their own side on the right. The same
            // thread therefore looks the same way round to both of them.
            const mine = role === "admin" ? m.fromAdmin : !m.fromAdmin;
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                    mine ? "bg-primary text-primary-foreground" : "bg-card"
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                  <p
                    className={`mt-1 text-[10px] ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}
                  >
                    {m.fromAdmin ? "krijo24" : "You"} · {when(m.createdAt)}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={bottom} />
        </div>

        <div className="grid gap-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            maxLength={4000}
            placeholder={role === "admin" ? "Reply to this customer" : "Write a message"}
            className="rounded-xl"
          />
          <Button
            className="h-10 rounded-xl justify-self-end"
            disabled={busy || !draft.trim()}
            onClick={() => void send()}
          >
            <Send className="mr-1 size-4" />
            Send
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {role === "client" ? (
        composing ? (
          <div className="grid gap-3 rounded-xl border border-border bg-card p-3">
            <div className="grid gap-1.5">
              <Label>What is it about?</Label>
              <Select value={topic} onValueChange={(v) => setTopic(v as ConversationTopic)}>
                <SelectTrigger className="h-10 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONVERSATION_TOPICS.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="support-subject">Title</Label>
              <Input
                id="support-subject"
                value={subject}
                maxLength={80}
                placeholder="Activate my plan for November"
                onChange={(e) => setSubject(e.target.value)}
                className="h-10 rounded-xl"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="support-first">Message</Label>
              <Textarea
                id="support-first"
                value={first}
                rows={4}
                maxLength={4000}
                onChange={(e) => setFirst(e.target.value)}
                className="rounded-xl"
              />
            </div>
            <div className="flex gap-2">
              <Button
                className="h-10 rounded-xl"
                disabled={busy || !subject.trim() || !first.trim()}
                onClick={() => void startNew()}
              >
                Send request
              </Button>
              <Button
                variant="ghost"
                className="h-10 rounded-xl"
                onClick={() => setComposing(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button className="h-10 rounded-xl justify-self-start" onClick={() => setComposing(true)}>
            <Plus className="mr-1 size-4" />
            New request
          </Button>
        )
      ) : null}

      {conversations.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
          {role === "admin"
            ? "This customer has not written in yet."
            : "No requests yet. Open one and the krijo24 team will answer here."}
        </p>
      ) : (
        <ul className="grid gap-2">
          {conversations.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                className="flex w-full items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5 text-left transition-colors hover:border-primary/50"
                onClick={() => void openThread(c.id)}
              >
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 truncate text-sm font-semibold">
                    {unread(c, role) ? (
                      <span
                        aria-label="Unread"
                        className="size-2 shrink-0 rounded-full bg-primary"
                      />
                    ) : null}
                    <span className="truncate">{c.subject}</span>
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {topicLabel(c.topic)} · {when(c.lastMessageAt)}
                  </p>
                </div>
                <Badge variant={STATUS_TONE[c.status]} className="shrink-0">
                  {CONVERSATION_STATUS_LABELS[c.status]}
                </Badge>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
