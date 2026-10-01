"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ApiError } from "@/lib/api";
import { resolveSimopsCase } from "@/lib/simops/api";
import type { SimopsCaseDetail, SimopsPermitDecision } from "@/lib/simops/types";
import { formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { ConflictSeverityBadge } from "@/components/simops/conflict-severity-badge";

const DECISIONS: { value: SimopsPermitDecision; label: string }[] = [
  { value: "allow", label: "Allow" },
  { value: "allow_with_controls", label: "Allow with controls" },
  { value: "reject", label: "Reject" },
];

export function CaseResolve({
  detail,
  canResolve,
  onUpdated,
}: {
  detail: SimopsCaseDetail;
  canResolve: boolean;
  onUpdated: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [decisions, setDecisions] = useState<Record<string, SimopsPermitDecision>>(() =>
    Object.fromEntries(
      detail.members.map((m) => [m.permitId, (m.decision ?? "allow") as SimopsPermitDecision]),
    ),
  );
  const [comments, setComments] = useState<Record<string, string>>(() =>
    Object.fromEntries(detail.members.map((m) => [m.permitId, m.comments ?? ""])),
  );
  const [controlText, setControlText] = useState<Record<string, string>>({});
  const [controlPerson, setControlPerson] = useState<Record<string, string>>({});
  const [controlComments, setControlComments] = useState<Record<string, string>>({});

  const titleById = useMemo(
    () => Object.fromEntries(detail.members.map((m) => [m.permit.id, m.permit.title])),
    [detail.members],
  );

  const resolved = detail.case.status === "resolved";

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const controls = detail.members
        .filter((m) => decisions[m.permitId] === "allow_with_controls")
        .map((m) => ({
          permitId: m.permitId,
          controlText: (controlText[m.permitId] ?? "").trim(),
          responsibleUserId: controlPerson[m.permitId],
          comments: (controlComments[m.permitId] ?? "").trim() || undefined,
        }));
      await resolveSimopsCase(detail.case.id, {
        decisions: detail.members.map((m) => ({
          permitId: m.permitId,
          decision: decisions[m.permitId],
          comments: comments[m.permitId]?.trim() || undefined,
        })),
        controls: controls.filter((c) => c.controlText && c.responsibleUserId),
      });
      onUpdated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save this case.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-6">
      <section className="rounded-lg border border-border p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-medium">{detail.case.summary}</p>
            <p className="text-sm text-muted-foreground">
              {detail.members.length} permits · detected {formatDateTime(detail.case.detectedAt)}
            </p>
          </div>
          <ConflictSeverityBadge severity={detail.case.severity} />
        </div>
        {detail.interactions.length > 0 ? (
          <ul className="mt-3 grid gap-1 text-sm text-muted-foreground">
            {detail.interactions.map((item) => (
              <li key={item.id}>
                {titleById[item.permitIdA] ?? item.permitIdA} ↔ {titleById[item.permitIdB] ?? item.permitIdB}:{" "}
                {item.summary}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {detail.members.map((member) => (
        <section key={member.id} className="rounded-lg border border-border p-4">
          <Link href={`/permits/${member.permit.id}`} className="font-medium text-primary hover:underline">
            {member.permit.reference ?? member.permit.title}
          </Link>
          <p className="text-sm text-muted-foreground">
            {member.permit.title} · {member.permit.status.replace(/_/g, " ")}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatDateTime(member.permit.plannedStartAt)} → {formatDateTime(member.permit.plannedEndAt)}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Hazards {member.hazards.length} · PPE {member.ppe.length} · LOTOTO {member.lototo.length}
          </p>

          {resolved ? (
            <p className="mt-3 text-sm">
              Decision: {(member.decision ?? "—").replace(/_/g, " ")}
              {member.comments ? ` — ${member.comments}` : ""}
            </p>
          ) : canResolve ? (
            <div className="mt-3 grid gap-2">
              <div className="flex flex-wrap gap-2">
                {DECISIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`rounded-lg border px-3 py-1.5 text-sm ${
                      decisions[member.permitId] === option.value
                        ? "border-primary bg-primary/10"
                        : "border-border"
                    }`}
                    onClick={() => setDecisions((prev) => ({ ...prev, [member.permitId]: option.value }))}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <textarea
                rows={2}
                value={comments[member.permitId] ?? ""}
                onChange={(e) => setComments((prev) => ({ ...prev, [member.permitId]: e.target.value }))}
                placeholder={decisions[member.permitId] === "reject" ? "Why this permit is rejected" : "Comments"}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
              {decisions[member.permitId] === "allow_with_controls" ? (
                <div className="grid gap-2 rounded-lg border border-dashed border-border p-3">
                  <input
                    value={controlText[member.permitId] ?? ""}
                    onChange={(e) => setControlText((prev) => ({ ...prev, [member.permitId]: e.target.value }))}
                    placeholder="Control"
                    className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  />
                  <select
                    value={controlPerson[member.permitId] ?? ""}
                    onChange={(e) => setControlPerson((prev) => ({ ...prev, [member.permitId]: e.target.value }))}
                    className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Responsible person</option>
                    {detail.people.map((person) => (
                      <option key={person.id} value={person.id}>
                        {[person.firstName, person.lastName].filter(Boolean).join(" ") || person.email}
                      </option>
                    ))}
                  </select>
                  <input
                    value={controlComments[member.permitId] ?? ""}
                    onChange={(e) =>
                      setControlComments((prev) => ({ ...prev, [member.permitId]: e.target.value }))
                    }
                    placeholder="Control comments"
                    className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  />
                </div>
              ) : null}
            </div>
          ) : null}
        </section>
      ))}

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {!resolved && canResolve ? (
        <Button type="button" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save case decisions"}
        </Button>
      ) : null}
    </div>
  );
}
