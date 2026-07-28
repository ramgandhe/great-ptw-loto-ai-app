import * as SQLite from "expo-sqlite";

export const DB_NAME = "ptw_offline.db";
export const SCHEMA_VERSION = 1;

let database: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!database) {
    database = await SQLite.openDatabaseAsync(DB_NAME);
    await database.execAsync("PRAGMA foreign_keys = ON;");
  }
  return database;
}

export async function initDatabase(): Promise<void> {
  const db = await getDatabase();

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const row = await db.getFirstAsync<{ version: number }>(
    "SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1",
  );

  if (!row) {
    await db.runAsync("INSERT INTO schema_migrations (version) VALUES (?)", SCHEMA_VERSION);
  }
}

export async function getDatabaseStatus(): Promise<{ ready: boolean; schemaVersion: number | null }> {
  try {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ version: number }>(
      "SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1",
    );
    return { ready: true, schemaVersion: row?.version ?? null };
  } catch {
    return { ready: false, schemaVersion: null };
  }
}
