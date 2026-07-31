import { getDatabase } from "./database";

export type SyncMethod = "POST" | "PUT" | "PATCH" | "DELETE";
export type SyncStatus = "pending" | "failed";

export type SyncQueueItem = {
  id: number;
  entityType: string;
  method: SyncMethod;
  path: string;
  payload: string;
  status: SyncStatus;
  createdAt: string;
};

type SyncQueueRow = {
  id: number;
  entity_type: string;
  method: SyncMethod;
  path: string;
  payload: string;
  status: SyncStatus;
  created_at: string;
};

function mapRow(row: SyncQueueRow): SyncQueueItem {
  return {
    id: row.id,
    entityType: row.entity_type,
    method: row.method,
    path: row.path,
    payload: row.payload,
    status: row.status,
    createdAt: row.created_at,
  };
}

export async function enqueueSyncItem(input: {
  entityType: string;
  method: SyncMethod;
  path: string;
  payload: Record<string, unknown>;
}): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    "INSERT INTO sync_queue (entity_type, method, path, payload, status) VALUES (?, ?, ?, ?, 'pending')",
    input.entityType,
    input.method,
    input.path,
    JSON.stringify(input.payload),
  );
}

export async function getPendingSyncItems(): Promise<SyncQueueItem[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<SyncQueueRow>(
    "SELECT id, entity_type, method, path, payload, status, created_at FROM sync_queue WHERE status = 'pending' ORDER BY id ASC",
  );
  return rows.map(mapRow);
}

export async function getPendingSyncCount(): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM sync_queue WHERE status = 'pending'",
  );
  return row?.count ?? 0;
}

export async function removeSyncItem(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("DELETE FROM sync_queue WHERE id = ?", id);
}

export async function markSyncItemFailed(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("UPDATE sync_queue SET status = 'failed' WHERE id = ?", id);
}
