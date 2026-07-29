import * as SQLite from "expo-sqlite";
import type { PendingEvidenceItem, PendingProgressItem } from "./types";

const DB_NAME = "ptw_offline.db";

function createId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

async function getDb() {
  return SQLite.openDatabaseAsync(DB_NAME);
}

export async function initExecutionOfflineStorage(): Promise<void> {
  const db = await getDb();
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS execution_pending_progress (
      id TEXT PRIMARY KEY NOT NULL,
      permit_id TEXT NOT NULL,
      summary TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS execution_pending_evidence (
      id TEXT PRIMARY KEY NOT NULL,
      permit_id TEXT NOT NULL,
      uri TEXT NOT NULL,
      file_name TEXT NOT NULL,
      content_type TEXT NOT NULL,
      comment TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

export async function queueOfflineProgress(permitId: string, summary: string): Promise<PendingProgressItem> {
  const db = await getDb();
  const id = createId();
  await db.runAsync(
    "INSERT INTO execution_pending_progress (id, permit_id, summary) VALUES (?, ?, ?)",
    id,
    permitId,
    summary,
  );
  return { id, permitId, summary, createdAt: new Date().toISOString() };
}

export async function listPendingProgress(): Promise<PendingProgressItem[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    id: string;
    permit_id: string;
    summary: string;
    created_at: string;
  }>("SELECT id, permit_id, summary, created_at FROM execution_pending_progress ORDER BY created_at ASC");

  return rows.map((row) => ({
    id: row.id,
    permitId: row.permit_id,
    summary: row.summary,
    createdAt: row.created_at,
  }));
}

export async function removePendingProgress(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync("DELETE FROM execution_pending_progress WHERE id = ?", id);
}

export async function queueOfflineEvidence(
  permitId: string,
  file: { uri: string; fileName: string; contentType: string; comment?: string },
): Promise<PendingEvidenceItem> {
  const db = await getDb();
  const id = createId();
  await db.runAsync(
    `INSERT INTO execution_pending_evidence (id, permit_id, uri, file_name, content_type, comment)
     VALUES (?, ?, ?, ?, ?, ?)`,
    id,
    permitId,
    file.uri,
    file.fileName,
    file.contentType,
    file.comment ?? null,
  );
  return {
    id,
    permitId,
    uri: file.uri,
    fileName: file.fileName,
    contentType: file.contentType,
    comment: file.comment,
    createdAt: new Date().toISOString(),
  };
}

export async function listPendingEvidence(): Promise<PendingEvidenceItem[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    id: string;
    permit_id: string;
    uri: string;
    file_name: string;
    content_type: string;
    comment: string | null;
    created_at: string;
  }>(
    "SELECT id, permit_id, uri, file_name, content_type, comment, created_at FROM execution_pending_evidence ORDER BY created_at ASC",
  );

  return rows.map((row) => ({
    id: row.id,
    permitId: row.permit_id,
    uri: row.uri,
    fileName: row.file_name,
    contentType: row.content_type,
    comment: row.comment ?? undefined,
    createdAt: row.created_at,
  }));
}

export async function removePendingEvidence(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync("DELETE FROM execution_pending_evidence WHERE id = ?", id);
}

export async function countPendingExecutionItems(): Promise<number> {
  const db = await getDb();
  const progress = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM execution_pending_progress",
  );
  const evidence = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM execution_pending_evidence",
  );
  return (progress?.count ?? 0) + (evidence?.count ?? 0);
}
