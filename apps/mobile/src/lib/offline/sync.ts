import { fetchApi, type FetchApiOptions } from "@/lib/api/client";
import { getPendingSyncItems, markSyncItemFailed, removeSyncItem } from "./queue";

export type SyncResult = {
  processed: number;
  failed: number;
};

export async function processSyncQueue(): Promise<SyncResult> {
  const items = await getPendingSyncItems();
  let processed = 0;
  let failed = 0;

  for (const item of items) {
    const options: FetchApiOptions = {
      method: item.method,
      body: item.payload,
    };

    try {
      await fetchApi(item.path, options);
      await removeSyncItem(item.id);
      processed += 1;
    } catch {
      await markSyncItemFailed(item.id);
      failed += 1;
    }
  }

  return { processed, failed };
}
