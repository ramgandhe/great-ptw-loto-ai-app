import { AlertTriangle } from "lucide-react";

export function DraftBanner() {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-300" />
      <div>
        <p className="font-medium text-amber-800 dark:text-amber-200">Draft permit</p>
        <p className="text-amber-700/90 dark:text-amber-100/80">
          Changes are saved as a draft until you submit for approval.
        </p>
      </div>
    </div>
  );
}
