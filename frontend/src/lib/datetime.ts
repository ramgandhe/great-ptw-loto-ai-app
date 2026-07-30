const LOCAL_DATETIME_PATTERN = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/;

export function parseLocalDateTime(value: string): { date: string; time: string } {
  const match = value.match(LOCAL_DATETIME_PATTERN);
  if (!match) {
    return { date: "", time: "" };
  }
  return { date: match[1], time: match[2] };
}

export function combineLocalDateTime(date: string, time: string): string {
  if (!date || !time) {
    return "";
  }
  return `${date}T${time}`;
}

export function compareLocalDateTimes(a: string, b: string): number {
  if (!a || !b) {
    return 0;
  }
  return a.localeCompare(b);
}

export function addMinutesToLocalDateTime(value: string, minutes: number): string {
  const { date, time } = parseLocalDateTime(value);
  if (!date || !time) {
    return value;
  }

  const [year, month, day] = date.split("-").map(Number);
  const [hours, mins] = time.split(":").map(Number);
  const next = new Date(year, month - 1, day, hours, mins + minutes);
  return formatLocalDateTime(next);
}

export function formatLocalDateTime(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function formatLocalDateTimeLabel(value: string): string {
  const { date, time } = parseLocalDateTime(value);
  if (!date || !time) {
    return "";
  }

  const [year, month, day] = date.split("-").map(Number);
  const parsed = new Date(year, month - 1, day);
  const dateLabel = parsed.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return `${dateLabel}, ${time}`;
}

export function buildTimeOptions(intervalMinutes = 15): string[] {
  const options: string[] = [];
  for (let hour = 0; hour < 24; hour += 1) {
    for (let minute = 0; minute < 60; minute += intervalMinutes) {
      options.push(
        `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
      );
    }
  }
  return options;
}

export function getAvailableTimeOptions(value: string, minValue?: string): string[] {
  const all = buildTimeOptions();
  if (!minValue) {
    return all;
  }

  const { date } = parseLocalDateTime(value);
  const min = parseLocalDateTime(minValue);
  if (!date || !min.date || date !== min.date || !min.time) {
    return all;
  }

  return all.filter((time) => time > min.time);
}

export function toDateOnly(value: string): string {
  return parseLocalDateTime(value).date;
}

export function isDateBefore(date: string, minDate: string): boolean {
  if (!date || !minDate) {
    return false;
  }
  return date < minDate;
}

export type CalendarDay = {
  date: string;
  day: number;
  inMonth: boolean;
};

export function getCalendarMonthDays(year: number, month: number): CalendarDay[] {
  const firstDay = new Date(year, month, 1);
  const startOffset = firstDay.getDay();
  const gridStart = new Date(year, month, 1 - startOffset);
  const days: CalendarDay[] = [];

  for (let index = 0; index < 42; index += 1) {
    const current = new Date(gridStart);
    current.setDate(gridStart.getDate() + index);
    const date = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}-${String(current.getDate()).padStart(2, "0")}`;
    days.push({
      date,
      day: current.getDate(),
      inMonth: current.getMonth() === month,
    });
  }

  return days;
}

export function ensureEndAfterStart(start: string, end: string): string {
  if (!start || !end || compareLocalDateTimes(end, start) > 0) {
    return end;
  }
  return addMinutesToLocalDateTime(start, 60);
}
