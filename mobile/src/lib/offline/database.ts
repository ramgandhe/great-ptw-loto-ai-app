import * as SQLite from "expo-sqlite";

export const DB_NAME = "ptw_offline.db";
export const SCHEMA_VERSION = 3;

let database: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!database) {
    database = await SQLite.openDatabaseAsync(DB_NAME);
    await database.execAsync("PRAGMA foreign_keys = ON;");
  }
  return database;
}

async function applyMigrations(db: SQLite.SQLiteDatabase, fromVersion: number): Promise<void> {
  if (fromVersion < 2) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS sync_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity_type TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS offline_cache (
        cache_key TEXT PRIMARY KEY NOT NULL,
        data TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);

    const columns = await db.getAllAsync<{ name: string }>("PRAGMA table_info(sync_queue)");
    const columnNames = new Set(columns.map((column) => column.name));

    if (!columnNames.has("method")) {
      await db.execAsync(
        "ALTER TABLE sync_queue ADD COLUMN method TEXT NOT NULL DEFAULT 'POST';",
      );
    }
    if (!columnNames.has("path")) {
      await db.execAsync("ALTER TABLE sync_queue ADD COLUMN path TEXT NOT NULL DEFAULT '';");
    }
    if (!columnNames.has("status")) {
      await db.execAsync(
        "ALTER TABLE sync_queue ADD COLUMN status TEXT NOT NULL DEFAULT 'pending';",
      );
    }
  }

  if (fromVersion < 3) {
    const columns = await db.getAllAsync<{ name: string }>("PRAGMA table_info(sync_queue)");
    const columnNames = new Set(columns.map((column) => column.name));
    if (!columnNames.has("attempts")) {
      await db.execAsync(
        "ALTER TABLE sync_queue ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0;",
      );
    }
  }
}

export async function initOfflineDatabase(): Promise<void> {
  const db = await getDatabase();

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const row = await db.getFirstAsync<{ version: number }>(
    "SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1",
  );
  const currentVersion = row?.version ?? 0;

  if (currentVersion < SCHEMA_VERSION) {
    await applyMigrations(db, currentVersion);
    await db.runAsync("INSERT INTO schema_migrations (version) VALUES (?)", SCHEMA_VERSION);
  }
}

export async function getOfflineDatabaseStatus(): Promise<{
  ready: boolean;
  schemaVersion: number | null;
}> {
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
