import { useState } from "react";
import type { VerificationChecklist } from "@/lib/closure/types";
import { VerificationEvidenceCapture } from "@/components/common/verification-evidence-capture";

const checklistItems: Array<{ key: keyof VerificationChecklist; label: string }> = [
  { key: "workCompleted", label: "Work has been completed as described in the permit" },
  { key: "evidenceReviewed", label: "Execution evidence has been reviewed" },
  { key: "areaSecured", label: "Work area has been secured" },
  { key: "hazardsRemoved", label: "Temporary hazards and controls have been removed" },
];

type VerificationChecklistProps = {
  value: VerificationChecklist;
  disabled?: boolean;
  hasExistingEvidence?: boolean;
  onChange: (value: VerificationChecklist) => void;
};

export function VerificationChecklistPanel({
  value,
  disabled = false,
  hasExistingEvidence = false,
  onChange,
}: VerificationChecklistProps) {
  const [itemEvidences, setItemEvidences] = useState<Record<string, File | null>>({});

  return (
    <ul className="grid gap-3">
      {checklistItems.map((item) => {
        const checked = value[item.key];
        const isEvidenceReviewed = item.key === "evidenceReviewed";

        return (
          <li key={item.key} className="grid gap-1">
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={checked}
                disabled={disabled}
                onChange={(event) =>
                  onChange({ ...value, [item.key]: event.target.checked })
                }
                className="mt-0.5"
              />
              <span>{item.label}</span>
            </label>

            {/* N-19: Warn only if evidence reviewed is checked but no evidence on permit */}
            {isEvidenceReviewed && checked && !hasExistingEvidence ? (
              <div
                role="status"
                className="mt-1.5 rounded border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-200"
              >
                Notice: No execution evidence files were found on this permit. You can still proceed if offline or physical evidence was inspected.
              </div>
            ) : null}

            {/* N-16, N-17, N-18: Offer upload on check for other items */}
            {!isEvidenceReviewed ? (
              <VerificationEvidenceCapture
                visible={checked}
                label={`Evidence for "${item.label}"`}
                file={itemEvidences[item.key] ?? null}
                onFileChange={(file) =>
                  setItemEvidences((prev) => ({ ...prev, [item.key]: file }))
                }
                disabled={disabled}
              />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

export function isChecklistComplete(checklist: VerificationChecklist): boolean {
  return Object.values(checklist).every(Boolean);
}

export const defaultVerificationChecklist: VerificationChecklist = {
  workCompleted: false,
  evidenceReviewed: false,
  areaSecured: false,
  hazardsRemoved: false,
};
