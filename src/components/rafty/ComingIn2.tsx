import { Sparkles } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * Work that is finished, wired up, and deliberately not switched on yet.
 *
 * Publishing straight to Instagram and the scheduling queue both work, and
 * both are held back to the next release. The temptation with anything held
 * back is to take the button away, and that is the one thing not to do: a
 * customer who was shown the feature and then cannot find it assumes it broke,
 * and a customer who finds a button that does nothing at all assumes the same.
 * So the way in stays exactly where it was, says what it is, and says when it
 * is coming.
 *
 * Nothing here removes the code behind those features. The server functions,
 * the tokens and the publishing rules are untouched, so turning them on is a
 * matter of taking these gates off rather than building them again.
 */
export const NEXT_VERSION = "2.0";

const LINE = `Coming in version ${NEXT_VERSION}`;

/** The small marker that sits beside a thing which is not on yet. */
export function ComingIn2Badge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border border-primary/30 bg-primary-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent-foreground",
        className,
      )}
    >
      <Sparkles className="size-3" aria-hidden />
      {NEXT_VERSION}
    </span>
  );
}

/**
 * The panel a whole page shows in place of a feature that is not on yet.
 *
 * It names the feature rather than apologising in the abstract, because
 * someone who came looking for it wants to know that they found the right
 * place and that nothing they saved is lost.
 */
export function ComingIn2Panel({
  title,
  what,
  keeps,
}: {
  title: string;
  /** One sentence: what this will do once it is on. */
  what: string;
  /** One sentence: what happens to their work in the meantime. */
  keeps?: string;
}) {
  return (
    <section className="card-soft mx-auto max-w-xl p-6 text-center sm:p-8">
      <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary-soft">
        <Sparkles className="size-6 text-accent-foreground" aria-hidden />
      </span>
      <h2 className="mt-4 text-lg font-bold">{title}</h2>
      <p className="mt-1 text-sm font-semibold text-accent-foreground">{LINE}</p>
      <p className="mt-3 text-sm text-muted-foreground">{what}</p>
      {keeps ? <p className="mt-2 text-sm text-muted-foreground">{keeps}</p> : null}
    </section>
  );
}

/** The same message, as the answer to a button that is still on the screen. */
export function ComingIn2Dialog({
  open,
  onOpenChange,
  title,
  what,
  keeps,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  what: string;
  keeps?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {title}
            <ComingIn2Badge />
          </DialogTitle>
          <DialogDescription>{LINE}</DialogDescription>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{what}</p>
        {keeps ? <p className="text-sm text-muted-foreground">{keeps}</p> : null}
      </DialogContent>
    </Dialog>
  );
}
