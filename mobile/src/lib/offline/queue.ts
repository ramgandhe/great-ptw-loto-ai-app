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
  attempts: number;
  createdAt: string;
  localRef: string | null;
  lastError: string | null;
};

type SyncQueueRow = {
  id: number;
  entity_type: string;
  method: SyncMethod;
  path: string;
  payload: string;
  status: SyncStatus;
  attempts: number;
  created_at: string;
  local_ref: string | null;
  last_error: string | null;
};

function mapRow(row: SyncQueueRow): SyncQueueItem {
  return {
    id: row.id,
    entityType: row.entity_type,
    method: row.method,
    path: row.path,
    payload: row.payload,
    status: row.status,
    attempts: row.attempts ?? 0,
    createdAt: row.created_at,
    localRef: row.local_ref,
    lastError: row.last_error,
  };
}

export async function enqueueSyncItem(input: {
  entityType: string;
  method: SyncMethod;
  path: string;
  payload: Record<string, unknown>;
  localRef?: string;
}): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    "INSERT INTO sync_queue (entity_type, method, path, payload, status, local_ref) VALUES (?, ?, ?, ?, 'pending', ?)",
    input.entityType,
    input.method,
    input.path,
    JSON.stringify(input.payload),
    input.localRef ?? null,
  );
}

export async function getPendingSyncItems(): Promise<SyncQueueItem[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<SyncQueueRow>(
    "SELECT id, entity_type, method, path, payload, status, attempts, created_at, local_ref, last_error FROM sync_queue WHERE status = 'pending' ORDER BY id ASC",
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

/** Stops an item for review; its payload is the person's input and stays in the queue. */
export async function markSyncItemFailed(id: number, reason?: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("UPDATE sync_queue SET status = 'failed', last_error = COALESCE(?, last_error) WHERE id = ?", reason ?? null, id);
}

export async function getLocalIdMap(): Promise<Map<string, string>> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ local_id: string; server_id: string }>("SELECT local_id, server_id FROM local_ids");
  return new Map(rows.map((row) => [row.local_id, row.server_id]));
}

export async function saveLocalId(localId: string, serverId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("INSERT OR REPLACE INTO local_ids (local_id, server_id) VALUES (?, ?)", localId, serverId);
}

/** Queued saves still waiting for a path: each bumps the permit's revision once when it replays. */
export async function countPendingSaves(path: string): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM sync_queue WHERE status = 'pending' AND method = 'PATCH' AND path = ?",
    path,
  );
  return row?.count ?? 0;
}

export async function getFailedSyncItems(): Promise<SyncQueueItem[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<SyncQueueRow>(
    "SELECT id, entity_type, method, path, payload, status, attempts, created_at, local_ref, last_error FROM sync_queue WHERE status = 'failed' ORDER BY id ASC",
  );
  return rows.map(mapRow);
}

export const MAX_SYNC_ATTEMPTS = 5;

export async function incrementSyncAttempt(id: number): Promise<boolean> {
  const db = await getDatabase();
  await db.runAsync("UPDATE sync_queue SET attempts = attempts + 1 WHERE id = ?", id);
  const row = await db.getFirstAsync<{ attempts: number }>(
    "SELECT attempts FROM sync_queue WHERE id = ?",
    id,
  );
  const attempts = row?.attempts ?? 0;
  if (attempts >= MAX_SYNC_ATTEMPTS) {
    await markSyncItemFailed(id, "The server could not be reached after several tries.");
    return true;
  }
  return false;
}

export async function getFailedSyncCount(): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM sync_queue WHERE status = 'failed'",
  );
  return row?.count ?? 0;
}
