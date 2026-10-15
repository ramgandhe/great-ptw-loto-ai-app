import { useEffect, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { ActionBar, Banner, Button, Card, PageHeader, Screen, ScreenState, TextField } from "@/components/ui";
import { Plus } from "@/components/ui/icons";
import { SelectField } from "@/components/ui/select-field";
import { ApiError } from "@/lib/api";
import { createLototoPlan } from "@/lib/lototo/api";
import { loadAssetDirectory, loadSiteDirectory, loadWorkLocationDirectory } from "@/lib/organisation/offline";
import type { AssetRecord, PlaceSite, WorkLocationRecord } from "@/lib/place/api";
import { useTheme } from "@/providers/theme-provider";

export default function NewLototoPlanScreen() {
  const { assetId: initialAssetId, machineryId } = useLocalSearchParams<{ assetId?: string; machineryId?: string }>();
  const { tokens } = useTheme();
  const [tried, setTried] = useState(false);
  const [sites, setSites] = useState<PlaceSite[]>([]);
  const [locations, setLocations] = useState<WorkLocationRecord[]>([]);
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [siteId, setSiteId] = useState("");
  const [workLocationId, setWorkLocationId] = useState("");
  const [assetId, setAssetId] = useState(initialAssetId ?? machineryId ?? "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSiteDirectory()
      .then((rows) => {
        setSites(rows);
        if (rows.length === 1) setSiteId(rows[0].id);
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "The site list could not be loaded.");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!siteId) {
      setLocations([]);
      return;
    }
    loadWorkLocationDirectory(siteId).then(setLocations).catch(() => setLocations([]));
  }, [siteId]);

  useEffect(() => {
    if (!siteId) {
      setAssets([]);
      return;
    }
    loadAssetDirectory(siteId, workLocationId || undefined).then(setAssets).catch(() => setAssets([]));
  }, [siteId, workLocationId]);

  async function handleCreate() {
    setTried(true);
    if (!assetId || !title.trim()) {
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const plan = await createLototoPlan({
        assetId,
        title: title.trim(),
        description: description.trim() || undefined,
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
      <PageHeader title="New LOTOTO plan" description="Choose the asset, then add its isolation points in order on the next page." back={back} />
      {error ? <Banner tone="danger">{error}</Banner> : null}
      <Card style={{ gap: tokens.space[4] }}>
        <SelectField
          label="Site"
          value={siteId}
          options={sites.map((item) => ({ value: item.id, label: item.code ? `${item.name} (${item.code})` : item.name }))}
          placeholder="Choose site"
          required
          onChange={(next) => {
            setSiteId(next);
            setWorkLocationId("");
            setAssetId("");
          }}
        />
        <SelectField
          label="Work location"
          value={workLocationId}
          options={locations.map((item) => ({ value: item.id, label: item.pathText || item.name }))}
          placeholder="Whole site"
          hint="Optional. Limits the asset list to this location and its sub-locations."
          disabled={!siteId}
          onChange={(next) => {
            setWorkLocationId(next);
            setAssetId("");
          }}
        />
        <SelectField
          label="Asset"
          value={assetId}
          options={assets.map((item) => ({ value: item.id, label: `${item.tag} — ${item.name}` }))}
          placeholder="Choose asset"
          required
          hint={siteId && assets.length === 0 ? "Add an asset under Organisation first." : undefined}
          error={tried && !assetId ? "Choose the asset this plan isolates." : null}
          disabled={!siteId}
          onChange={setAssetId}
        />
        <TextField label="Title" required value={title} onChangeText={setTitle} placeholder="For example: Pump P-101 full isolation" error={tried && !title.trim() ? "Give the plan a title." : null} />
        <TextField label="Description" multiline value={description} onChangeText={setDescription} placeholder="When this plan is used (optional)" />
      </Card>
    </Screen>
  );
}
