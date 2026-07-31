import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { SelectField } from "@/components/ui/select-field";
import { ApiError } from "@/lib/api";
import { createLototoPlan } from "@/lib/lototo/api";
import { loadLototoFormOptions } from "@/lib/lototo/form-options";
import { useTheme } from "@/providers/theme-provider";

export default function NewLototoPlanScreen() {
  const { permitId: initialPermitId } = useLocalSearchParams<{ permitId?: string }>();
  const { tokens } = useTheme();
  const [options, setOptions] = useState<Awaited<ReturnType<typeof loadLototoFormOptions>> | null>(
    null,
  );
  const [permitId, setPermitId] = useState(initialPermitId ?? "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const permitOptions = useMemo(
    () =>
      (options?.permits ?? []).map((permit) => ({
        value: permit.id,
        label: permit.reference ? `${permit.title} (${permit.reference})` : permit.title,
      })),
    [options?.permits],
  );

  useEffect(() => {
    loadLototoFormOptions()
      .then(setOptions)
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "Failed to load permits");
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate() {
    if (!permitId || !title.trim()) {
      setError("Permit and title are required.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const plan = await createLototoPlan({
        permitId,
        title: title.trim(),
        description: description.trim() || undefined,
      });
      router.replace(`/lototo/${plan.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create plan");
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: tokens.colors.background }]}>
        <ActivityIndicator color={tokens.colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={{ backgroundColor: tokens.colors.background }} contentContainerStyle={styles.container}>
      <Text style={[styles.title, { color: tokens.colors.foreground }]}>New LOTOTO plan</Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <SelectField
        label="Permit"
        value={permitId}
        options={permitOptions}
        placeholder="Select approved permit"
        required
        hint={
          permitOptions.length === 0
            ? "No approved permits found. Approve a permit first."
            : undefined
        }
        onChange={setPermitId}
      />

      <Text style={styles.label}>Title</Text>
      <TextInput
        value={title}
        onChangeText={setTitle}
        style={[styles.input, { borderColor: tokens.colors.border, color: tokens.colors.foreground }]}
      />

      <Text style={styles.label}>Description</Text>
      <TextInput
        value={description}
        onChangeText={setDescription}
        multiline
        style={[styles.input, { borderColor: tokens.colors.border, color: tokens.colors.foreground }]}
      />

      <Pressable
        style={[styles.primaryButton, { backgroundColor: tokens.colors.primary, opacity: submitting ? 0.6 : 1 }]}
        onPress={handleCreate}
        disabled={submitting}
      >
        <Text style={styles.primaryButtonText}>{submitting ? "Creating…" : "Create plan"}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  container: { padding: 16, gap: 10 },
  title: { fontSize: 22, fontWeight: "600", marginBottom: 8 },
  label: { fontSize: 13, fontWeight: "500" },
  input: { borderWidth: 1, borderRadius: 8, padding: 10 },
  primaryButton: { marginTop: 8, borderRadius: 8, padding: 12, alignItems: "center" },
  primaryButtonText: { color: "#fff", fontWeight: "600" },
  error: { color: "#b91c1c" },
});
