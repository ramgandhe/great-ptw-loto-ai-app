"use client";

import { useEffect, useState } from "react";
import { AppSelect } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { FormField, fieldClassName } from "./form-field";
import { MasterDataSelect } from "./master-data-select";
import { formatWorkforceOptionLabel } from "@/components/lototo/select-field";
import type { LototoProcedureListItem } from "@/lib/lototo/types";
import {
  certificateStatusLabel,
  listIsolationCertificates,
  type IsolationCertificateListRow,
} from "@/lib/lototo/certificates";
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
    <AppSelect
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
    </AppSelect>
  );
}

export function LototoAttachFields({
  item,
  index,
  procedures,
  people,
  disabled,
  onChange,
  onRemove,
}: {
  item: PermitLototoInput;
  index: number;
  procedures: LototoProcedureListItem[];
  people: WorkforceRecord[];
  disabled: boolean;
  onChange: (next: PermitLototoInput) => void;
  onRemove: () => void;
}) {
  const [certificates, setCertificates] = useState<IsolationCertificateListRow[]>([]);
  useEffect(() => {
    let cancelled = false;
    void listIsolationCertificates()
      .then((rows) => {
        if (!cancelled) setCertificates(rows);
      })
      .catch(() => {
        if (!cancelled) setCertificates([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const matches = certificates.filter(
    (row) => row.certificate.procedureId === item.procedureId && row.certificate.status !== "closed",
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
                certificateId: "",
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

      {item.procedureId ? (
        <FormField label="Existing isolation" htmlFor={`lototo-certificate-${index}`}>
          <AppSelect
            id={`lototo-certificate-${index}`}
            className={fieldClassName}
            value={item.certificateId ?? ""}
            disabled={disabled}
            onChange={(event) => onChange({ ...item, certificateId: event.target.value })}
          >
            <option value="">Create a new isolation when this permit is approved</option>
            {matches.map((row) => (
              <option key={row.certificate.id} value={row.certificate.id}>
                {row.certificate.certificateNumber} · {certificateStatusLabel(row.certificate.status)} · {row.certificate.title}
              </option>
            ))}
          </AppSelect>
          <p className="text-xs text-muted-foreground">
            Pick an existing isolation to share it. Apply steps already passed stay passed; this permit adds its own personal lock. Extra points are recorded on the isolation by the isolator.
          </p>
        </FormField>
      ) : null}

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
    </div>
  );
}
