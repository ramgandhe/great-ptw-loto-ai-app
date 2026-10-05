/**
 * Decides how one queued request is replayed (pure, so it can be tested without a device).
 * Permits created offline get a local id ("local-…"); requests queued after the create use that id
 * in their path until the create has replayed and the server id is known.
 */
export type QueuedRequest = { method: string; path: string; payload: string; localRef: string | null };

export type ReplayStep =
  | { kind: "send"; path: string; body: string; createsLocal: string | null }
  | { kind: "fail"; reason: string };

const LOCAL_IDS = /local-[A-Za-z0-9-]+/g;
const HAS_LOCAL_ID = /local-[A-Za-z0-9-]+/;
/** Keys older app versions put in the request body; the API refuses unknown keys. */
const LEGACY_KEYS = ["localDraftId", "action"];
const REVISIONED = /^\/permits\/[^/]+(\/submit)?$/;

export function prepareReplay(item: QueuedRequest, serverIds: ReadonlyMap<string, string>): ReplayStep {
  const body = item.payload ? (JSON.parse(item.payload) as Record<string, unknown>) : {};
  const legacyLocal = typeof body.localDraftId === "string" ? body.localDraftId : null;
  for (const key of LEGACY_KEYS) delete body[key];

  if (item.method === "POST" && item.path === "/permits") {
    return { kind: "send", path: item.path, body: JSON.stringify(body), createsLocal: item.localRef ?? legacyLocal };
  }

  const path = item.path.replace(LOCAL_IDS, (local) => serverIds.get(local) ?? local);
  if (HAS_LOCAL_ID.test(path)) {
    return { kind: "fail", reason: "The permit this change belongs to was never created on the server." };
  }
  // Saves and submits must carry the revision they were made against; never guess one.
  if (REVISIONED.test(path) && (item.method === "PATCH" || path.endsWith("/submit")) && !Number.isInteger(body.expectedRevision)) {
    return { kind: "fail", reason: "Saved offline by an older version of the app. Open the permit and save it again." };
  }
  return { kind: "send", path, body: JSON.stringify(body), createsLocal: null };
}

/** The permit a queued request acts on (local or server id), so a failure can hold back later requests for it. */
export function permitKey(item: Pick<QueuedRequest, "path" | "localRef" | "payload">): string | null {
  const match = /^\/permits\/([^/]+)/.exec(item.path);
  if (match) return match[1];
  if (item.localRef) return item.localRef;
  try {
    const legacy = (JSON.parse(item.payload) as { localDraftId?: unknown }).localDraftId;
    return typeof legacy === "string" ? legacy : null;
  } catch {
    return null;
  }
}

export type ReplayItem = QueuedRequest & { id: number };
export type ReplayOutcome = "done" | "refused" | "unreachable" | "signed-out";

/**
 * Replays queued requests in order. A request the server refuses is kept as failed with its reason,
 * and every later request for the same permit is held with it, so a submit never runs after the
 * save it depended on failed. Unreachable: stop and retry later, in order. Other permits carry on.
 */
export async function replayQueue(
  items: ReplayItem[],
  serverIds: Map<string, string>,
  effects: {
    send: (path: string, method: string, body: string) => Promise<{ outcome: ReplayOutcome; serverId?: string; reason?: string }>;
    done: (item: ReplayItem, created?: { localId: string; serverId: string }) => Promise<void>;
    failed: (item: ReplayItem, reason: string) => Promise<void>;
    unreachable: (item: ReplayItem) => Promise<boolean>;
  },
): Promise<{ processed: number; failed: number }> {
  const held = new Set<string>();
  let processed = 0;
  let failed = 0;
  const fail = async (item: ReplayItem, reason: string) => {
    await effects.failed(item, reason);
    const key = permitKey(item);
    if (key) held.add(key);
    failed += 1;
  };

  for (const item of items) {
    const key = permitKey(item);
    if (key && held.has(key)) {
      await fail(item, "Held because an earlier change to this permit did not sync.");
      continue;
    }
    const step = prepareReplay(item, serverIds);
    if (step.kind === "fail") {
      await fail(item, step.reason);
      continue;
    }
    const result = await effects.send(step.path, item.method, step.body);
    if (result.outcome === "done") {
      const created = step.createsLocal && result.serverId ? { localId: step.createsLocal, serverId: result.serverId } : undefined;
      if (created) serverIds.set(created.localId, created.serverId);
      await effects.done(item, created);
      processed += 1;
    } else if (result.outcome === "refused") {
      await fail(item, result.reason ?? "The server refused this change.");
    } else {
      if (result.outcome === "unreachable" && (await effects.unreachable(item))) failed += 1;
      break;
    }
  }
  return { processed, failed };
}
