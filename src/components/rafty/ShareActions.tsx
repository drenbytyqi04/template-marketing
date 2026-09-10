import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Check,
  Copy,
  Download,
  Facebook,
  Instagram,
  Linkedin,
  Loader2,
  Save,
  Share2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  downloadNode,
  nodeToPngFile,
  reasonFor,
  slugify,
  type ExportSize,
} from "@/lib/rafty/download";

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
};

/**
 * Primary actions once content has been generated. Every export goes through
 * the one deterministic renderer. Meta publishing is not implemented, so
 * Instagram and Facebook are clearly disabled with an explanation instead of
 * pretending to publish anything.
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
}: Props) {
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);

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

      <div className="rounded-xl border border-dashed bg-muted/40 p-3">
        <p className="text-xs font-semibold">Post to</p>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {[
            { key: "instagram", label: "Instagram", Icon: Instagram },
            { key: "facebook", label: "Facebook", Icon: Facebook },
            { key: "linkedin", label: "LinkedIn", Icon: Linkedin },
          ].map(({ key, label, Icon }) => (
            <Link key={key} to="/settings" className="block">
              <span className="flex h-14 flex-col items-center justify-center gap-1 rounded-lg border border-border bg-card px-1 text-center transition hover:border-primary/60">
                <Icon className="size-4 text-muted-foreground" />
                <span className="text-[10px] font-semibold text-muted-foreground">Connect</span>
                <span className="sr-only">{label}</span>
              </span>
            </Link>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Direct publishing is not connected yet, so nothing is published automatically. Manage
          connections in Settings and use Save to device meanwhile.
        </p>
      </div>

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
    </div>
  );
}
