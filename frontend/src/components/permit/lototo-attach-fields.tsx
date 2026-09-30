"use client";

import { Button } from "@/components/ui/button";
import { FormField, fieldClassName } from "./form-field";
import { MasterDataSelect } from "./master-data-select";
import { formatWorkforceOptionLabel } from "@/components/lototo/select-field";
import type { LototoProcedure, LototoProcedureListItem } from "@/lib/lototo/types";
import { emptyLototoExtraPoint } from "@/lib/permit/form";
import type { PermitLototoInput } from "@/lib/permit/types";
import type { WorkforceRecord } from "@/lib/workforce/types";
import { X } from "lucide-react";

function PersonSelect({
  id,
  value,
  disabled,
  options,
  onChange,
  placeholder,
}: {
  id: string;
  value: string;
  disabled: boolean;
  options: WorkforceRecord[];
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <select
      id={id}
      className={fieldClassName}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="">{placeholder}</option>
      {options.map((person) => (
        <option key={person.id} value={person.id}>
          {formatWorkforceOptionLabel(person)}
        </option>
      ))}
    </select>
  );
}

export function LototoAttachFields({
  item,
  index,
  procedures,
  detail,
  people,
  disabled,
  onChange,
  onRemove,
}: {
  item: PermitLototoInput;
  index: number;
  procedures: LototoProcedureListItem[];
  detail: LototoProcedure | undefined;
  people: WorkforceRecord[];
  disabled: boolean;
  onChange: (next: PermitLototoInput) => void;
  onRemove: () => void;
}) {
  const basePoints = detail?.publishedVersion?.lockoutPoints ?? [];
  const naBase = new Map(
    item.stepNa.filter((row) => row.basePointId).map((row) => [row.basePointId, row]),
  );
  const naExtra = new Map(
    item.stepNa.filter((row) => row.extraPointCode).map((row) => [row.extraPointCode, row]),
  );

  return (
    <div className="grid gap-4 rounded-xl border border-border p-4">
      <div className="flex items-end gap-2">
        <FormField label="LOTOTO procedure" htmlFor={`lototo-${index}`} className="flex-1">
          <MasterDataSelect
            id={`lototo-${index}`}
            value={item.procedureId}
            options={procedures.map((procedure) => ({
              id: procedure.id,
              name: procedure.title,
              code: procedure.code,
            }))}
            disabled={disabled}
            placeholder="Select published procedure"
            onChange={(procedureId) =>
              onChange({
                ...item,
                procedureId,
                extraPoints: [],
                stepNa: [],
              })
            }
          />
        </FormField>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={disabled}
          aria-label="Remove LOTOTO procedure"
          onClick={onRemove}
          className="shrink-0 text-muted-foreground hover:text-destructive"
        >
          <X aria-hidden />
        </Button>
      </div>

      {item.procedureId && basePoints.length > 0 ? (
        <div className="grid gap-2">
          <p className="text-sm font-medium">Base isolation points</p>
          <p className="text-xs text-muted-foreground">Procedure text cannot be changed. Mark N/A only with a reason.</p>
          {basePoints.map((point) => {
            const na = naBase.get(point.id ?? "");
            return (
              <div key={point.id ?? point.pointCode} className="grid gap-2 rounded-lg border border-border p-3">
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1"
                    disabled={disabled}
                    checked={Boolean(na)}
                    onChange={(event) => {
                      const next = item.stepNa.filter((row) => row.basePointId !== point.id);
                      if (event.target.checked && point.id) {
                        next.push({ basePointId: point.id, extraPointCode: "", reason: "" });
                      }
                      onChange({ ...item, stepNa: next });
                    }}
                  />
                  <span>
                    <span className="font-medium">{point.pointCode}</span>
                    {point.action ? ` — ${point.action}` : ""}
                    <span className="block text-muted-foreground">{point.energyType}</span>
                  </span>
                </label>
                {na ? (
                  <FormField label="N/A reason" htmlFor={`na-${index}-${point.id}`}>
                    <input
                      id={`na-${index}-${point.id}`}
                      className={fieldClassName}
                      disabled={disabled}
                      value={na.reason}
                      onChange={(event) =>
                        onChange({
                          ...item,
                          stepNa: item.stepNa.map((row) =>
                            row.basePointId === point.id ? { ...row, reason: event.target.value } : row,
                          ),
                        })
                      }
                    />
                  </FormField>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}

      <div className="grid gap-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Extra isolation points</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || !item.procedureId}
            onClick={() =>
              onChange({
                ...item,
                extraPoints: [
                  ...item.extraPoints,
                  {
                    ...emptyLototoExtraPoint(),
                    pointCode: `EXTRA-${item.extraPoints.length + 1}`,
                  },
                ],
              })
            }
          >
            Add extra point
          </Button>
        </div>
        {item.extraPoints.map((point, extraIndex) => {
          const na = naExtra.get(point.pointCode);
          return (
            <div key={`extra-${index}-${extraIndex}`} className="grid gap-2 rounded-lg border border-border p-3 md:grid-cols-2">
              <FormField label="Point code" htmlFor={`extra-code-${index}-${extraIndex}`}>
                <input
                  id={`extra-code-${index}-${extraIndex}`}
                  className={fieldClassName}
                  disabled={disabled}
                  value={point.pointCode}
                  onChange={(event) => {
                    const extraPoints = [...item.extraPoints];
                    extraPoints[extraIndex] = { ...point, pointCode: event.target.value };
                    onChange({
                      ...item,
                      extraPoints,
                      stepNa: item.stepNa.map((row) =>
                        row.extraPointCode === point.pointCode
                          ? { ...row, extraPointCode: event.target.value }
                          : row,
                      ),
                    });
                  }}
                />
              </FormField>
              <FormField label="Energy type" htmlFor={`extra-energy-${index}-${extraIndex}`}>
                <input
                  id={`extra-energy-${index}-${extraIndex}`}
                  className={fieldClassName}
                  disabled={disabled}
                  value={point.energyType}
                  onChange={(event) => {
                    const extraPoints = [...item.extraPoints];
                    extraPoints[extraIndex] = { ...point, energyType: event.target.value };
                    onChange({ ...item, extraPoints });
                  }}
                />
              </FormField>
              <FormField label="Location" htmlFor={`extra-loc-${index}-${extraIndex}`} className="md:col-span-2">
                <input
                  id={`extra-loc-${index}-${extraIndex}`}
                  className={fieldClassName}
                  disabled={disabled}
                  value={point.locationText}
                  onChange={(event) => {
                    const extraPoints = [...item.extraPoints];
                    extraPoints[extraIndex] = { ...point, locationText: event.target.value };
                    onChange({ ...item, extraPoints });
                  }}
                />
              </FormField>
              <FormField label="Action" htmlFor={`extra-action-${index}-${extraIndex}`} className="md:col-span-2">
                <input
                  id={`extra-action-${index}-${extraIndex}`}
                  className={fieldClassName}
                  disabled={disabled}
                  value={point.action}
                  onChange={(event) => {
                    const extraPoints = [...item.extraPoints];
                    extraPoints[extraIndex] = { ...point, action: event.target.value };
                    onChange({ ...item, extraPoints });
                  }}
                />
              </FormField>
              <label className="flex items-center gap-2 text-sm md:col-span-2">
                <input
                  type="checkbox"
                  disabled={disabled || !point.pointCode}
                  checked={Boolean(na)}
                  onChange={(event) => {
                    const next = item.stepNa.filter((row) => row.extraPointCode !== point.pointCode);
                    if (event.target.checked) {
                      next.push({ basePointId: "", extraPointCode: point.pointCode, reason: "" });
                    }
                    onChange({ ...item, stepNa: next });
                  }}
                />
                N/A
              </label>
              {na ? (
                <FormField label="N/A reason" htmlFor={`extra-na-${index}-${extraIndex}`} className="md:col-span-2">
                  <input
                    id={`extra-na-${index}-${extraIndex}`}
                    className={fieldClassName}
                    disabled={disabled}
                    value={na.reason}
                    onChange={(event) =>
                      onChange({
                        ...item,
                        stepNa: item.stepNa.map((row) =>
                          row.extraPointCode === point.pointCode ? { ...row, reason: event.target.value } : row,
                        ),
                      })
                    }
                  />
                </FormField>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={disabled}
                className="justify-self-start text-destructive"
                onClick={() =>
                  onChange({
                    ...item,
                    extraPoints: item.extraPoints.filter((_, i) => i !== extraIndex),
                    stepNa: item.stepNa.filter((row) => row.extraPointCode !== point.pointCode),
                  })
                }
              >
                Remove extra point
              </Button>
            </div>
          );
        })}
      </div>

      <div className="grid gap-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Isolation crew</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={() => onChange({ ...item, crew: [...item.crew, { workforceUserId: "" }] })}
          >
            Add crew
          </Button>
        </div>
        {item.crew.map((row, crewIndex) => (
          <div key={`crew-${index}-${crewIndex}`} className="flex items-end gap-2">
            <FormField label="Crew member" htmlFor={`crew-${index}-${crewIndex}`} className="flex-1">
              <PersonSelect
                id={`crew-${index}-${crewIndex}`}
                value={row.workforceUserId}
                disabled={disabled}
                options={people}
                placeholder="Select crew"
                onChange={(workforceUserId) => {
                  const crew = [...item.crew];
                  crew[crewIndex] = { workforceUserId };
                  onChange({ ...item, crew });
                }}
              />
            </FormField>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={disabled || item.crew.length === 1}
              aria-label="Remove crew member"
              onClick={() => onChange({ ...item, crew: item.crew.filter((_, i) => i !== crewIndex) })}
              className="shrink-0 text-muted-foreground hover:text-destructive"
            >
              <X aria-hidden />
            </Button>
          </div>
        ))}
      </div>

      <div className="grid gap-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Verifiers</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={() => onChange({ ...item, verifiers: [...item.verifiers, { workforceUserId: "" }] })}
          >
            Add verifier
          </Button>
        </div>
        {item.verifiers.map((row, verifierIndex) => (
          <div key={`verifier-${index}-${verifierIndex}`} className="flex items-end gap-2">
            <FormField label="Verifier" htmlFor={`verifier-${index}-${verifierIndex}`} className="flex-1">
              <PersonSelect
                id={`verifier-${index}-${verifierIndex}`}
                value={row.workforceUserId}
                disabled={disabled}
                options={people}
                placeholder="Select verifier"
                onChange={(workforceUserId) => {
                  const verifiers = [...item.verifiers];
                  verifiers[verifierIndex] = { workforceUserId };
                  onChange({ ...item, verifiers });
                }}
              />
            </FormField>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={disabled || item.verifiers.length === 1}
              aria-label="Remove verifier"
              onClick={() =>
                onChange({ ...item, verifiers: item.verifiers.filter((_, i) => i !== verifierIndex) })
              }
              className="shrink-0 text-muted-foreground hover:text-destructive"
            >
              <X aria-hidden />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
