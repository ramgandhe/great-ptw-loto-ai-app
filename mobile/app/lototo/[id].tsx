import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { ApiError } from "@/lib/api";
import {
  addIsolationPoint,
  assignLototoPersonnel,
  configureIsolationSequence,
  listLototoPlans,
} from "@/lib/lototo/api";
import type { IsolationPoint, LototoPlan } from "@/lib/lototo/types";
import { useTheme } from "@/providers/theme-provider";

export default function LototoPlanDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { tokens } = useTheme();
  const [plan, setPlan] = useState<LototoPlan | null>(null);
  const [points, setPoints] = useState<IsolationPoint[]>([]);
  const [isolationNumber, setIsolationNumber] = useState("");
  const [machineryId, setMachineryId] = useState("");
  const [workforceUserId, setWorkforceUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    listLototoPlans()
      .then((plans) => {
        const match = plans.find((item) => item.id === id) ?? null;
        setPlan(match);
        if (!match) {
          setError("LOTOTO plan not found");
        }
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "Failed to load plan");
      })
      .finally(() => setLoading(false));
  }, [id]);

  async function handleAddPoint() {
    if (!id || !isolationNumber.trim() || !machineryId.trim()) {
      setError("Isolation number and machinery ID are required.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const point = await addIsolationPoint(id, {
        machineryId: machineryId.trim(),
        isolationNumber: isolationNumber.trim(),
        energySource: { energySourceType: "electrical" },
      });
      setPoints((current) => [...current, point]);
      setIsolationNumber("");
      setMessage("Isolation point added.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to add point");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAssign() {
    if (!id || !workforceUserId.trim()) {
      setError("Workforce user ID is required.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await assignLototoPersonnel(id, {
        workforceUserId: workforceUserId.trim(),
        role: "isolation_officer",
      });
      setMessage("Personnel assigned.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to assign personnel");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSequence() {
    if (!id || points.length === 0) {
      setError("Add isolation points first.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await configureIsolationSequence(id, {
        steps: points.map((point, index) => ({
          isolationPointId: point.id,
          sequenceOrder: index + 1,
          requiresVerification: true,
        })),
      });
      setMessage("Sequence saved.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save sequence");
    } finally {
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

  if (!plan) {
    return (
      <View style={[styles.centered, { backgroundColor: tokens.colors.background }]}>
        <Text style={styles.error}>{error ?? "Plan not found"}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={{ backgroundColor: tokens.colors.background }} contentContainerStyle={styles.container}>
      <Text style={[styles.title, { color: tokens.colors.foreground }]}>{plan.title}</Text>
      <Text style={{ color: tokens.colors.mutedForeground }}>{plan.status}</Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {message ? <Text style={styles.success}>{message}</Text> : null}

      <Text style={styles.section}>Isolation points ({points.length})</Text>
      {points.map((point) => (
        <Text key={point.id} style={{ color: tokens.colors.foreground }}>
          {point.isolationNumber}
        </Text>
      ))}

      <TextInput
        value={isolationNumber}
        onChangeText={setIsolationNumber}
        placeholder="Isolation number"
        style={[styles.input, { borderColor: tokens.colors.border, color: tokens.colors.foreground }]}
      />
      <TextInput
        value={machineryId}
        onChangeText={setMachineryId}
        placeholder="Machinery ID"
        style={[styles.input, { borderColor: tokens.colors.border, color: tokens.colors.foreground }]}
      />
      <Pressable
        style={[styles.button, { backgroundColor: tokens.colors.primary, opacity: submitting ? 0.6 : 1 }]}
        onPress={handleAddPoint}
        disabled={submitting}
      >
        <Text style={styles.buttonText}>Add point</Text>
      </Pressable>

      <Text style={styles.section}>Assign officer</Text>
      <TextInput
        value={workforceUserId}
        onChangeText={setWorkforceUserId}
        placeholder="Workforce user ID"
        style={[styles.input, { borderColor: tokens.colors.border, color: tokens.colors.foreground }]}
      />
      <Pressable
        style={[styles.button, { backgroundColor: tokens.colors.primary, opacity: submitting ? 0.6 : 1 }]}
        onPress={handleAssign}
        disabled={submitting}
      >
        <Text style={styles.buttonText}>Assign</Text>
      </Pressable>

      <Pressable
        style={[styles.secondaryButton, { opacity: submitting ? 0.6 : 1 }]}
        onPress={handleSequence}
        disabled={submitting}
      >
        <Text style={styles.secondaryButtonText}>Save sequence</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 16 },
  container: { padding: 16, gap: 10 },
  title: { fontSize: 22, fontWeight: "600" },
  section: { marginTop: 12, fontSize: 16, fontWeight: "600" },
  input: { borderWidth: 1, borderRadius: 8, padding: 10 },
  button: { borderRadius: 8, padding: 12, alignItems: "center" },
  buttonText: { color: "#fff", fontWeight: "600" },
  secondaryButton: {
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#f9fafb",
  },
  secondaryButtonText: { color: "#111827", fontWeight: "600" },
  error: { color: "#b91c1c" },
  success: { color: "#047857" },
});
