"use client";

import { AppSelect } from "@/components/ui/select";
import { FIELD_CLASS } from "@/components/layout/admin-page-header";
import { HazardLinks } from "@/components/organisation/hazard-links";
import type { NamedType, WorkLocationRecord } from "@/lib/place/api";
import type { TenantUser } from "@/lib/workforce/types";

export type WorkLocationDraft = {
  name: string;
  code: string;
  parentId: string;
  locationTypeId: string;
  description: string;
  hazardIds: string[];
};

export const emptyWorkLocationDraft = (): WorkLocationDraft => ({
  name: "",
  code: "",
  parentId: "",
  locationTypeId: "",
  description: "",
  hazardIds: [],
});

export function personName(user: TenantUser): string {
  return user.name || [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email || user.username;
}

export function approverPeople(users: TenantUser[]): TenantUser[] {
  return users.filter((user) => user.enabled && (user.roles.includes("permit-approver") || user.roles.includes("hod")));
}

/** Fields shared by adding and editing a work location. Approvers stay on the edit page. */
export function WorkLocationFields({
  form,
  parents,
  types,
  onChange,
}: {
  form: WorkLocationDraft;
  parents: WorkLocationRecord[];
  types: NamedType[];
  onChange: (next: WorkLocationDraft) => void;
}) {
  return (
    <>
      <label className="grid gap-1.5 text-sm">
        <span className="font-medium">Name</span>
        <input
          required
          className={FIELD_CLASS}
          value={form.name}
          onChange={(event) => onChange({ ...form, name: event.target.value })}
        />
      </label>
      <label className="grid gap-1.5 text-sm">
        <span className="font-medium">Code</span>
        <input
          required
          className={FIELD_CLASS}
          value={form.code}
          onChange={(event) => onChange({ ...form, code: event.target.value })}
        />
      </label>
      <label className="grid gap-1.5 text-sm">
        <span className="font-medium">Nest under</span>
        <AppSelect className={FIELD_CLASS} value={form.parentId} onChange={(event) => onChange({ ...form, parentId: event.target.value })}>
          <option value="">Please select a parent..</option>
          {parents.map((row) => (
            <option key={row.id} value={row.id}>
              {row.pathText || row.name}
            </option>
          ))}
        </AppSelect>
      </label>
      <label className="grid gap-1.5 text-sm">
        <span className="font-medium">Type</span>
        <AppSelect
          className={FIELD_CLASS}
          value={form.locationTypeId}
          onChange={(event) => onChange({ ...form, locationTypeId: event.target.value })}
        >
          <option value="">No type</option>
          {types.map((type) => (
            <option key={type.id} value={type.id}>
              {type.name}
            </option>
          ))}
        </AppSelect>
      </label>
      <HazardLinks hazardIds={form.hazardIds} onChange={(hazardIds) => onChange({ ...form, hazardIds })} />
      <label className="grid gap-1.5 text-sm sm:col-span-2">
        <span className="font-medium">Description</span>
        <textarea
          className={`${FIELD_CLASS} h-20 py-2`}
          value={form.description}
          onChange={(event) => onChange({ ...form, description: event.target.value })}
        />
      </label>
    </>
  );
}
