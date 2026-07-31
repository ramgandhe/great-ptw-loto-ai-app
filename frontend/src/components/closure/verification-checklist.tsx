import type { VerificationChecklist } from "@/lib/closure/types";

const checklistItems: Array<{ key: keyof VerificationChecklist; label: string }> = [
  { key: "workCompleted", label: "Work has been completed as described in the permit" },
  { key: "evidenceReviewed", label: "Execution evidence has been reviewed" },
  { key: "areaSecured", label: "Work area has been secured" },
  { key: "hazardsRemoved", label: "Temporary hazards and controls have been removed" },
];

type VerificationChecklistProps = {
  value: VerificationChecklist;
  disabled?: boolean;
  onChange: (value: VerificationChecklist) => void;
};

export function VerificationChecklistPanel({
  value,
  disabled = false,
  onChange,
}: VerificationChecklistProps) {
  return (
    <ul className="grid gap-2">
      {checklistItems.map((item) => (
        <li key={item.key}>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={value[item.key]}
              disabled={disabled}
              onChange={(event) =>
                onChange({ ...value, [item.key]: event.target.checked })
              }
              className="mt-0.5"
            />
            <span>{item.label}</span>
          </label>
        </li>
      ))}
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
