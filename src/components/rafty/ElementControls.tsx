import { useState } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  defaultElementAdjust,
  MOVABLE_ELEMENTS,
  type ElementAdjust,
  type LogoPlace,
  type MovableElement,
  type PostAdjustments,
  type PostContent,
} from "@/lib/rafty/types";

type Props = {
  content: PostContent;
  showBrandName: boolean;
  showContact: boolean;
  hasLogo: boolean;
  adjustments: PostAdjustments;
  onChange: (next: PostAdjustments) => void;
};

// The same bounds the mark has, and the same ones the renderer enforces. An
// element placed by hand is being placed on purpose, so it gets the room to be
// placed anywhere rather than the narrow nudge the whole text layer gets.
const SCALE_MIN = 0.5;
const SCALE_MAX = 3;
const SCALE_STEP = 0.1;
const OFFSET_LIMIT = 12;

const clampScale = (v: number) => Math.round(Math.max(SCALE_MIN, Math.min(SCALE_MAX, v)) * 10) / 10;
const clampOffset = (v: number) => Math.max(-OFFSET_LIMIT, Math.min(OFFSET_LIMIT, v));

/** Where an element can go, in the order the buttons read: the template's own
 * answer, then the frame left to right, top to bottom. */
const PLACES: { id: LogoPlace; label: string }[] = [
  { id: "design", label: "Template" },
  { id: "topLeft", label: "Top left" },
  { id: "topCenter", label: "Top center" },
  { id: "topRight", label: "Top right" },
  { id: "center", label: "Center" },
  { id: "bottomLeft", label: "Bottom left" },
  { id: "bottomCenter", label: "Bottom center" },
  { id: "bottomRight", label: "Bottom right" },
];

/**
 * What each element is called here.
 *
 * The name of the field it comes from, not the name of the part it is in the
 * renderer. Somebody who typed a destination into a box marked Destination is
 * looking for a button marked Destination; "kicker" is a word for whoever wrote
 * the layout.
 */
const LABELS: Record<MovableElement, string> = {
  headline: "Offer",
  kicker: "Destination",
  price: "Price",
  facts: "Details",
  included: "Included",
  stamp: "Urgent line",
  cta: "Button text",
  offers: "Price list",
  brand: "Brand name",
  contact: "Contact info",
};

/**
 * Which elements this post has anything to move.
 *
 * An element the post never filled in draws nothing, so a button that offers to
 * place it is a button that does nothing when pressed. This mirrors what each
 * part actually asks of the content; it is a second reading of the same thing,
 * and the cost of it drifting is a greyed out button rather than a wrong post.
 */
function filledElements(props: Props): Set<MovableElement> {
  const { content: c } = props;
  const has = (v?: string | null) => !!v && v.trim().length > 0;
  const on = new Set<MovableElement>();
  // The headline always draws: with nothing typed it prints its own placeholder.
  on.add("headline");
  if (has(c.subject) || has(c.location)) on.add("kicker");
  if (has(c.price)) on.add("price");
  if (has(c.location) || has(c.meta1) || has(c.meta2) || has(c.date)) on.add("facts");
  if (c.services.some((s) => has(s))) on.add("included");
  if (has(c.additionalText)) on.add("stamp");
  if (has(c.cta)) on.add("cta");
  if ((c.offers ?? []).some((o) => has(o.label) && has(o.price))) on.add("offers");
  if (props.showBrandName || props.hasLogo) on.add("brand");
  if (props.showContact) on.add("contact");
  return on;
}

/**
 * Place any element of the design by hand.
 *
 * The mark has had this since there was a mark to place, and it was the only
 * thing on a post that had it. A customer looking at their own photograph can
 * see that the price belongs in the top corner, away from the horizon, or that
 * the destination wants to sit over the sky rather than the sea - and the
 * answer was that the template decides. Now the same eight places, the same
 * nudges and the same size the mark gets are asked of everything else the post
 * prints.
 *
 * One element is edited at a time. Eight buttons, two sizes and four arrows for
 * each of ten elements at once is not a control panel, it is a wall; and an
 * element is placed by looking at the post, which means looking at one thing at
 * a time anyway.
 */
