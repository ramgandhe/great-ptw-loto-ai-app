import * as SQLite from "expo-sqlite";
import type { PendingVerificationItem, VerificationChecklist } from "./types";

const DB_NAME = "ptw_offline.db";

function createId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

async function getDb() {
  return SQLite.openDatabaseAsync(DB_NAME);
}

export async function initClosureOfflineStorage(): Promise<void> {
  const db = await getDb();
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS closure_pending_verification (
      id TEXT PRIMARY KEY NOT NULL,
      permit_id TEXT NOT NULL,
      checklist TEXT NOT NULL,
      comment TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

export async function queueOfflineVerification(
  permitId: string,
  checklist: VerificationChecklist,
  comment?: string,
): Promise<PendingVerificationItem> {
  const db = await getDb();
  const id = createId();
  await db.runAsync(
    "INSERT INTO closure_pending_verification (id, permit_id, checklist, comment) VALUES (?, ?, ?, ?)",
    id,
    permitId,
    JSON.stringify(checklist),
    comment ?? null,
  );
  return { id, permitId, checklist, comment, createdAt: new Date().toISOString() };
}

export async function listPendingVerifications(): Promise<PendingVerificationItem[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    id: string;
    permit_id: string;
    checklist: string;
    comment: string | null;
    created_at: string;
  }>(
    "SELECT id, permit_id, checklist, comment, created_at FROM closure_pending_verification ORDER BY created_at ASC",
  );

  return rows.map((row) => ({
    id: row.id,
    permitId: row.permit_id,
    checklist: JSON.parse(row.checklist) as VerificationChecklist,
    comment: row.comment ?? undefined,
    createdAt: row.created_at,
  }));
}

export async function removePendingVerification(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync("DELETE FROM closure_pending_verification WHERE id = ?", id);
}

export async function countPendingClosureItems(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM closure_pending_verification",
  );
  return row?.count ?? 0;
}
