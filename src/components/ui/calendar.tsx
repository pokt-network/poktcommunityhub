"use client";

import type { ComponentProps } from "react";
import { DayPicker } from "react-day-picker";
import { cn } from "@/lib/utils";

export type CalendarProps = ComponentProps<typeof DayPicker>;

export function Calendar({ className, classNames, ...props }: CalendarProps) {
  return (
    <DayPicker
      className={cn("rdp-root text-sm text-foreground", className)}
      classNames={{
        months: "relative",
        month_caption:
          "flex items-center justify-center px-8 pb-2 text-sm font-semibold",
        nav: "absolute inset-x-0 top-0 flex items-center justify-between",
        button_previous:
          "inline-flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-white/5 hover:text-foreground",
        button_next:
          "inline-flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-white/5 hover:text-foreground",
        weekdays: "flex",
        weekday: "w-9 text-center text-[0.7rem] font-medium text-muted",
        week: "mt-1 flex",
        day: "relative h-9 w-9 p-0 text-center text-sm",
        day_button:
          "inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        today: "font-semibold text-primary",
        selected: "bg-primary text-white hover:bg-primary",
        range_start: "rounded-l-md bg-primary text-white",
        range_end: "rounded-r-md bg-primary text-white",
        range_middle: "rounded-none bg-primary/25 text-foreground",
        outside: "text-muted/40",
        disabled: "text-muted/30 opacity-50",
        hidden: "invisible",
        chevron: "fill-current size-4",
        ...classNames,
      }}
      {...props}
    />
  );
}
