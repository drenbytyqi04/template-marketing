import { useState } from "react";
import { format } from "date-fns";
import { de, enGB, sq } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { LanguageCode } from "@/lib/rafty/types";

const LOCALES = { en: enGB, de, sq } as const;

/**
 * A picked range, written the way the brand would write it.
 *
 * In the language the brand posts in, not the one the interface happens to be
 * showing - the date goes on the poster, and an agency selling in Albanian
 * should not get "November" over its offer because someone left the app in
 * English. The three cases are the ones a trip actually falls into: inside one
 * month the month is said once, across two months each date carries its own,
 * and across a new year the year is worth saying.
 */
export function formatRange(range: DateRange, language: LanguageCode): string {
  const locale = LOCALES[language] ?? enGB;
  const { from, to } = range;
  if (!from) return "";
  const at = (d: Date, pattern: string) => format(d, pattern, { locale });

  if (!to || +to === +from) return at(from, "d MMMM");
  if (from.getFullYear() !== to.getFullYear()) {
    return `${at(from, "d MMMM yyyy")} – ${at(to, "d MMMM yyyy")}`;
  }
  if (from.getMonth() !== to.getMonth()) {
    return `${at(from, "d MMMM")} – ${at(to, "d MMMM")}`;
  }
  return `${at(from, "d")}–${at(to, "d")} ${at(from, "MMMM")}`;
}

/**
 * Picks a date or a span of dates into a field that stays free text.
 *
 * The field this writes into is one key shared by every trade, and it is not
 * always a date: a car dealership labels it "Financing" and types "0% over 24
 * months" into it. So the calendar is offered beside the field rather than in
 * place of it - whoever wants to type keeps typing, and whoever wants a
 * calendar gets one that fills the same box.
 *
 * For the same reason the picker does not try to read the field back. Parsing
 * whatever somebody has typed into a free text box, in one of three languages,
 * to decide which days to highlight is a guess that is wrong often enough to be
 * worse than starting empty. What was picked here is remembered here; what the
 * post prints is whatever the field says.
 */
export function DateRangeField({
  value,
  onChange,
  language,
  label,
}: {
  value: string;
  onChange: (next: string) => void;
  language: LanguageCode;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const [range, setRange] = useState<DateRange | undefined>();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={`Pick ${label} from a calendar`}
          className="size-11 shrink-0 rounded-xl"
        >
          <CalendarDays className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto p-0">
        <Calendar
          mode="range"
          numberOfMonths={1}
          selected={range}
          locale={LOCALES[language] ?? enGB}
          onSelect={(next: DateRange | undefined) => {
            setRange(next);
            if (!next?.from) return;
            onChange(formatRange(next, language));
            // A completed span closes the calendar; a first click does not.
            //
            // The obvious test - "has it got an end date yet" - is wrong here,
            // because react-day-picker answers the very first click of a range
            // with both ends set to the same day. Closing on that made a span
            // impossible to pick at all: the calendar shut after one date,
            // every time. A span is only a span once the two ends differ.
            if (next.to && +next.to !== +next.from) setOpen(false);
          }}
        />
        <div className="flex items-center justify-between gap-2 border-t p-2">
          <span className="truncate px-1 text-xs text-muted-foreground">
            {value || "No dates picked"}
          </span>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 rounded-lg"
              onClick={() => {
                setRange(undefined);
                onChange("");
              }}
            >
              Clear
            </Button>
            {/* One date is a perfectly good answer, and it leaves the calendar
                open because nothing tells it the person is finished. This is
                what tells it. */}
            <Button
              type="button"
              size="sm"
              className="h-8 rounded-lg"
              onClick={() => setOpen(false)}
            >
              Done
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
