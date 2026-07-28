import * as SQLite from "expo-sqlite";

const DB_NAME = "ptw_offline.db";

export async function initOfflineStorage(): Promise<void> {
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

export async function enqueueSyncItem(entityType: string, payload: Record<string, unknown>) {
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  await db.runAsync(
    "INSERT INTO sync_queue (entity_type, payload) VALUES (?, ?)",
    entityType,
    JSON.stringify(payload),
  );
}