export function ElementControls(props: Props) {
  const { adjustments, onChange } = props;
  const filled = filledElements(props);
  const offered = MOVABLE_ELEMENTS.filter((id) => filled.has(id));
  const [selected, setSelected] = useState<MovableElement>("headline");
  const active = offered.includes(selected) ? selected : (offered[0] ?? "headline");

  const current: ElementAdjust = {
    ...defaultElementAdjust,
    ...(adjustments.elements?.[active] ?? {}),
  };
  const set = (patch: Partial<ElementAdjust>) =>
    onChange({
      ...adjustments,
      elements: { ...(adjustments.elements ?? {}), [active]: { ...current, ...patch } },
    });

  /** True while the template still decides where this element goes, which is
   * what leaves the nudges and the size with nothing to act on. */
  const placedByTemplate = current.place === "design";

  /** How many elements have been taken out of the layout, so the customer can
   * see at a glance that they moved something and where it was. */
  const movedCount = MOVABLE_ELEMENTS.filter(
    (id) => (adjustments.elements?.[id]?.place ?? "design") !== "design",
  ).length;

  const arrow = (icon: React.ReactNode, dx: number, dy: number, label: string) => (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className="size-10 rounded-xl"
      aria-label={label}
      disabled={placedByTemplate}
      onClick={() => set({ x: clampOffset(current.x + dx), y: clampOffset(current.y + dy) })}
    >
      {icon}
    </Button>
  );

  return (
    <div className="grid gap-3 rounded-xl border border-border bg-card px-3 py-2.5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Place elements</p>
        <span className="text-xs text-muted-foreground">
          {placedByTemplate
            ? movedCount
              ? `${movedCount} moved`
              : ""
            : `${Math.round(current.scale * 100)}%`}
        </span>
      </div>

      {/* Which element is being placed. A dot marks the ones already moved, so
          the set of them is readable without pressing anything. */}
      <div className="flex flex-wrap gap-1.5">
        {offered.map((id) => {
          const moved = (adjustments.elements?.[id]?.place ?? "design") !== "design";
          return (
            <Button
              key={id}
              type="button"
              variant={active === id ? "default" : "outline"}
              size="sm"
              className="h-9 rounded-xl"
              onClick={() => setSelected(id)}
            >
              {LABELS[id]}
              {moved ? (
                <span aria-hidden className="ml-1.5 text-[10px] leading-none">
                  ●
                </span>
              ) : null}
            </Button>
          );
        })}
      </div>

      <div className="h-px bg-border" />

      <div className="flex flex-wrap gap-1.5">
        {PLACES.map((option) => (
          <Button
            key={option.id}
            type="button"
            variant={current.place === option.id ? "default" : "outline"}
            size="sm"
            className="h-9 rounded-xl"
            onClick={() => set({ place: option.id })}
          >
            {option.label}
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-10 rounded-xl"
          aria-label={`Make the ${LABELS[active].toLowerCase()} smaller`}
          disabled={placedByTemplate}
          onClick={() => set({ scale: clampScale(current.scale - SCALE_STEP) })}
        >
          <Minus className="size-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-10 rounded-xl"
          aria-label={`Make the ${LABELS[active].toLowerCase()} bigger`}
          disabled={placedByTemplate}
          onClick={() => set({ scale: clampScale(current.scale + SCALE_STEP) })}
        >
          <Plus className="size-4" />
        </Button>
        <div className="mx-1 h-8 w-px bg-border" />
        {/* Disabled rather than hidden: a control that vanishes reads as a bug,
            and one that does nothing when pressed reads as a broken one. */}
        {arrow(<ArrowUp className="size-4" />, 0, -1, "Move it up")}
        {arrow(<ArrowDown className="size-4" />, 0, 1, "Move it down")}
        {arrow(<ArrowLeft className="size-4" />, -1, 0, "Move it left")}
        {arrow(<ArrowRight className="size-4" />, 1, 0, "Move it right")}
      </div>

      <p className="text-xs text-muted-foreground">
        Pick an element, then a corner. Template leaves it where the design puts it.
      </p>
    </div>
  );
}
