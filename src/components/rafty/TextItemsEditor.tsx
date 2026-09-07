import { ArrowDown, ArrowUp, Plus, Trash2, Type } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  MAX_TEXT_ITEMS,
  type PostTextItem,
  type TextAlign,
  type TextBand,
  type TextSize,
} from "@/lib/rafty/types";

const SIZES: { value: TextSize; label: string }[] = [
  { value: "small", label: "S" },
  { value: "medium", label: "M" },
  { value: "large", label: "L" },
];

const ALIGNS: { value: TextAlign; label: string }[] = [
  { value: "left", label: "Left" },
  { value: "center", label: "Center" },
  { value: "right", label: "Right" },
];

const BANDS: { value: TextBand; label: string }[] = [
  { value: "top", label: "Top" },
  { value: "middle", label: "Middle" },
  { value: "bottom", label: "Bottom" },
];

function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (next: T) => void;
  label: string;
}) {
  return (
    <div className="flex rounded-lg border border-border bg-card p-0.5" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={`h-7 min-w-9 rounded-md px-2 text-xs font-semibold transition-colors ${
            value === option.value
              ? "bg-primary-soft text-accent-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/**
 * One simple "+ Add text" flow. Size, alignment and placement only, all
 * constrained, so the template's design always stays intact.
 */
export function TextItemsEditor({
  items,
  onChange,
  newId,
}: {
  items: PostTextItem[];
  onChange: (next: PostTextItem[]) => void;
  newId: () => string;
}) {
  function patch(id: string, next: Partial<PostTextItem>) {
    onChange(items.map((item) => (item.id === id ? { ...item, ...next } : item)));
  }

  function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    const a = next[index]!;
    next[index] = next[target]!;
    next[target] = a;
    onChange(next);
  }

  return (
    <div className="grid gap-2">
      {items.map((item, index) => (
        <div key={item.id} className="grid gap-2 rounded-xl border border-border bg-card p-2.5">
          <div className="flex items-center gap-2">
            <Input
              value={item.text}
              maxLength={90}
              autoFocus={!item.text}
              placeholder="Your text"
              onChange={(e) => patch(item.id, { text: e.target.value })}
              className="h-9 rounded-lg"
            />
            <button
              type="button"
              aria-label="Move up"
              disabled={index === 0}
              className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted disabled:opacity-30"
              onClick={() => move(index, -1)}
            >
              <ArrowUp className="size-4" />
            </button>
            <button
              type="button"
              aria-label="Move down"
              disabled={index === items.length - 1}
              className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted disabled:opacity-30"
              onClick={() => move(index, 1)}
            >
              <ArrowDown className="size-4" />
            </button>
            <button
              type="button"
              aria-label="Delete text"
              className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              onClick={() => onChange(items.filter((x) => x.id !== item.id))}
            >
              <Trash2 className="size-4" />
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Segmented
              label="Text size"
              value={item.size}
              options={SIZES}
              onChange={(size) => patch(item.id, { size })}
            />
            <Segmented
              label="Text alignment"
              value={item.align}
              options={ALIGNS}
              onChange={(align) => patch(item.id, { align })}
            />
            <Segmented
              label="Text placement"
              value={item.band}
              options={BANDS}
              onChange={(band) => patch(item.id, { band })}
            />
          </div>
        </div>
      ))}

      {items.length < MAX_TEXT_ITEMS ? (
        <Button
          type="button"
          variant="outline"
          className="h-10 w-fit rounded-xl"
          onClick={() =>
            onChange([
              ...items,
              { id: newId(), text: "", size: "medium", align: "left", band: "bottom" },
            ])
          }
        >
          <Plus className="mr-1.5 size-4" />
          Add text
        </Button>
      ) : (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Type className="size-3.5" />
          Three lines is the limit, so the design stays clean.
        </p>
      )}
    </div>
  );
}
