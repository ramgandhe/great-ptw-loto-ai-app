import { fetchApi, type FetchApiOptions } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { getCachedResponse, setCachedResponse } from "./cache";
import { getNetworkOnline } from "./connectivity";
import { enqueueSyncItem, type SyncMethod } from "./queue";

const MUTATION_METHODS = new Set<SyncMethod>(["POST", "PUT", "PATCH", "DELETE"]);

function resolveMethod(method?: string): SyncMethod | "GET" {
  const resolved = (method ?? "GET").toUpperCase();
  if (resolved === "GET") {
    return "GET";
  }
  if (MUTATION_METHODS.has(resolved as SyncMethod)) {
    return resolved as SyncMethod;
  }
  throw new ApiError(`Unsupported offline method: ${resolved}`, "UNSUPPORTED_METHOD");
}

export async function offlineFetch<T>(path: string, options: FetchApiOptions = {}): Promise<T> {
  const method = resolveMethod(options.method);
  const online = await getNetworkOnline();

  if (method === "GET") {
    if (online) {
      const data = await fetchApi<T>(path, options);
      await setCachedResponse(path, data);
      return data;
    }

    const cached = await getCachedResponse<T>(path);
    if (cached !== null) {
      return cached;
    }

    throw new ApiError("No cached data available while offline", "OFFLINE_CACHE_MISS", 0);
  }

  if (!online) {
    const payload =
      typeof options.body === "string" && options.body.length > 0
        ? (JSON.parse(options.body) as Record<string, unknown>)
        : {};

    await enqueueSyncItem({
      entityType: path.split("/").filter(Boolean)[0] ?? "unknown",
      method,
      path,
      payload,
    });

    throw new ApiError("Request queued for sync when online", "OFFLINE_QUEUED", 0);
  }

  return fetchApi<T>(path, options);
}
