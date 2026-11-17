export function dayCycleLabel(state: string): string {
  switch (state) {
    case "secure_due":
      return "Secure due";
    case "late_secure_required":
      return "Late secure";
    case "reopen_due":
      return "Reopen due";
    case "cleared":
      return "Cleared today";
    case "failed_reopen":
      return "Failed reopen";
    case "override_used":
      return "Override used";
    case "closed_path":
      return "Final day";
    default:
      return state.replace(/_/g, " ");
  }
}

/** Prefer warning/danger tones for blocking states. */
export function dayCycleTone(
  state: string,
): "warning" | "danger" | "success" | "info" {
  if (state === "late_secure_required" || state === "failed_reopen") return "danger";
  if (state === "cleared") return "success";
  if (state === "override_used" || state === "secure_due" || state === "reopen_due") {
    return "warning";
  }
  return "info";
}

export function dayCycleJob(
  state: string,
): "secure" | "reopen" | "progress" | "extend" | "handover" {
  if (state === "late_secure_required" || state === "secure_due" || state === "closed_path") {
    return "secure";
  }
  if (state === "reopen_due" || state === "failed_reopen" || state === "override_used") {
    return "reopen";
  }
  return "progress";
}
