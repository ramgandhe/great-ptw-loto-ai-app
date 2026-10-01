import { fetchApi } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { getNetworkOnline } from "./connectivity";
import { getDatabase } from "./database";
import {
  getLocalIdMap,
  getPendingSyncItems,
  incrementSyncAttempt,
  markSyncItemFailed,
  removeSyncItem,
  saveLocalId,
} from "./queue";
import { replayQueue, type ReplayOutcome } from "./replay";

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

  const result = await replayQueue(await getPendingSyncItems(), await getLocalIdMap(), {
    async send(path, method, body) {
      try {
        const response = await fetchApi<{ permit?: { id: string } }>(path, { method, body });
        return { outcome: "done" as ReplayOutcome, serverId: response.permit?.id };
      } catch (error) {
        const status = error instanceof ApiError ? (error.status ?? 0) : 0;
        if (status === 401) return { outcome: "signed-out" as ReplayOutcome };
        // Refused (conflict, validation, access): the same request can never succeed.
        if (status >= 400 && status < 500) return { outcome: "refused" as ReplayOutcome, reason: (error as ApiError).message };
        return { outcome: "unreachable" as ReplayOutcome };
      }
    },
    async done(item, created) {
      if (created) {
        await saveLocalId(created.localId, created.serverId);
        // The server copy replaces the local draft in lists.
        await getDatabase()
          .then((db) => db.runAsync("DELETE FROM permit_local_drafts WHERE id = ?", created.localId))
          .catch(() => undefined);
      }
      await removeSyncItem(item.id);
    },
    failed: (item, reason) => markSyncItemFailed(item.id, reason),
    unreachable: (item) => incrementSyncAttempt(item.id),
  });
  return { ...result, skipped: false };
}
