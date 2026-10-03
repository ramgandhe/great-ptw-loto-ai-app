import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { ApiError } from "@/lib/api";
import { getArchivedPermit, getArchiveAttachmentDownloadUrl } from "@/lib/closure/api";
import type { ArchivedPermitDetail } from "@/lib/closure/types";
import { openPresignedDownload } from "@/lib/download";
import { getEvidenceDownloadUrl, listEvidence, listProgress } from "@/lib/execution/api";
import type { EvidenceRecord } from "@/lib/execution/types";
import { useThemedStyles } from "@/theme/use-themed-styles";
import type { ThemeColors } from "@/theme/types";

export default function HistoricalPermitScreen() {
  const styles = useThemedStyles(createStyles);
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
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load record"))
      ;
  }, [permitId]);

  async function handleEvidenceDownload(evidenceId: string) {
    setDownloadingId(evidenceId);
    setDownloadError(null);
    try {
      await openPresignedDownload(() => getEvidenceDownloadUrl(permitId, evidenceId));
    } catch (err) {
      setDownloadError(err instanceof ApiError ? err.message : "Download failed");
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
      setDownloadError(err instanceof ApiError ? err.message : "Download failed");
    } finally {
      setDownloadingId(null);
    }
  }

  if (error) {
    return <Text style={styles.error}>{error}</Text>;
  }

  if (!detail) {
    return <ActivityIndicator style={{ marginTop: 32 }} />;
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{detail.permit.title}</Text>
      <Text style={styles.meta}>Status: {detail.permit.status.replace(/_/g, " ")}</Text>
      <Text style={styles.meta}>{detail.permit.workScope ?? "No work scope recorded"}</Text>
      <Text style={styles.section}>Execution summary</Text>
      <Text style={styles.meta}>{progressCount === null ? "Progress updates could not be loaded" : `${progressCount} progress update(s)`}</Text>
      <Text style={styles.meta}>{evidence === null ? "Evidence could not be loaded" : `${evidence.length} evidence file(s)`}</Text>
      {downloadError ? <Text style={styles.error}>{downloadError}</Text> : null}
      {detail.attachments.length > 0 ? (
        <>
          <Text style={styles.section}>Attachments</Text>
          {detail.attachments.map((item) => (
            <Pressable
              key={item.id}
              style={styles.downloadRow}
              disabled={downloadingId === item.id}
              onPress={() => void handleAttachmentDownload(item.id)}
            >
              <Text style={styles.meta}>{item.fileName}</Text>
              <Text style={styles.link}>
                {downloadingId === item.id ? "Opening..." : "Download"}
              </Text>
            </Pressable>
          ))}
        </>
      ) : null}
      {evidence && evidence.length > 0 ? (
        <>
          <Text style={styles.section}>Evidence</Text>
          {evidence.map((item) => (
            <Pressable
              key={item.id}
              style={styles.downloadRow}
              disabled={downloadingId === item.id}
              onPress={() => void handleEvidenceDownload(item.id)}
            >
              <Text style={styles.meta}>{item.fileName}</Text>
              <Text style={styles.link}>
                {downloadingId === item.id ? "Opening..." : "Download"}
              </Text>
            </Pressable>
          ))}
        </>
      ) : null}
      {detail.closure ? (
        <>
          <Text style={styles.section}>Closure</Text>
          <Text style={styles.meta}>
            Closed {new Date(detail.closure.closedAt).toLocaleString()}
          </Text>
        </>
      ) : null}
      <Text style={styles.note}>This archived record is read-only.</Text>
    </ScrollView>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
  container: { padding: 16, gap: 8 },
  title: { fontSize: 20, fontWeight: "600", color: c.foreground },
  meta: { fontSize: 14, color: c.mutedForeground },
  section: { fontSize: 14, fontWeight: "600", marginTop: 12, color: c.foreground },
  downloadRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 6,
  },
  link: { fontSize: 14, color: c.primary, fontWeight: "500" },
  note: { fontSize: 12, color: c.mutedForeground, marginTop: 16 },
  error: { color: c.danger, padding: 16 },
});
