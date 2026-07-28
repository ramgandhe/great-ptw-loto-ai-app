import { getDatabase, initDatabase } from "./database";

export async function initOfflineStorage(): Promise<void> {
  await initDatabase();
}

export async function enqueueSyncItem(entityType: string, payload: Record<string, unknown>) {
  const db = await getDatabase();
  await db.runAsync(
    "INSERT INTO sync_queue (entity_type, payload) VALUES (?, ?)",
    entityType,
    JSON.stringify(payload),
  );
}

export async function getSyncQueueCount(): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM sync_queue",
  );
  return row?.count ?? 0;
}
