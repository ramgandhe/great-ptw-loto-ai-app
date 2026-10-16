import { ApiError } from "@/lib/api";
import { confirmAction } from "@/components/ui/confirm-dialog";

function assignmentLines(details: unknown): string[] {
  return Array.isArray(details) ? details.map(String).filter(Boolean) : [];
}

/** First confirm delete; if the API reports assignments, confirm Delete anyway, then retry with force. */
export async function deleteWithAssignmentConfirm(
  name: string,
  run: (force: boolean) => Promise<void>,
): Promise<boolean> {
  if (!(await confirmAction(`Permanently delete ${name}? This cannot be undone.`))) {
    return false;
  }
  try {
    await run(false);
    return true;
  } catch (error) {
    if (!(error instanceof ApiError) || error.code !== "IN_USE") {
      throw error;
    }
    const lines = assignmentLines(error.details);
    const extra = lines.length ? `\n\n${lines.map((line) => `• ${line}`).join("\n")}` : "";
    if (
      !(await confirmAction(
        `${name} is assigned to other records.${extra}\n\nDelete anyway? Historical records stay.`,
      ))
    ) {
      return false;
    }
    await run(true);
    return true;
  }
}

export function forceQuery(force: boolean): string {
  return force ? "?force=true" : "";
}
