"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Calendar } from "lucide-react";
import {
  combineLocalDateTime,
  formatLocalDateTimeLabel,
  getAvailableTimeOptions,
  getCalendarMonthDays,
  isDateBefore,
  parseLocalDateTime,
  toDateOnly,
} from "@/lib/datetime";
import { cn } from "@/lib/utils";
import { fieldClassName } from "./form-field";

type PlannedDateTimeFieldProps = {
  id: string;
  value: string;
  disabled?: boolean;
  minValue?: string;
  onChange: (value: string) => void;
};

const MONTH_LABELS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function PlannedDateTimeField({
  id,
  value,
  disabled,
  minValue,
  onChange,
}: PlannedDateTimeFieldProps) {
  const listboxId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const { date, time } = parseLocalDateTime(value);
  const minDate = minValue ? toDateOnly(minValue) : "";
  const timeOptions = getAvailableTimeOptions(value || combineLocalDateTime(date, "00:00"), minValue);

  const initial = date ? new Date(`${date}T00:00:00`) : new Date();
  const [viewYear, setViewYear] = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth());

  useEffect(() => {
    if (!date) {
      return;
    }
    const parsed = new Date(`${date}T00:00:00`);
    setViewYear(parsed.getFullYear());
    setViewMonth(parsed.getMonth());
  }, [date]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    if (open) {
      document.addEventListener("mousedown", handlePointerDown);
      return () => document.removeEventListener("mousedown", handlePointerDown);
    }
  }, [open]);

  function updateDate(nextDate: string) {
    const nextTime = time && timeOptions.includes(time) ? time : timeOptions[0] ?? "08:00";
    onChange(combineLocalDateTime(nextDate, nextTime));
    setOpen(false);
  }

  function updateTime(nextTime: string) {
    if (!date) {
      const fallbackDate = minDate || formatLocalDate(new Date());
      onChange(combineLocalDateTime(fallbackDate, nextTime));
      return;
    }
    onChange(combineLocalDateTime(date, nextTime));
  }

  const days = getCalendarMonthDays(viewYear, viewMonth);

  return (
    <div ref={containerRef} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_8.5rem]">
      <div className="relative">
        <button
          id={id}
          type="button"
          disabled={disabled}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={listboxId}
          className={cn(
            fieldClassName,
            "flex items-center justify-between gap-2 text-left",
            !value && "text-muted-foreground",
          )}
          onClick={() => setOpen((current) => !current)}
        >
          <span>{value ? formatLocalDateTimeLabel(value) : "Select date"}</span>
          <Calendar className="size-4 shrink-0 opacity-70" aria-hidden />
        </button>

        {open ? (
          <div
            id={listboxId}
            role="dialog"
            aria-label="Choose date"
            className="absolute left-0 top-[calc(100%+0.25rem)] z-50 w-[18rem] rounded-lg border border-border bg-popover p-3 shadow-md"
          >
            <div className="mb-3 flex items-center justify-between">
              <button
                type="button"
                className="rounded-md px-2 py-1 text-sm hover:bg-muted"
                onClick={() => {
                  if (viewMonth === 0) {
                    setViewMonth(11);
                    setViewYear((year) => year - 1);
                    return;
                  }
                  setViewMonth((month) => month - 1);
                }}
              >
                ‹
              </button>
              <p className="text-sm font-medium">
                {MONTH_LABELS[viewMonth]} {viewYear}
              </p>
              <button
                type="button"
                className="rounded-md px-2 py-1 text-sm hover:bg-muted"
                onClick={() => {
                  if (viewMonth === 11) {
                    setViewMonth(0);
                    setViewYear((year) => year + 1);
                    return;
                  }
                  setViewMonth((month) => month + 1);
                }}
              >
                ›
              </button>
            </div>

            <div className="mb-1 grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
              {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((label) => (
                <span key={label}>{label}</span>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {days.map((day) => {
                const disabledDay =
                  !day.inMonth || (minDate ? isDateBefore(day.date, minDate) : false);
                const selected = day.date === date;

                return (
                  <button
                    key={day.date}
                    type="button"
                    disabled={disabledDay}
                    className={cn(
                      "h-8 rounded-md text-sm",
                      day.inMonth ? "text-foreground" : "text-muted-foreground/40",
                      selected && "bg-primary text-primary-foreground",
                      !selected && day.inMonth && !disabledDay && "hover:bg-muted",
                      disabledDay && "cursor-not-allowed opacity-40",
                    )}
                    onClick={() => updateDate(day.date)}
                  >
                    {day.day}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>

      <select
        aria-label="Time"
        className={fieldClassName}
        value={time}
        disabled={disabled || !date}
        onChange={(event) => updateTime(event.target.value)}
      >
        <option value="">{date ? "Time" : "Pick date first"}</option>
        {timeOptions.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
