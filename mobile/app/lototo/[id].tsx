import { useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { ActionBar, AppText, Banner, Button, Card, ChipRow, PageHeader, RefChip, SafetyStatusChip, Screen, ScreenState, SectionTitle, TextField } from "@/components/ui";
import { ListOrdered, Plus, UserPlus } from "@/components/ui/icons";
import { LOTOTO_PLAN_STATUS } from "@/lib/safety-status";
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
  const [assignmentRole, setAssignmentRole] = useState("operator");
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
          setError("This LOTOTO plan was not found.");
        }
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "The plan could not be loaded.");
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
      setError("Enter the isolation number and choose the machinery.");
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
      setError(err instanceof ApiError ? err.message : "The point could not be added.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAssign() {
    if (!id || !workforceUserId) {
      setError("Choose a person to assign.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await assignLototoPersonnel(id, {
        workforceUserId,
        role: assignmentRole as "operator" | "safety-officer" | "hod",
      });
      setMessage("Personnel assigned.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "The person could not be assigned.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSequence() {
    if (!id || points.length === 0) {
      setError("Add the isolation points first.");
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
      setMessage("Sequence saved. The plan is ready to isolate.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "The sequence could not be saved.");
    } finally {
      setSubmitting(false);
    }
  }

  const back = { label: "LOTOTO", href: "/lototo" };
  if (loading || !plan) {
    return <ScreenState error={loading ? null : (error ?? "This LOTOTO plan was not found.")} back={back} />;
  }

  return (
    <Screen footer={<ActionBar><Button label="Save sequence" icon={ListOrdered} loading={submitting} disabled={points.length === 0} onPress={() => void handleSequence()} /></ActionBar>}>
      <PageHeader title={plan.title} description="Add the isolation points in the order they are locked out, assign the people, then save the sequence." back={back}>
        <ChipRow>
          <SafetyStatusChip map={LOTOTO_PLAN_STATUS} status={plan.status} />
          <RefChip reference={plan.reference} />
        </ChipRow>
      </PageHeader>

      {error ? <Banner tone="danger">{error}</Banner> : null}
      {message ? <Banner tone="success">{message}</Banner> : null}

      <View style={{ gap: tokens.space[3] }}>
        <SectionTitle title="Isolation points" count={points.length} description="Locked out in this order." />
        <Card style={{ gap: tokens.space[4] }}>
          {points.length === 0 ? <AppText variant="caption">No points added in this visit yet.</AppText> : null}
          {points.map((point, index) => (
            <View key={point.id} style={{ flexDirection: "row", alignItems: "center", gap: tokens.space[3] }}>
              <View style={{ width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: tokens.colors.primaryFill }}>
                <AppText variant="label" tone="onPrimary" maxFontSizeMultiplier={1.2}>{index + 1}</AppText>
              </View>
              <AppText variant="body" weight="semibold">{point.isolationNumber}</AppText>
            </View>
          ))}
          <View style={{ gap: tokens.space[3], padding: tokens.space[3], borderRadius: tokens.radii.md, backgroundColor: tokens.colors.muted }}>
            <AppText variant="label">Add a point</AppText>
            <TextField label="Isolation number" required value={isolationNumber} onChangeText={setIsolationNumber} placeholder="For example: ISO-01" autoCapitalize="characters" />
            <SelectField
              label="Workstation"
              value={workstationId}
              options={(options?.workstations ?? []).map((item) => ({ value: item.id, label: formatOrgOptionLabel(item) }))}
              placeholder="Any workstation"
              onChange={setWorkstationId}
            />
            <SelectField label="Machinery" value={machineryId} options={machineryOptions} placeholder="Choose machinery" required onChange={setMachineryId} />
            <SelectField
              label="Energy source"
              value={energySourceType}
              options={ENERGY_SOURCE_OPTIONS.map((item) => ({ value: item.value, label: item.label }))}
              onChange={setEnergySourceType}
            />
            <Button label="Add point" variant="outline" icon={Plus} disabled={submitting} onPress={() => void handleAddPoint()} style={{ alignSelf: "flex-start" }} />
          </View>
        </Card>
      </View>

      <View style={{ gap: tokens.space[3] }}>
        <SectionTitle title="People" description="Who isolates, verifies and signs off." />
        <Card style={{ gap: tokens.space[4] }}>
          <SelectField label="Person" value={workforceUserId} options={personnelOptions} placeholder="Choose person" required onChange={setWorkforceUserId} />
          <SelectField
            label="Role"
            value={assignmentRole}
            options={ASSIGNMENT_ROLE_OPTIONS.map((item) => ({ value: item.value, label: item.label }))}
            onChange={setAssignmentRole}
          />
          <Button label="Assign" variant="outline" icon={UserPlus} disabled={submitting} onPress={() => void handleAssign()} style={{ alignSelf: "flex-start" }} />
        </Card>
      </View>
    </Screen>
  );
}
