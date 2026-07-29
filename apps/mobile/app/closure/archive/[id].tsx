import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { ApiError } from "@/lib/api";
import { getArchivedPermit, getArchiveAttachmentDownloadUrl } from "@/lib/closure/api";
import type { ArchivedPermitDetail } from "@/lib/closure/types";
import { openPresignedDownload } from "@/lib/download";
import { getEvidenceDownloadUrl, listEvidence, listProgress } from "@/lib/execution/api";
import type { EvidenceRecord } from "@/lib/execution/types";

export default function HistoricalPermitScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const permitId = id ?? "";
  const [detail, setDetail] = useState<ArchivedPermitDetail | null>(null);
  const [progressCount, setProgressCount] = useState(0);
  const [evidence, setEvidence] = useState<EvidenceRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    if (!permitId) {
      return;
    }
    Promise.all([
      getArchivedPermit(permitId),
      listProgress(permitId).catch(() => []),
      listEvidence(permitId).catch(() => []),
    ])
      .then(([archived, progress, evidenceItems]) => {
        setDetail(archived);
        setProgressCount(progress.length);
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
      <Text style={styles.meta}>{progressCount} progress update(s)</Text>
      <Text style={styles.meta}>{evidence.length} evidence file(s)</Text>
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
      {evidence.length > 0 ? (
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

const styles = StyleSheet.create({
  container: { padding: 16, gap: 8 },
  title: { fontSize: 20, fontWeight: "600" },
  meta: { fontSize: 14, color: "#666" },
  section: { fontSize: 14, fontWeight: "600", marginTop: 12 },
  downloadRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 6,
  },
  link: { fontSize: 14, color: "#2563eb", fontWeight: "500" },
  note: { fontSize: 12, color: "#888", marginTop: 16 },
  error: { color: "#b91c1c", padding: 16 },
});
