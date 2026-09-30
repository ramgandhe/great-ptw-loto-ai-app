"use client";

import { useEffect, useMemo, useState } from "react";
import { ApiError } from "@/lib/api";
import { useAuthProfile } from "@/lib/auth/auth-profile-context";
import { hasAnyRole } from "@/lib/auth/rbac";
import { reassignPermitPeople } from "@/lib/permit/api";
import type { PermitDetail } from "@/lib/permit/types";
import { fieldClassName } from "@/components/permit/form-field";
import { Button } from "@/components/ui/button";
import { formatWorkforceOptionLabel } from "@/components/lototo/select-field";
import { listPermitExecutors, listWorkforceDirectory } from "@/lib/workforce/api";
import type { TenantUser, WorkforceRecord } from "@/lib/workforce/types";

const HOD_REASSIGN_ROLES = ["hod", "tenant-owner", "tenant-admin", "platform-admin"] as const;

function userLabel(person: TenantUser) {
  return formatWorkforceOptionLabel({
    name: person.name || person.username,
    email: person.email,
    role: person.roles[0] ?? null,
  });
}

export function PermitPeopleReassign({
  detail,
  onSaved,
}: {
  detail: PermitDetail;
  onSaved: (next: PermitDetail) => void;
}) {
  const { profile, roles } = useAuthProfile();
  const isHod = hasAnyRole(roles, HOD_REASSIGN_ROLES);
  const isExecutor = detail.executors.some((row) => row.workforceUserId === profile?.id);
  const canExecutors = isHod;
  const canLototo = isHod || isExecutor;

  const [executors, setExecutors] = useState(detail.executors.map((row) => row.workforceUserId));
  const [lototo, setLototo] = useState(
    detail.lototo.map((item) => ({
      procedureId: item.procedureId,
      title: item.procedureId,
      crew: item.crew.length ? item.crew.map((row) => row.workforceUserId) : [""],
      verifiers: item.verifiers.length ? item.verifiers.map((row) => row.workforceUserId) : [""],
    })),
  );
  const [executorOptions, setExecutorOptions] = useState<TenantUser[]>([]);
  const [people, setPeople] = useState<WorkforceRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listPermitExecutors().then(setExecutorOptions).catch(() => setExecutorOptions([]));
    listWorkforceDirectory().then(setPeople).catch(() => setPeople([]));
  }, []);

  const visible = detail.permit.status === "approved" && (canExecutors || canLototo);
  const names = useMemo(() => {
    const map = new Map<string, string>();
    for (const person of people) {
      map.set(person.id, formatWorkforceOptionLabel(person));
    }
    for (const person of executorOptions) {
      map.set(person.id, userLabel(person));
    }
    return map;
  }, [people, executorOptions]);

  if (!visible) {
    return null;
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const payload: Parameters<typeof reassignPermitPeople>[1] = {};
      if (canExecutors) {
        const ids = executors.filter(Boolean);
        if (!ids.length) {
          setError("Assign at least one job executor.");
          setSaving(false);
          return;
        }
        payload.executors = ids.map((workforceUserId, index) => ({
          workforceUserId,
          isPrimary: index === 0,
        }));
      }
      if (canLototo && lototo.length) {
        for (const item of lototo) {
          if (!item.crew.some(Boolean) || !item.verifiers.some(Boolean)) {
            setError("Each LOTOTO procedure needs at least one crew member and one verifier.");
            setSaving(false);
            return;
          }
        }
        payload.lototo = lototo.map((item) => ({
          procedureId: item.procedureId,
          crew: item.crew.filter(Boolean).map((workforceUserId) => ({ workforceUserId })),
          verifiers: item.verifiers.filter(Boolean).map((workforceUserId) => ({ workforceUserId })),
        }));
      }
      onSaved(await reassignPermitPeople(detail.permit.id, payload));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "People could not be reassigned.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="grid gap-3 rounded-xl border border-border bg-card p-5">
      <div>
        <h2 className="text-lg font-semibold">Reassign people</h2>
        <p className="text-sm text-muted-foreground">
          Optional until work starts. The same person can be on LOTOTO crew and a verifier.
        </p>
      </div>
      {canExecutors ? (
        <div className="grid gap-2">
          <p className="text-sm font-medium">Job executors</p>
          {executors.map((id, index) => (
            <select
              key={`ex-${index}`}
              className={fieldClassName}
              value={id}
              onChange={(event) =>
                setExecutors((current) => current.map((row, i) => (i === index ? event.target.value : row)))
              }
            >
              <option value="">Select executor</option>
              {executorOptions.map((person) => (
                <option key={person.id} value={person.id}>
                  {names.get(person.id) ?? userLabel(person)}
                </option>
              ))}
            </select>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => setExecutors((current) => [...current, ""])}>
            Add executor
          </Button>
        </div>
      ) : null}
      {canLototo
        ? lototo.map((item, index) => (
            <div key={item.procedureId} className="grid gap-2">
              <p className="text-sm font-medium">{item.title}</p>
              <p className="text-xs text-muted-foreground">LOTOTO crew</p>
              {item.crew.map((id, crewIndex) => (
                <select
                  key={`crew-${index}-${crewIndex}`}
                  className={fieldClassName}
                  value={id}
                  onChange={(event) =>
                    setLototo((current) =>
                      current.map((row, i) =>
                        i === index
                          ? {
                              ...row,
                              crew: row.crew.map((value, j) => (j === crewIndex ? event.target.value : value)),
                            }
                          : row,
                      ),
                    )
                  }
                >
                  <option value="">Select crew</option>
                  {people.map((person) => (
                    <option key={person.id} value={person.id}>
                      {formatWorkforceOptionLabel(person)}
                    </option>
                  ))}
                </select>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setLototo((current) =>
                    current.map((row, i) => (i === index ? { ...row, crew: [...row.crew, ""] } : row)),
                  )
                }
              >
                Add crew
              </Button>
              <p className="text-xs text-muted-foreground">Verifiers</p>
              {item.verifiers.map((id, verifierIndex) => (
                <select
                  key={`ver-${index}-${verifierIndex}`}
                  className={fieldClassName}
                  value={id}
                  onChange={(event) =>
                    setLototo((current) =>
                      current.map((row, i) =>
                        i === index
                          ? {
                              ...row,
                              verifiers: row.verifiers.map((value, j) =>
                                j === verifierIndex ? event.target.value : value,
                              ),
                            }
                          : row,
                      ),
                    )
                  }
                >
                  <option value="">Select verifier</option>
                  {people.map((person) => (
                    <option key={person.id} value={person.id}>
                      {formatWorkforceOptionLabel(person)}
                    </option>
                  ))}
                </select>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setLototo((current) =>
                    current.map((row, i) => (i === index ? { ...row, verifiers: [...row.verifiers, ""] } : row)),
                  )
                }
              >
                Add verifier
              </Button>
            </div>
          ))
        : null}
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <Button type="button" disabled={saving} onClick={() => void save()}>
        {saving ? "Saving…" : "Save people"}
      </Button>
    </section>
  );
}
