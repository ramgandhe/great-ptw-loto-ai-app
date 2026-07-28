import { getDatabase } from "./database";

export async function setCachedResponse<T>(cacheKey: string, data: T): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    "INSERT INTO offline_cache (cache_key, data, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(cache_key) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at",
    cacheKey,
    JSON.stringify(data),
  );
}

export async function getCachedResponse<T>(cacheKey: string): Promise<T | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ data: string }>(
    "SELECT data FROM offline_cache WHERE cache_key = ?",
    cacheKey,
  );
  if (!row) {
    return null;
  }
  return JSON.parse(row.data) as T;
}

export async function clearCachedResponse(cacheKey: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("DELETE FROM offline_cache WHERE cache_key = ?", cacheKey);
}
