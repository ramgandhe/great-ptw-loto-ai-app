// Copy of frontend/src/lib/format.ts: dates read the same in the app and on the web.
/** Human-readable dates for operational screens (never raw ISO strings). */

const DAY_MS = 86_400_000;

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "Mon 10 Aug, 09:00" (year added when it isn't the current year). */
export function formatDateTime(value: string | Date | null | undefined): string {
  const date = toDate(value);
  if (!date) return "Not set";
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** "10 Aug 2026": calendar dates such as certificate expiry. Legacy free text is returned as typed. */
export function formatDate(value: string | null | undefined): string {
  const date = toDate(value);
  if (!date) return value ?? "";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** "10 Aug 09:00 to 25 Aug 16:00 (15 days)" or "Mon 10 Aug, 09:00 to 16:00" within one day. */
export function formatWindow(start: string | null | undefined, end: string | null | undefined): string {
  const from = toDate(start);
  const to = toDate(end);
  if (!from && !to) return "Schedule not set";
  if (!from || !to) return from ? `From ${formatDateTime(from)}` : `Until ${formatDateTime(to)}`;

  const time = (d: Date) => d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  if (from.toDateString() === to.toDateString()) {
    return `${formatDateTime(from)} to ${time(to)}`;
  }
  const short = (d: Date) =>
    `${d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} ${time(d)}`;
  const days = Math.max(1, Math.round((to.getTime() - from.getTime()) / DAY_MS));
  return `${short(from)} to ${short(to)} (${days} day${days === 1 ? "" : "s"})`;
}

/** "5 min ago", "in 3 h", "2 days ago", falling back to a date after a week. */
export function formatRelative(value: string | Date | null | undefined): string {
  const date = toDate(value);
  if (!date) return "";
  const diff = date.getTime() - Date.now();
  const abs = Math.abs(diff);
  const past = diff < 0;
  const fmt = (n: number, unit: string) => (past ? `${n} ${unit} ago` : `in ${n} ${unit}`);
  if (abs < 60_000) return past ? "just now" : "in a moment";
  if (abs < 3_600_000) return fmt(Math.round(abs / 60_000), "min");
  if (abs < DAY_MS) return fmt(Math.round(abs / 3_600_000), "h");
  if (abs < 7 * DAY_MS) {
    const n = Math.round(abs / DAY_MS);
    return fmt(n, n === 1 ? "day" : "days");
  }
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** "pending_approval" -> "Pending approval". */
export function formatStatus(status: string): string {
  const text = status.replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}
