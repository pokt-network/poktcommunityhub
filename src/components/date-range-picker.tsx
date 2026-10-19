"use client";

import dynamic from "next/dynamic";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import { LuCalendar } from "react-icons/lu";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const Calendar = dynamic(
  () => import("@/components/ui/calendar").then((m) => m.Calendar),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-64 w-[280px] items-center justify-center text-xs text-muted">
        Loading calendar…
      </div>
    ),
  },
);

type DateRangePickerProps = {
  range: DateRange | undefined;
  onRangeChange: (value: DateRange | undefined) => void;
  placeholder?: string;
  className?: string;
  triggerClassName?: string;
};

export function DateRangePicker({
  range,
  onRangeChange,
  placeholder = "Dates",
  className,
  triggerClassName,
}: DateRangePickerProps) {
  const rangeLabel =
    range?.from && range?.to
      ? `${format(range.from, "MMM d")} – ${format(range.to, "MMM d")}`
      : range?.from
        ? `${format(range.from, "MMM d")} – …`
        : placeholder;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(
            "w-full justify-start px-4 font-medium sm:w-[9.5rem] sm:shrink-0",
            triggerClassName,
          )}
        >
          <LuCalendar className="h-3.5 w-3.5 shrink-0 text-muted" />
          <span className="truncate">{rangeLabel}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className={cn(
          "z-[120] w-[min(100vw-2rem,20rem)] rounded-2xl border-white/15 bg-[#0a0f1a]/95 p-3 shadow-2xl backdrop-blur-xl sm:w-auto",
          className,
        )}
      >
        <Calendar
          mode="range"
          numberOfMonths={1}
          selected={range}
          onSelect={onRangeChange}
          defaultMonth={range?.from}
          className="mx-auto"
        />
        {range?.from ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-2 w-full rounded-full"
            onClick={() => onRangeChange(undefined)}
          >
            Clear dates
          </Button>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
