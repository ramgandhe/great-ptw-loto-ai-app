import { useEffect, useState } from "react";
import { View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { AppText, Banner, Card, EmptyState, FileRow, PageHeader, Screen, ScreenState } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { openPresignedDownload } from "@/lib/download";
import { getEvidenceDownloadUrl, listEvidence } from "@/lib/execution/api";
import type { EvidenceRecord } from "@/lib/execution/types";
import { formatDateTime } from "@/lib/format";
import { useTheme } from "@/providers/theme-provider";

export default function EvidenceGalleryScreen() {
  const { tokens } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const permitId = id ?? "";
  const [items, setItems] = useState<EvidenceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);

  useEffect(() => {
    if (!permitId) {
      return;
    }
    listEvidence(permitId)
      .then(setItems)
      .catch((err) => setError(err instanceof ApiError ? err.message : "The evidence could not be loaded."))
      .finally(() => setLoading(false));
  }, [permitId]);

  async function open(evidenceId: string) {
    setOpeningId(evidenceId);
    setOpenError(null);
    try {
      await openPresignedDownload(() => getEvidenceDownloadUrl(permitId, evidenceId));
    } catch (err) {
      setOpenError(err instanceof ApiError ? err.message : "The file could not be opened.");
    } finally {
      setOpeningId(null);
    }
  }

  const back = { label: "Permit work", href: `/execution/${permitId}` };
  if (loading || error) {
    return <ScreenState error={error} back={back} />;
  }

  return (
    <Screen>
      <PageHeader title="Evidence" description="Photos and files attached while the work was done." back={back} />
      {openError ? <Banner tone="danger">{openError}</Banner> : null}
      {items.length === 0 ? (
        <EmptyState title="No evidence yet" body="Photos taken from the permit's work page appear here." />
      ) : (
        items.map((item) => (
          <Card key={item.id} style={{ gap: tokens.space[1] }}>
            <FileRow name={item.fileName} busy={openingId === item.id} onOpen={() => void open(item.id)} />
            <View style={{ paddingLeft: 30, gap: 2 }}>
              {item.comment ? <AppText variant="body" tone="secondary">{item.comment}</AppText> : null}
              <AppText variant="caption">{`${formatDateTime(item.createdAt)} · ${Math.round(item.fileSize / 1024)} KB`}</AppText>
            </View>
          </Card>
        ))
      )}
    </Screen>
  );
}
