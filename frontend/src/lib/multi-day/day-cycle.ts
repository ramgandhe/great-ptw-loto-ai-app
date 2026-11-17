export type DayCycleState =
  | "not_multi_day"
  | "secure_due"
  | "late_secure_required"
  | "reopen_due"
  | "cleared"
  | "failed_reopen"
  | "override_used"
  | "closed_path";

const LABELS: Record<DayCycleState, string> = {
  not_multi_day: "Single-day",
  secure_due: "Secure due",
  late_secure_required: "Late secure",
  reopen_due: "Reopen due",
  cleared: "Cleared today",
  failed_reopen: "Failed reopen",
  override_used: "Override used",
  closed_path: "Final day",
};

/** Map day-cycle states onto existing permit status colour tokens. */
const COLORS: Record<DayCycleState, string> = {
  not_multi_day: "var(--muted-foreground)",
  secure_due: "var(--st-pending_approval)",
  late_secure_required: "var(--st-rejected)",
  reopen_due: "var(--st-approved)",
  cleared: "var(--st-active)",
  failed_reopen: "var(--st-suspended)",
  override_used: "var(--st-deferred)",
  closed_path: "var(--st-execution_completed)",
};

const HASHES: Record<DayCycleState, string> = {
  not_multi_day: "progress",
  secure_due: "day-secure",
  late_secure_required: "late-secure",
  reopen_due: "reopen",
  cleared: "progress",
  failed_reopen: "reopen",
  override_used: "reopen",
  closed_path: "day-secure",
};

export function isDayCycleState(value: string): value is DayCycleState {
  return value in LABELS;
}

export function dayCycleLabel(state: string): string {
  return isDayCycleState(state) ? LABELS[state] : state.replace(/_/g, " ");
}

export function dayCycleColor(state: string): string {
  return isDayCycleState(state) ? COLORS[state] : "var(--muted-foreground)";
}

export function dayCycleHash(state: string): string {
  return isDayCycleState(state) ? HASHES[state] : "progress";
}

export function multiDayActionHref(permitId: string, _state: string): string {
  return `/permits/${permitId}?tab=work`;
}
