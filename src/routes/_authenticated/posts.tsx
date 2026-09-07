import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { CalendarClock, Clipboard, Copy, Download, Pencil, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppShell } from "@/components/rafty/AppShell";
import { PostCanvas } from "@/components/rafty/PostCanvas";
import { LazyMount } from "@/components/rafty/LazyMount";
import { useRafty } from "@/lib/rafty/store";
import { downloadNode, slugify } from "@/lib/rafty/download";
import { id as newId } from "@/lib/rafty/repo";
import type { Post } from "@/lib/rafty/types";

export const Route = createFileRoute("/_authenticated/posts")({
  head: () => ({
    meta: [
      { title: "Your posts | krijo24" },
      {
        name: "description",
        content: "Every post your business created, ready to reopen or download.",
      },
      { property: "og:title", content: "Your posts | krijo24" },
      { property: "og:description", content: "Reopen, edit or download your saved posts." },
    ],
  }),
  component: () => (
    <AppShell>
      <PostsPage />
    </AppShell>
  ),
});

function PostsPage() {
  const { business, brand, posts, templates, removePost, createPost, t } = useRafty();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const canvasRefs = useRef(new Map<string, HTMLDivElement>());

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return posts;
    return posts.filter(
      (p) =>
        p.content.title.toLowerCase().includes(q) || p.content.caption.toLowerCase().includes(q),
    );
  }, [posts, query]);

  if (!business || !brand) return null;

  async function handleDownload(post: Post) {
    const node = canvasRefs.current.get(post.id);
    if (!node) return;
    await downloadNode(node, slugify(post.content.title || "krijo24-post"));
  }

  async function handleCopyCaption(post: Post) {
    if (!post.content.caption) {
      toast.error("This post has no caption yet.");
      return;
    }
    await navigator.clipboard.writeText(post.content.caption);
    toast.success("Caption copied.");
  }

  async function handleDuplicate(post: Post) {
    if (!business) return;
    const duplicated: Post = {
      ...post,
      id: newId("post"),
      imagePath: null,
      content: { ...post.content, imageDataUrl: post.content.imageDataUrl },
      createdAt: new Date().toISOString(),
      shareStatus: {},
    };
    const saved = await createPost(duplicated);
    if (!saved) {
      toast.error("Could not duplicate the post.");
      return;
    }
    toast.success("Post duplicated.");
    navigate({ to: "/create", search: { post: saved.id, duplicate: "true" } as never });
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold">{t("posts.title")}</h1>
          <p className="text-sm text-muted-foreground">{business.name}</p>
        </div>
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by title"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-11 rounded-xl bg-card pl-9"
          />
        </div>
      </div>

      {posts.length === 0 ? (
        <div className="card-soft p-6 text-sm text-muted-foreground">{t("posts.empty")}</div>
      ) : filtered.length === 0 ? (
        <div className="card-soft p-6 text-sm text-muted-foreground">
          No posts match this search.
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 xl:grid-cols-5">
          {filtered.map((post) => {
            const template = templates.find((x) => x.id === post.templateId) ?? templates[0];
            if (!template) return null;
            return (
              <article key={post.id} className="card-soft overflow-hidden">
                <div className="p-1.5">
                  <LazyMount>
                    <div
                      ref={(node) => {
                        if (node) canvasRefs.current.set(post.id, node);
                        else canvasRefs.current.delete(post.id);
                      }}
                    >
                      <PostCanvas
                        template={template}
                        content={post.slides?.[0]?.content ?? post.content}
                        brand={brand}
                        businessName={business.name}
                        businessType={business.type}
                        showBrandName={post.showBrandName}
                        showContact={post.showContact ?? false}
                        adjustments={post.slides?.[0]?.adjustments ?? post.adjustments}
                        format={post.format ?? "post"}
                        className="rounded-md"
                      />
                    </div>
                  </LazyMount>
                </div>
                <div className="px-2 pb-1">
                  <p className="truncate text-[11px] font-bold">
                    {post.content.title || "Untitled"}
                  </p>
                  <p className="truncate text-[10px] text-muted-foreground">{template.name}</p>
                </div>
                <div className="flex items-center gap-0.5 px-1.5 pb-1.5">
                  <Button
                    asChild
                    size="icon"
                    variant="ghost"
                    className="size-7 shrink-0 rounded-lg"
                  >
                    <Link to="/create" search={{ post: post.id }} aria-label="Edit">
                      <Pencil className="size-3.5" />
                    </Link>
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7 shrink-0 rounded-lg"
                    aria-label="Duplicate"
                    onClick={() => void handleDuplicate(post)}
                  >
                    <Copy className="size-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7 shrink-0 rounded-lg"
                    aria-label="Copy caption"
                    onClick={() => void handleCopyCaption(post)}
                  >
                    <Clipboard className="size-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7 shrink-0 rounded-lg"
                    aria-label="Download"
                    onClick={() => void handleDownload(post)}
                  >
                    <Download className="size-3.5" />
                  </Button>
                  <Button
                    asChild
                    size="icon"
                    variant="ghost"
                    className="hidden size-7 shrink-0 rounded-lg sm:inline-flex"
                  >
                    <Link to="/schedule" search={{ post: post.id }} aria-label="Schedule">
                      <CalendarClock className="size-3.5" />
                    </Link>
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="ml-auto size-7 shrink-0 rounded-lg"
                    aria-label={t("posts.delete")}
                    onClick={() => removePost(post.id)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
