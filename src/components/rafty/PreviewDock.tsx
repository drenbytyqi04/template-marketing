import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Maximize2, Minimize2, Move, PanelRight } from "lucide-react";

/**
 * The live preview, kept on screen while the form is edited.
 *
 * The preview used to be the second column of the page, pinned with
 * `position: sticky`. That works right up to the point where the form is longer
 * than the screen - which this form is, by a lot - because a sticky element can
 * only follow its own column, and the column ends. Below the price the design
 * had scrolled away, and everything after that was being typed blind: the
 * adjust panel, the logo placement, the per-element nudges. Those controls exist
 * precisely to be watched while they are used.
 *
 * So the preview comes out of the page flow and is drawn over it, in a window
 * the customer can move, resize and fold away. The page reserves the width of
 * that window as a right-hand gutter, which is what keeps the promise the
 * sticky column could not: the preview is always visible and never on top of a
 * field. The reservation travels through a css custom property rather than a
 * prop, because the thing that needs to know is the page's padding, not any
 * component between here and it.
 *
 * On a phone a floating window is nonsense - there is no room beside anything -
 * so the same idea takes the shape the screen allows: a strip at the top that
 * the fields scroll under. It is the same single canvas either way. Rendering a
 * second copy for the other layout would mean two previews, one of them stale,
 * and an exporter with two nodes to choose between.
 */

const STORE_KEY = "krijo24.preview-dock.v1";

/** The three widths the window steps between, in px. Small enough to leave a
 * phone-shaped form room on a laptop, large enough to judge type at the top. */
const WIDTHS = [300, 380, 470];

/** Distance from the viewport edge when the window has not been moved. */
const EDGE = 20;

/** Clear of the app header, which is sticky and 68px tall. */
const TOP = 88;

/** How much of the window must stay on screen while it is dragged. Enough to
 * grab the header bar again, so it can never be lost off an edge. */
const MIN_VISIBLE = 140;

/** Share of the viewport height the phone strip takes, folded out and opened
 * up. A third is enough to see the whole design; two thirds is for looking at
 * it properly without leaving the form. */
const RAIL_SHARE = 0.34;
const RAIL_SHARE_BIG = 0.6;

type Saved = {
  left: number | null;
  top: number | null;
  step: number;
  collapsed: boolean;
};

function read(): Saved {
  const fallback: Saved = { left: null, top: null, step: 1, collapsed: false };
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<Saved>;
    return {
      left: typeof parsed.left === "number" ? parsed.left : null,
      top: typeof parsed.top === "number" ? parsed.top : null,
      step: typeof parsed.step === "number" ? Math.min(2, Math.max(0, parsed.step)) : 1,
      collapsed: parsed.collapsed === true,
    };
  } catch {
    return fallback;
  }
}

type Props = {
  /** Width over height of the frame being previewed, so the window matches the
   * shape of the post rather than imposing one. */
  aspect: number;
  label: string;
  children: React.ReactNode;
};

