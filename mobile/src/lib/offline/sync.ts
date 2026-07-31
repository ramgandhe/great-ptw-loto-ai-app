import { fetchApi, type FetchApiOptions } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { getNetworkOnline } from "./connectivity";
import {
  getPendingSyncItems,
  incrementSyncAttempt,
  removeSyncItem,
} from "./queue";

export type SyncResult = {
  processed: number;
  failed: number;
  skipped: boolean;
};

export async function processSyncQueue(): Promise<SyncResult> {
  const online = await getNetworkOnline();
  if (!online) {
    return { processed: 0, failed: 0, skipped: true };
  }

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
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        return { processed, failed, skipped: false };
      }

      const markedFailed = await incrementSyncAttempt(item.id);
      if (markedFailed) {
        failed += 1;
      }

      break;
    }
  }

  return { processed, failed, skipped: false };
}
