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
import { useLocalSearchParams } from "expo-router";
import { SelectField } from "@/components/ui/select-field";
import { ApiError } from "@/lib/api";
import {
  addIsolationPoint,
  assignLototoPersonnel,
  configureIsolationSequence,
  listLototoPlans,
} from "@/lib/lototo/api";
import {
  ASSIGNMENT_ROLE_OPTIONS,
  ENERGY_SOURCE_OPTIONS,
  filterMachineryByWorkstation,
  loadLototoFormOptions,
} from "@/lib/lototo/form-options";
import type { IsolationPoint, LototoPlan } from "@/lib/lototo/types";
import {
  formatOrgOptionLabel,
  formatWorkforceOptionLabel,
} from "@/lib/permit/form-options";
import { useTheme } from "@/providers/theme-provider";

export default function LototoPlanDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { tokens } = useTheme();
  const [plan, setPlan] = useState<LototoPlan | null>(null);
  const [options, setOptions] = useState<Awaited<ReturnType<typeof loadLototoFormOptions>> | null>(
    null,
  );
  const [points, setPoints] = useState<IsolationPoint[]>([]);
  const [isolationNumber, setIsolationNumber] = useState("");
  const [workstationId, setWorkstationId] = useState("");
  const [machineryId, setMachineryId] = useState("");
  const [energySourceType, setEnergySourceType] = useState("electrical");
  const [workforceUserId, setWorkforceUserId] = useState("");
  const [assignmentRole, setAssignmentRole] = useState("isolation_officer");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const filteredMachinery = useMemo(
    () => filterMachineryByWorkstation(options?.machinery ?? [], workstationId),
    [options?.machinery, workstationId],
  );

  const machineryOptions = useMemo(
    () =>
      filteredMachinery.map((item) => ({
        value: item.id,
        label: formatOrgOptionLabel(item),
      })),
    [filteredMachinery],
  );

  const personnelOptions = useMemo(
    () =>
      (options?.personnel ?? []).map((person) => ({
        value: person.id,
        label: formatWorkforceOptionLabel(person),
      })),
    [options?.personnel],
  );

  useEffect(() => {
    Promise.all([listLototoPlans(), loadLototoFormOptions()])
      .then(([plans, formOptions]) => {
        const match = plans.find((item) => item.id === id) ?? null;
        setPlan(match);
        setOptions(formOptions);
        if (match?.workstationId) {
          setWorkstationId(match.workstationId);
        }
        if (match?.machineryId) {
          setMachineryId(match.machineryId);
        }
        if (!match) {
          setError("LOTOTO plan not found");
        }
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "Failed to load plan");
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (machineryId && !filteredMachinery.some((item) => item.id === machineryId)) {
      setMachineryId("");
    }
  }, [filteredMachinery, machineryId]);

  async function handleAddPoint() {
    if (!id || !isolationNumber.trim() || !machineryId) {
      setError("Isolation number and machinery are required.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const point = await addIsolationPoint(id, {
        machineryId,
        isolationNumber: isolationNumber.trim(),
        energySource: { energySourceType },
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
    if (!id || !workforceUserId) {
      setError("Personnel is required.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await assignLototoPersonnel(id, {
        workforceUserId,
        role: assignmentRole as "isolation_officer" | "verifier" | "supervisor",
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
      <SelectField
        label="Workstation"
        value={workstationId}
        options={(options?.workstations ?? []).map((item) => ({
          value: item.id,
          label: formatOrgOptionLabel(item),
        }))}
        placeholder="Select workstation (optional)"
        onChange={setWorkstationId}
      />
      <SelectField
        label="Machinery"
        value={machineryId}
        options={machineryOptions}
        placeholder="Select machinery"
        required
        onChange={setMachineryId}
      />
      <SelectField
        label="Energy source"
        value={energySourceType}
        options={ENERGY_SOURCE_OPTIONS.map((item) => ({ value: item.value, label: item.label }))}
        onChange={setEnergySourceType}
      />
      <Pressable
        style={[styles.button, { backgroundColor: tokens.colors.primary, opacity: submitting ? 0.6 : 1 }]}
        onPress={handleAddPoint}
        disabled={submitting}
      >
        <Text style={styles.buttonText}>Add point</Text>
      </Pressable>

      <Text style={styles.section}>Assign personnel</Text>
      <SelectField
        label="Person"
        value={workforceUserId}
        options={personnelOptions}
        placeholder="Select person"
        required
        onChange={setWorkforceUserId}
      />
      <SelectField
        label="Role"
        value={assignmentRole}
        options={ASSIGNMENT_ROLE_OPTIONS.map((item) => ({ value: item.value, label: item.label }))}
        onChange={setAssignmentRole}
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
