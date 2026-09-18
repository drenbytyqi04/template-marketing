import { useState } from "react";
import { Check, Copy, Download, Instagram, Loader2, Save, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  downloadNode,
  nodeToPngFile,
  reasonFor,
  renderNodeToDataUrl,
  slugify,
  type ExportSize,
} from "@/lib/rafty/download";
import { PublishDialog } from "./PublishDialog";

type Props = {
  canvasRef: React.RefObject<HTMLElement | null>;
  filename: string;
  caption: string;
  onSave: () => void;
  saveLabel?: string;
  saving?: boolean;
  /** Export canvas size, from the shared format table. */
  size?: ExportSize;
  /** False for formats without a reliable renderer yet, such as video. */
  exportable?: boolean;
  /** Shown instead of the export buttons when export is unavailable. */
  unavailableNote?: string;
  /**
   * Publishing straight to a connected account.
   *
   * `savePost` writes the post and its rendered image and returns the id,
   * because Instagram is told to fetch that image by url: there is nothing to
   * publish until both exist. Absent on surfaces that cannot publish.
   */
  publish?: { businessId: string; savePost: () => Promise<string | null> };
};

/**
 * Primary actions once content has been generated. Every export goes through
 * the one deterministic renderer, and so does the image that gets published:
 * what Instagram receives is the file the Download button would have given you.
 */
export function ShareActions({
  canvasRef,
  filename,
  caption,
  onSave,
  saveLabel = "Save",
  saving,
  size,
  exportable = true,
  unavailableNote,
  publish,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishPostId, setPublishPostId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  /**
   * Saves, renders, then opens the dialog.
   *
   * Done before the dialog rather than inside it so the preview it shows and
   * the file Instagram fetches are the same render, produced once.
   */
  async function openPublish() {
    if (!publish || publishing) return;
    setPublishing(true);
    try {
      const node = canvasRef.current;
      if (node) {
        try {
          setPreviewUrl(await renderNodeToDataUrl(node, size));
        } catch {
          /* the dialog simply shows no preview */
        }
      }
      const id = await publish.savePost();
      if (!id) return;
      setPublishPostId(id);
      setPublishOpen(true);
    } catch (error) {
      toast.error(reasonFor(error));
    } finally {
      setPublishing(false);
    }
  }

  async function copyCaption() {
    try {
      await navigator.clipboard.writeText(caption);
      setCopied(true);
      toast.success("Caption copied.");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Could not copy the caption.");
    }
  }

  const [downloading, setDownloading] = useState(false);

  async function downloadPng() {
    const node = canvasRef.current;
    if (!node || downloading) return;
    setDownloading(true);
    try {
      const kind = await downloadNode(node, slugify(filename), size);
      toast.success(kind === "video" ? "Video downloaded." : "Image downloaded.");
    } catch (err) {
      // The exporter knows why it stopped, and that reason is far more use than
      // "try again": footage that would not play, or a recording the browser
      // cut short, each need a different thing from the person downloading.
      toast.error(reasonFor(err));
    } finally {
      setDownloading(false);
    }
  }

  async function exportAll() {
    setSharing(true);
    try {
      const node = canvasRef.current;
      if (!node) return;
      const file = await nodeToPngFile(node, slugify(filename), size);
      const nav = navigator as Navigator & {
        canShare?: (data: { files: File[] }) => boolean;
        share?: (data: { files: File[]; title?: string; text?: string }) => Promise<void>;
      };
      if (nav.canShare?.({ files: [file] }) && nav.share) {
        await nav.share({ files: [file], title: filename, text: caption });
        return;
      }
      const kind = await downloadNode(node, slugify(filename), size);
      toast.success(kind === "video" ? "Video downloaded." : "Image downloaded.");
    } catch (err) {
      if ((err as Error)?.name !== "AbortError") {
        toast.error(reasonFor(err));
      }
    } finally {
      setSharing(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className={exportable ? "grid grid-cols-2 gap-2" : "grid gap-2"}>
        <Button className="h-12 rounded-xl" onClick={onSave} disabled={saving}>
          <Save className="mr-1 size-4" />
          {saveLabel}
        </Button>
        {exportable ? (
          <Button
            variant="outline"
            className="h-12 rounded-xl"
            onClick={exportAll}
            disabled={sharing}
          >
            {sharing ? (
              <Loader2 className="mr-1 size-4 animate-spin" />
            ) : (
              <Share2 className="mr-1 size-4" />
            )}
            {sharing ? "Preparing…" : "Save to device"}
          </Button>
        ) : null}
      </div>

      {!exportable ? (
        <p className="rounded-xl border border-dashed bg-muted/40 p-3 text-xs text-muted-foreground">
          {unavailableNote ??
            "Video download is not available yet. Your storyboard, timing and content are saved and will export once video rendering is ready."}
        </p>
      ) : null}

      <Button variant="outline" className="h-11 rounded-xl" onClick={copyCaption}>
        {copied ? <Check className="mr-1 size-4" /> : <Copy className="mr-1 size-4" />}
        Copy caption
      </Button>

      {publish && exportable ? (
        <Button
          variant="outline"
          className="h-12 w-full rounded-xl"
          onClick={() => void openPublish()}
          disabled={publishing || saving}
        >
          {publishing ? (
            <Loader2 className="mr-1.5 size-4 animate-spin" aria-hidden />
          ) : (
            <Instagram className="mr-1.5 size-4" aria-hidden />
          )}
          {publishing ? "Preparing..." : "Publish to Instagram"}
        </Button>
      ) : null}

      {exportable ? (
        <Button
          variant="ghost"
          className="h-9 rounded-xl text-xs text-muted-foreground"
          onClick={downloadPng}
          disabled={downloading}
        >
          {downloading ? (
            <Loader2 className="mr-1 size-3.5 animate-spin" />
          ) : (
            <Download className="mr-1 size-3.5" />
          )}
          {downloading ? "Preparing…" : "Download PNG"}
        </Button>
      ) : null}

      {publish ? (
        <PublishDialog
          open={publishOpen}
          onOpenChange={setPublishOpen}
          businessId={publish.businessId}
          postId={publishPostId}
          defaultCaption={caption}
          previewUrl={previewUrl}
        />
      ) : null}
    </div>
  );
}
