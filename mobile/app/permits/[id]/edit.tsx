import { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { ApiError } from "@/lib/api";
import { getPermit } from "@/lib/permit/api";
import { getLocalPermitDraft } from "@/lib/permit/offline";
import { createEmptyPermitForm } from "@/lib/permit/form";
import type { PermitDetail, PermitFormState } from "@/lib/permit/types";
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

    getPermit(id)
      .then(setDetail)
      .catch(async (err) => {
        const local = await getLocalPermitDraft(id);
        if (local) {
          const payload = JSON.parse(local.payload) as Partial<PermitFormState>;
          setLocalForm({ ...createEmptyPermitForm(), ...payload, title: local.title });
          return;
        }
        setError(err instanceof ApiError ? err.message : "Failed to load permit");
      });
  }, [id]);

  if (error) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 16 }}>
        <Text style={{ color: "#b91c1c" }}>{error}</Text>
      </View>
    );
  }

  if (!detail && !localForm) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (localForm && !detail) {
    return <PermitWizard mode="edit" permitId={id} initialForm={localForm} />;
  }

  return <PermitWizard mode="edit" permitId={id} initialDetail={detail ?? undefined} />;
}
