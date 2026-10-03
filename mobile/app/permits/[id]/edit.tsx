import { useEffect, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { ScreenState } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { getPermit } from "@/lib/permit/api";
import { getLocalPermitDraft, resolvePermitId } from "@/lib/permit/offline";
import { createEmptyPermitForm } from "@/lib/permit/form";
import type { DraftFields, PermitDetail, PermitFormState } from "@/lib/permit/types";
import { PermitWizard } from "@/components/permit/permit-wizard";

export default function EditPermitScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [detail, setDetail] = useState<PermitDetail | null>(null);
  const [localForm, setLocalForm] = useState<PermitFormState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      return;
    }

    // A permit created offline keeps its local id in links until its create syncs.
    resolvePermitId(id)
      .then(getPermit)
      .then(setDetail)
      .catch(async (err) => {
        const local = await getLocalPermitDraft(id);
        if (local) {
          const payload = JSON.parse(local.payload) as DraftFields;
          // Saved in the request's shape: forms are a list there, keyed by template in the form.
          setLocalForm({
            ...createEmptyPermitForm(),
            ...(payload as Partial<PermitFormState>),
            title: local.title,
            formResponses: Object.fromEntries((payload.formResponses ?? []).map((r) => [r.templateId, r.answers])),
          });
          return;
        }
        setError(err instanceof ApiError ? err.message : "The permit could not be loaded.");
      });
  }, [id]);

  if (error || (!detail && !localForm)) {
    return <ScreenState error={error} back={{ label: "Permits", href: "/permits" }} />;
  }

  if (localForm && !detail) {
    return <PermitWizard mode="edit" permitId={id} initialForm={localForm} />;
  }

  return <PermitWizard mode="edit" permitId={id} initialDetail={detail ?? undefined} />;
}
