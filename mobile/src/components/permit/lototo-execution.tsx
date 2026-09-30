import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { ApiError } from "@/lib/api";
import {
  getPermitLototoExecution,
  recordPermitLototoCrew,
  recordPermitLototoRestore,
  recordPermitLototoRestoreVerify,
  recordPermitLototoVerify,
} from "@/lib/permit/api";
import type { PermitLototoExecutionBoard, PermitLototoExecutionPoint } from "@/lib/permit/types";

function pointRef(point: PermitLototoExecutionPoint) {
  return point.basePointId ? { basePointId: point.basePointId } : { extraPointId: point.extraPointId ?? undefined };
}

export function PermitLototoExecution({
  permitId,
  onBoardChange,
}: {
  permitId: string;
  onBoardChange?: (board: PermitLototoExecutionBoard) => void;
}) {
  const [board, setBoard] = useState<PermitLototoExecutionBoard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lockTagId, setLockTagId] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    getPermitLototoExecution(permitId)
      .then((next) => {
        setBoard(next);
        onBoardChange?.(next);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load LOTOTO"));
  }, [permitId]);

  if (error) {
    return <Text style={styles.error}>{error}</Text>;
  }
  if (!board) {
    return <ActivityIndicator />;
  }
  if (board.instances.length === 0) {
    return null;
  }

  const canWrite = board.permitStatus === "approved" || board.permitStatus === "active";
  const canRestore = board.permitStatus === "execution_completed" || board.permitStatus === "pending_closure";

  async function run(key: string, work: () => Promise<PermitLototoExecutionBoard>) {
    setBusy(key);
    setError(null);
    try {
      const next = await work();
      setBoard(next);
      onBoardChange?.(next);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save LOTOTO");
    } finally {
      setBusy(null);
    }
  }

  return (
    <View style={styles.section}>
      <Text style={styles.title}>{canRestore ? "LOTOTO restoration" : "LOTOTO isolation"}</Text>
      {board.instances.map((instance) => (
        <View key={instance.instanceId} style={styles.block}>
          <Text style={styles.proc}>
            {instance.procedureCode} {instance.procedureTitle}
          </Text>
          {!canRestore
            ? instance.points.map((point) => {
                const key = `${instance.instanceId}-${point.basePointId ?? point.extraPointId}`;
                return (
                  <View key={key} style={styles.point}>
                    <Text style={styles.pointTitle}>
                      {point.pointCode} · {point.status.replace(/_/g, " ")}
                    </Text>
                    {canWrite && (point.status === "pending_crew" || point.status === "failed") ? (
                      <>
                        <TextInput
                          style={styles.input}
                          placeholder="Lock / tag ID"
                          value={lockTagId[key] ?? ""}
                          onChangeText={(value) => setLockTagId((current) => ({ ...current, [key]: value }))}
                        />
                        <Pressable
                          style={styles.button}
                          disabled={busy === key || !(lockTagId[key] ?? "").trim()}
                          onPress={() =>
                            void run(key, () =>
                              recordPermitLototoCrew(permitId, instance.instanceId, {
                                ...pointRef(point),
                                lockTagId: (lockTagId[key] ?? "").trim(),
                              }),
                            )
                          }
                        >
                          <Text style={styles.buttonText}>Isolation complete</Text>
                        </Pressable>
                      </>
                    ) : null}
                    {canWrite && point.status === "pending_verify" ? (
                      <View style={styles.row}>
                        <Pressable
                          style={styles.button}
                          disabled={busy === key}
                          onPress={() =>
                            void run(key, () =>
                              recordPermitLototoVerify(permitId, instance.instanceId, {
                                ...pointRef(point),
                                result: "pass",
                                tryOutCompleted: true,
                              }),
                            )
                          }
                        >
                          <Text style={styles.buttonText}>Pass</Text>
                        </Pressable>
                        <Pressable
                          style={styles.danger}
                          disabled={busy === key}
                          onPress={() =>
                            void run(key, () =>
                              recordPermitLototoVerify(permitId, instance.instanceId, {
                                ...pointRef(point),
                                result: "fail",
                                tryOutCompleted: true,
                              }),
                            )
                          }
                        >
                          <Text style={styles.buttonText}>Fail</Text>
                        </Pressable>
                      </View>
                    ) : null}
                  </View>
                );
              })
            : [...instance.points].reverse().map((point) => {
                const key = `restore-${instance.instanceId}-${point.basePointId ?? point.extraPointId}`;
                return (
                  <View key={key} style={styles.point}>
                    <Text style={styles.pointTitle}>
                      {point.pointCode} · restore {point.restoreStatus.replace(/_/g, " ")}
                    </Text>
                    {point.restoreStatus === "pending_crew" || point.restoreStatus === "failed" ? (
                      <>
                        <TextInput
                          style={styles.input}
                          placeholder="Lock / tag ID"
                          value={lockTagId[key] ?? ""}
                          onChangeText={(value) => setLockTagId((current) => ({ ...current, [key]: value }))}
                        />
                        <Pressable
                          style={styles.button}
                          disabled={busy === key || !(lockTagId[key] ?? "").trim()}
                          onPress={() =>
                            void run(key, () =>
                              recordPermitLototoRestore(permitId, instance.instanceId, {
                                ...pointRef(point),
                                lockTagId: (lockTagId[key] ?? "").trim(),
                              }),
                            )
                          }
                        >
                          <Text style={styles.buttonText}>Restoration complete</Text>
                        </Pressable>
                      </>
                    ) : null}
                    {point.restoreStatus === "pending_verify" ? (
                      <View style={styles.row}>
                        <Pressable
                          style={styles.button}
                          disabled={busy === key}
                          onPress={() =>
                            void run(key, () =>
                              recordPermitLototoRestoreVerify(permitId, instance.instanceId, {
                                ...pointRef(point),
                                result: "pass",
                              }),
                            )
                          }
                        >
                          <Text style={styles.buttonText}>Pass</Text>
                        </Pressable>
                        <Pressable
                          style={styles.danger}
                          disabled={busy === key}
                          onPress={() =>
                            void run(key, () =>
                              recordPermitLototoRestoreVerify(permitId, instance.instanceId, {
                                ...pointRef(point),
                                result: "fail",
                              }),
                            )
                          }
                        >
                          <Text style={styles.buttonText}>Fail</Text>
                        </Pressable>
                      </View>
                    ) : null}
                  </View>
                );
              })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 10 },
  title: { fontSize: 16, fontWeight: "600" },
  block: { gap: 8, borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8, padding: 10 },
  proc: { fontSize: 13, fontWeight: "600" },
  point: { gap: 6, paddingTop: 6 },
  pointTitle: { fontSize: 13 },
  row: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  input: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8, padding: 8 },
  button: { backgroundColor: "#1f2937", borderRadius: 8, padding: 10, alignItems: "center", flexGrow: 1 },
  danger: { backgroundColor: "#b91c1c", borderRadius: 8, padding: 10, alignItems: "center", flexGrow: 1 },
  buttonText: { color: "#fff", fontWeight: "500" },
  error: { color: "#b91c1c" },
});
