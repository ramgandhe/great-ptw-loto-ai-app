import { useEffect, useState } from "react";
import { View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { AppText, Banner, Card, ChipRow, FileRow, InfoList, PageHeader, PermitStatusChip, RefChip, Screen, ScreenState, SectionTitle } from "@/components/ui";
import { formatDateTime, formatWindow } from "@/lib/format";
import { ApiError } from "@/lib/api";
import { getArchivedPermit, getArchiveAttachmentDownloadUrl } from "@/lib/closure/api";
import type { ArchivedPermitDetail } from "@/lib/closure/types";
import { openPresignedDownload } from "@/lib/download";
import { getEvidenceDownloadUrl, listEvidence, listProgress } from "@/lib/execution/api";
import type { EvidenceRecord } from "@/lib/execution/types";
import { useTheme } from "@/providers/theme-provider";

export default function HistoricalPermitScreen() {
  const { tokens } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const permitId = id ?? "";
  const [detail, setDetail] = useState<ArchivedPermitDetail | null>(null);
  // null: could not be loaded (shown as such, never as none).
  const [progressCount, setProgressCount] = useState<number | null>(0);
  const [evidence, setEvidence] = useState<EvidenceRecord[] | null>([]);
  const [error, setError] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    if (!permitId) {
      return;
    }
    Promise.all([
      getArchivedPermit(permitId),
      listProgress(permitId).catch(() => null),
      listEvidence(permitId).catch(() => null),
    ])
      .then(([archived, progress, evidenceItems]) => {
        setDetail(archived);
        setProgressCount(progress ? progress.length : null);
        setEvidence(evidenceItems);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "The record could not be loaded."));
  }, [permitId]);

  async function handleEvidenceDownload(evidenceId: string) {
    setDownloadingId(evidenceId);
    setDownloadError(null);
    try {
      await openPresignedDownload(() => getEvidenceDownloadUrl(permitId, evidenceId));
    } catch (err) {
      setDownloadError(err instanceof ApiError ? err.message : "The file could not be opened.");
    } finally {
      setDownloadingId(null);
    }
  }

  async function handleAttachmentDownload(attachmentId: string) {
    setDownloadingId(attachmentId);
    setDownloadError(null);
    try {
      await openPresignedDownload(() => getArchiveAttachmentDownloadUrl(permitId, attachmentId));
    } catch (err) {
      setDownloadError(err instanceof ApiError ? err.message : "The file could not be opened.");
    } finally {
      setDownloadingId(null);
    }
  }

  const back = { label: "Archive", href: "/closure/archive" };
  if (error || !detail) {
    return <ScreenState error={error} back={back} />;
  }

  return (
    <Screen>
      <PageHeader title={detail.permit.title} description="Closed permits are kept as they were; this record is read-only." back={back}>
        <ChipRow>
          <PermitStatusChip status={detail.permit.status} />
          <RefChip reference={detail.permit.reference} />
        </ChipRow>
      </PageHeader>

      <Card>
        <InfoList
          rows={[
            ["Work", detail.permit.workScope ?? "No work scope recorded"],
            ["Planned", formatWindow(detail.permit.plannedStartAt, detail.permit.plannedEndAt)],
            ["Progress updates", progressCount === null ? "Could not be loaded" : String(progressCount)],
            ["Evidence files", evidence === null ? "Could not be loaded" : String(evidence.length)],
            ["Closed", detail.closure ? formatDateTime(detail.closure.closedAt) : null],
          ]}
        />
      </Card>

      {downloadError ? <Banner tone="danger">{downloadError}</Banner> : null}

      {detail.attachments.length > 0 ? (
        <View style={{ gap: tokens.space[3] }}>
          <SectionTitle title="Attachments" count={detail.attachments.length} />
          <Card style={{ gap: 0 }}>
            {detail.attachments.map((item) => (
              <FileRow key={item.id} name={item.fileName} busy={downloadingId === item.id} onOpen={() => void handleAttachmentDownload(item.id)} />
            ))}
          </Card>
        </View>
      ) : null}

      {evidence && evidence.length > 0 ? (
        <View style={{ gap: tokens.space[3] }}>
          <SectionTitle title="Evidence" count={evidence.length} />
          <Card style={{ gap: 0 }}>
            {evidence.map((item) => (
              <FileRow key={item.id} name={item.fileName} busy={downloadingId === item.id} onOpen={() => void handleEvidenceDownload(item.id)} />
            ))}
          </Card>
        </View>
      ) : null}
      {evidence === null ? <AppText variant="caption">Evidence could not be loaded.</AppText> : null}
    </Screen>
  );
}
