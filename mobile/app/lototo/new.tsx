import { useEffect, useMemo, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { ActionBar, Banner, Button, Card, PageHeader, Screen, ScreenState, TextField } from "@/components/ui";
import { Plus } from "@/components/ui/icons";
import { SelectField } from "@/components/ui/select-field";
import { ApiError } from "@/lib/api";
import { createLototoPlan } from "@/lib/lototo/api";
import { filterMachineryByWorkstation, loadLototoFormOptions } from "@/lib/lototo/form-options";
import { useTheme } from "@/providers/theme-provider";

export default function NewLototoPlanScreen() {
  const { machineryId: initialMachineryId } = useLocalSearchParams<{ machineryId?: string }>();
  const { tokens } = useTheme();
  const [tried, setTried] = useState(false);
  const [options, setOptions] = useState<Awaited<ReturnType<typeof loadLototoFormOptions>> | null>(
    null,
  );
  const [workstationId, setWorkstationId] = useState("");
  const [machineryId, setMachineryId] = useState(initialMachineryId ?? "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredMachinery = useMemo(
    () => filterMachineryByWorkstation(options?.machinery ?? [], workstationId),
    [options?.machinery, workstationId],
  );

  const machineryOptions = useMemo(
    () =>
      filteredMachinery.map((item) => ({
        value: item.id,
        label: item.code ? `${item.name} (${item.code})` : item.name,
      })),
    [filteredMachinery],
  );

  useEffect(() => {
    loadLototoFormOptions()
      .then(setOptions)
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "The machinery list could not be loaded.");
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate() {
    setTried(true);
    if (!machineryId || !title.trim()) {
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const plan = await createLototoPlan({
        machineryId,
        title: title.trim(),
        description: description.trim() || undefined,
        workstationId: workstationId || undefined,
      });
      router.replace(`/lototo/${plan.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "The plan could not be created.");
      setSubmitting(false);
    }
  }

  const back = { label: "LOTOTO", href: "/lototo" };
  if (loading) {
    return <ScreenState back={back} />;
  }

  return (
    <Screen footer={<ActionBar><Button label="Create plan" icon={Plus} loading={submitting} onPress={() => void handleCreate()} /></ActionBar>}>
      <PageHeader title="New LOTOTO plan" description="Choose the machine, then add its isolation points in order on the next page." back={back} />
      {error ? <Banner tone="danger">{error}</Banner> : null}
      <Card style={{ gap: tokens.space[4] }}>
        <SelectField
          label="Workstation"
          value={workstationId}
          options={(options?.workstations ?? []).map((item) => ({ value: item.id, label: item.code ? `${item.name} (${item.code})` : item.name }))}
          placeholder="Any workstation"
          hint="Optional. Narrows the machinery list."
          onChange={setWorkstationId}
        />
        <SelectField
          label="Machinery"
          value={machineryId}
          options={machineryOptions}
          placeholder="Choose machinery"
          required
          hint={machineryOptions.length === 0 ? "Add machinery under Organisation first." : undefined}
          error={tried && !machineryId ? "Choose the machinery this plan isolates." : null}
          onChange={setMachineryId}
        />
        <TextField label="Title" required value={title} onChangeText={setTitle} placeholder="For example: Pump P-101 full isolation" error={tried && !title.trim() ? "Give the plan a title." : null} />
        <TextField label="Description" multiline value={description} onChangeText={setDescription} placeholder="When this plan is used (optional)" />
      </Card>
    </Screen>
  );
}