export function PreviewDock({ aspect, label, children }: Props) {
  // Starts as the phone layout on both sides of hydration, then corrects
  // itself: a value read from matchMedia during render would not match what the
  // server rendered.
  const [wide, setWide] = useState(false);
  const [viewport, setViewport] = useState({ w: 1280, h: 800 });
  const [state, setState] = useState<Saved>({ left: null, top: null, step: 1, collapsed: false });
  const [railBig, setRailBig] = useState(false);
  const dragging = useRef<{ dx: number; dy: number } | null>(null);

  useEffect(() => {
    setState(read());
    const mq = window.matchMedia("(min-width: 1024px)");
    const sync = () => {
      setWide(mq.matches);
      setViewport({ w: window.innerWidth, h: window.innerHeight });
    };
    sync();
    mq.addEventListener("change", sync);
    window.addEventListener("resize", sync);
    return () => {
      mq.removeEventListener("change", sync);
      window.removeEventListener("resize", sync);
    };
  }, []);

  const save = useCallback((next: Saved) => {
    setState(next);
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(next));
    } catch {
      // A browser that refuses storage still gets a working window, it just
      // forgets where it was put.
    }
  }, []);

  // The window is as wide as the step asks for, unless that would make a tall
  // frame taller than the screen - a 9:16 story at 470px is 835px high. Height
  // is what the room actually limits, so width gives way to it.
  const roomForHeight = Math.max(220, viewport.h - TOP - EDGE * 2);
  const width = Math.min(WIDTHS[state.step]!, Math.round(roomForHeight * aspect));

  // Keep a moved window reachable when the screen changes size under it.
  useEffect(() => {
    if (!wide || state.left === null || state.top === null) return;
    const left = Math.min(Math.max(state.left, MIN_VISIBLE - width), viewport.w - MIN_VISIBLE);
    const top = Math.min(Math.max(state.top, 0), Math.max(0, viewport.h - 56));
    if (left !== state.left || top !== state.top) save({ ...state, left, top });
  }, [wide, viewport, width, state, save]);

  // What the page leaves clear on the right. Only while the window is actually
  // floating there: on a phone the strip is in the flow and reserves nothing.
  useEffect(() => {
    const root = document.documentElement;
    if (!wide) {
      root.style.removeProperty("--krijo-dock");
      return;
    }
    root.style.setProperty("--krijo-dock", `${width + EDGE * 2}px`);
    return () => {
      root.style.removeProperty("--krijo-dock");
    };
  }, [wide, width]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (!wide) return;
    const host = (e.currentTarget as HTMLElement).closest("[data-dock]") as HTMLElement | null;
    if (!host) return;
    const box = host.getBoundingClientRect();
    dragging.current = { dx: e.clientX - box.left, dy: e.clientY - box.top };
    // Taking the window off its right-hand anchor the moment a drag starts is
    // what stops it jumping: from here on it is positioned by left/top, which
    // is what the pointer is moving.
    save({ ...state, left: box.left, top: box.top });
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const grab = dragging.current;
    if (!grab) return;
    const left = Math.min(
      Math.max(e.clientX - grab.dx, MIN_VISIBLE - width),
      viewport.w - MIN_VISIBLE,
    );
    const top = Math.min(Math.max(e.clientY - grab.dy, 0), Math.max(0, viewport.h - 56));
    setState((prev) => ({ ...prev, left, top }));
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    dragging.current = null;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    save(state);
  };

  if (!wide) {
    const height = Math.round(viewport.h * (railBig ? RAIL_SHARE_BIG : RAIL_SHARE));
    // 4.25rem is the app header: a 44px row plus 12px of padding either side.
    // A strip that stops any lower leaves a slot of moving page between the
    // two, which reads as a rendering fault rather than as a gap.
    return (
      <div className="card-soft sticky top-[4.25rem] z-30 mb-4 overflow-hidden lg:hidden">
        <div className="flex items-center gap-2 px-3 py-2">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
          <div className="ml-auto flex items-center gap-1">
            {state.collapsed ? null : (
              <button
                type="button"
                aria-label={railBig ? "Make the preview smaller" : "Make the preview bigger"}
                className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-accent"
                onClick={() => setRailBig((v) => !v)}
              >
                {railBig ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
              </button>
            )}
            <button
              type="button"
              aria-label={state.collapsed ? "Show the preview" : "Hide the preview"}
              className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-accent"
              onClick={() => save({ ...state, collapsed: !state.collapsed })}
            >
              {state.collapsed ? (
                <ChevronDown className="size-4" />
              ) : (
                <ChevronUp className="size-4" />
              )}
            </button>
          </div>
        </div>
        {/* Kept mounted while folded away, at no height. Unmounting it would
            throw away the canvas the exporter holds a reference to, and a
            customer who folded the preview to see more of the form still
            expects Download to work. */}
        <div
          className="overflow-hidden px-2 transition-[height,padding] duration-150"
          style={state.collapsed ? { height: 0, padding: 0 } : { height: height + 8 }}
        >
          <div className="mx-auto" style={{ width: Math.round(height * aspect), maxWidth: "100%" }}>
            {children}
          </div>
        </div>
      </div>
    );
  }

  const placement =
    state.left === null || state.top === null
      ? { right: EDGE, top: TOP }
      : { left: state.left, top: state.top };

  return (
    <div
      data-dock
      className="card-soft fixed z-30 overflow-hidden shadow-lg"
      style={{ ...placement, width }}
    >
      <div
        className="flex cursor-grab touch-none items-center gap-1.5 border-b border-border bg-muted/60 px-2 py-1.5 active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        // Back to the right-hand gutter, where it covers nothing.
        onDoubleClick={() => save({ ...state, left: null, top: null })}
      >
        <Move className="size-3.5 shrink-0 text-muted-foreground" />
        <p className="truncate text-xs font-bold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <div className="ml-auto flex items-center gap-0.5">
          {state.left !== null ? (
            <button
              type="button"
              aria-label="Put the preview back on the right"
              title="Put it back on the right"
              className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-accent"
              onClick={() => save({ ...state, left: null, top: null })}
            >
              <PanelRight className="size-3.5" />
            </button>
          ) : null}
          <button
            type="button"
            aria-label="Make the preview smaller"
            disabled={state.step === 0}
            className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-accent disabled:opacity-40"
            onClick={() => save({ ...state, step: Math.max(0, state.step - 1) })}
          >
            <Minimize2 className="size-3.5" />
          </button>
          <button
            type="button"
            aria-label="Make the preview bigger"
            disabled={state.step === WIDTHS.length - 1}
            className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-accent disabled:opacity-40"
            onClick={() => save({ ...state, step: Math.min(WIDTHS.length - 1, state.step + 1) })}
          >
            <Maximize2 className="size-3.5" />
          </button>
          <button
            type="button"
            aria-label={state.collapsed ? "Show the preview" : "Fold the preview away"}
            className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-accent"
            onClick={() => save({ ...state, collapsed: !state.collapsed })}
          >
            {state.collapsed ? (
              <ChevronDown className="size-3.5" />
            ) : (
              <ChevronUp className="size-3.5" />
            )}
          </button>
        </div>
      </div>
      <div
        className="overflow-hidden p-2 transition-[height,padding] duration-150"
        style={state.collapsed ? { height: 0, padding: 0 } : undefined}
      >
        {children}
      </div>
    </div>
  );
}
