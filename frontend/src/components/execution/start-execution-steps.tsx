"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { PermitLototoExecution } from "@/components/permit/lototo-execution";
import type { PermitDetail } from "@/lib/permit/types";
import type { HazardRecord } from "@/lib/master-data/api";
import type { PermitFormState } from "@/lib/permit/types";
import { hazardControlKey, type ExecutionStartState } from "@/lib/execution/start";
import { permitControlLines } from "@/lib/permit/form";

const STEPS = [
  { id: "toolbox", label: "Toolbox talk" },
  { id: "location", label: "Location safety" },
  { id: "workers", label: "Worker readiness" },
  { id: "lototo", label: "Verify LOTOTO" },
  { id: "gas", label: "Verify gas testing" },
  { id: "work", label: "Work" },
] as const;

function toggle(list: string[], id: string, on: boolean) {
  return on ? [...new Set([...list, id])] : list.filter((item) => item !== id);
}

function gasReadingKey(row: { id: string; gasTestingCatalogueId: string | null }) {
  return row.gasTestingCatalogueId ?? row.id;
}

export function StartExecutionSteps({
  permitId,
  detail,
  form,
  hazards,
  ppeNames,
  lototoIsolated,
  start,
  isSubmitting,
  onChange,
  onSave,
  onBeginWork,
}: {
  permitId: string;
  detail: PermitDetail;
  form: PermitFormState;
  hazards: Map<string, HazardRecord>;
  ppeNames: Map<string, string>;
  lototoIsolated: boolean;
  start: ExecutionStartState;
  isSubmitting: boolean;
  onChange: (next: ExecutionStartState) => void;
  onSave: () => Promise<void>;
  onBeginWork: () => Promise<void>;
}) {
  const [step, setStep] = useState(0);
  const lototoRequired = Boolean(detail.permit.lototoRequired);
  const gasRequired = Boolean(detail.permit.gasTestingRequired);

  const locationItems = useMemo(() => {
    return form.hazards
      .filter((row) => row.hazardCategoryId)
      .flatMap((row) => {
        const catalogue = hazards.get(row.hazardCategoryId);
        const controls = permitControlLines(catalogue?.controls, row.extraControls, row.omittedControls);
        if (controls.length === 0) {
          return [{ key: hazardControlKey(row.hazardCategoryId), label: catalogue?.name ?? "Hazard" }];
        }
        return controls.map((control) => ({
          key: hazardControlKey(row.hazardCategoryId, control),
          label: `${catalogue?.name ?? "Hazard"} — ${control}`,
        }));
      });
  }, [form.hazards, hazards]);

  const ppeItems = form.ppe.filter((row) => row.ppeCatalogueId);
  const locationDone = locationItems.every((item) => start.hazardControls.includes(item.key));
  const ppeDone = ppeItems.every((item) => start.ppeIds.includes(item.ppeCatalogueId));
  const lototoDone = !lototoRequired || lototoIsolated || start.lototoVerified;
  const gasItems = detail.gasTesting.filter((row) => !row.removedReason?.trim());
  const gasDone =
    !gasRequired ||
    gasItems.every((row) => {
      const reading = start.gasReadings.find((item) => item.gasTestingCatalogueId === gasReadingKey(row));
      if (!reading || Number.isNaN(reading.value)) return false;
      if (row.minimum != null && reading.value < row.minimum) return false;
      if (row.maximum != null && reading.value > row.maximum) return false;
      return true;
    });

  const canAdvance = [
    start.toolboxTalk,
    locationDone,
    ppeDone,
    lototoDone,
    gasDone,
    true,
  ][step];

  async function goNext() {
    await onSave();
    setStep((current) => Math.min(current + 1, STEPS.length - 1));
  }

  return (
    <section className="grid gap-4 rounded-xl border border-border bg-card p-4">
      <div>
        <h2 className="text-sm font-semibold">Start Permit Execution</h2>
        <ol className="mt-2 flex flex-wrap gap-2 text-xs">
          {STEPS.map((item, index) => (
            <li
              key={item.id}
              className={index === step ? "font-semibold text-foreground" : "text-muted-foreground"}
            >
              {index + 1}. {item.label}
            </li>
          ))}
        </ol>
      </div>

      {step === 0 ? (
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={start.toolboxTalk}
            onChange={(event) => onChange({ ...start, toolboxTalk: event.target.checked })}
          />
          Toolbox talk completed with the crew
        </label>
      ) : null}

      {step === 1 ? (
        locationItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">No assigned hazard controls. Continue.</p>
        ) : (
          <div className="grid gap-2">
            {locationItems.map((item) => (
              <label key={item.key} className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={start.hazardControls.includes(item.key)}
                  onChange={(event) =>
                    onChange({ ...start, hazardControls: toggle(start.hazardControls, item.key, event.target.checked) })
                  }
                />
                {item.label}
              </label>
            ))}
          </div>
        )
      ) : null}

      {step === 2 ? (
        ppeItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">No assigned PPE. Continue.</p>
        ) : (
          <div className="grid gap-2">
            {ppeItems.map((item) => (
              <label key={item.ppeCatalogueId} className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={start.ppeIds.includes(item.ppeCatalogueId)}
                  onChange={(event) =>
                    onChange({ ...start, ppeIds: toggle(start.ppeIds, item.ppeCatalogueId, event.target.checked) })
                  }
                />
                {ppeNames.get(item.ppeCatalogueId) ?? "PPE"}
                {item.quantity && item.quantity > 1 ? ` × ${item.quantity}` : ""}
              </label>
            ))}
          </div>
        )
      ) : null}

      {step === 3 ? (
        lototoRequired ? (
          <PermitLototoExecution
            permitId={permitId}
            onBoardChange={(board) => onChange({ ...start, lototoVerified: board.isolated })}
          />
        ) : (
          <p className="text-sm text-muted-foreground">LOTOTO is not required for this permit (N/A).</p>
        )
      ) : null}

      {step === 4 ? (
        gasRequired ? (
          gasItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">No gas tests on this permit. Continue.</p>
          ) : (
            <div className="grid gap-3">
              {gasItems.map((row) => {
                const key = gasReadingKey(row);
                const reading = start.gasReadings.find((item) => item.gasTestingCatalogueId === key);
                const outOfRange =
                  reading != null &&
                  ((row.minimum != null && reading.value < row.minimum) ||
                    (row.maximum != null && reading.value > row.maximum));
                const range =
                  row.minimum != null && row.maximum != null
                    ? `${row.minimum}–${row.maximum}${row.unit ? ` ${row.unit}` : ""}`
                    : "";
                return (
                  <label key={key} className="grid gap-1 text-sm">
                    <span>
                      {row.parameter || "Gas test"}
                      {row.unit ? ` (${row.unit})` : ""}
                      {range ? `, ${range}` : ""}
                    </span>
                    <input
                      type="number"
                      step="any"
                      value={reading?.value ?? ""}
                      onChange={(event) => {
                        const value = event.target.value === "" ? Number.NaN : Number(event.target.value);
                        onChange({
                          ...start,
                          gasReadings: [
                            ...start.gasReadings.filter((item) => item.gasTestingCatalogueId !== key),
                            { gasTestingCatalogueId: key, value },
                          ].filter((item) => !Number.isNaN(item.value)),
                        });
                      }}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                    {outOfRange ? (
                      <span className="text-destructive">Enter a value inside {range}.</span>
                    ) : null}
                  </label>
                );
              })}
            </div>
          )
        ) : (
          <p className="text-sm text-muted-foreground">Gas testing is not required for this permit (N/A).</p>
        )
      ) : null}

      {step === 5 ? (
        <p className="text-sm">
          {detail.permit.workScope?.trim() || "Begin the work described on this permit and record progress."}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {step > 0 ? (
          <Button type="button" variant="outline" onClick={() => setStep((current) => current - 1)} disabled={isSubmitting}>
            Back
          </Button>
        ) : null}
        {step < STEPS.length - 1 ? (
          <Button type="button" onClick={() => void goNext()} disabled={isSubmitting || !canAdvance}>
            Next
          </Button>
        ) : (
          <Button type="button" onClick={() => void onBeginWork()} disabled={isSubmitting || !canAdvance}>
            {isSubmitting ? "Starting..." : "Begin work"}
          </Button>
        )}
      </div>
    </section>
  );
}
