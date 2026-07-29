import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { ApiError } from "@/lib/api";
import { getArchivedPermit } from "@/lib/closure/api";
import type { ArchivedPermitDetail } from "@/lib/closure/types";
import { listEvidence, listProgress } from "@/lib/execution/api";

export default function HistoricalPermitScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const permitId = id ?? "";
  const [detail, setDetail] = useState<ArchivedPermitDetail | null>(null);
  const [progressCount, setProgressCount] = useState(0);
  const [evidenceCount, setEvidenceCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!permitId) {
      return;
    }
    Promise.all([
      getArchivedPermit(permitId),
      listProgress(permitId).catch(() => []),
      listEvidence(permitId).catch(() => []),
    ])
      .then(([archived, progress, evidence]) => {
        setDetail(archived);
        setProgressCount(progress.length);
        setEvidenceCount(evidence.length);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load record"))
      ;
  }, [permitId]);

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
      <Text style={styles.meta}>{evidenceCount} evidence file(s)</Text>
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
  note: { fontSize: 12, color: "#888", marginTop: 16 },
  error: { color: "#b91c1c", padding: 16 },
});
