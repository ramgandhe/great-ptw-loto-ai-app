import * as SQLite from "expo-sqlite";
import { enqueueSyncItem } from "@/lib/storage";
import type { CreatePermitPayload, PermitRecord, SaveDraftPayload } from "./types";

const DB_NAME = "ptw_offline.db";

export type LocalPermitDraft = {
  id: string;
  title: string;
  status: string;
  payload: string;
  updatedAt: string;
};

async function getDb() {
  return SQLite.openDatabaseAsync(DB_NAME);
}

export async function initPermitOfflineStorage(): Promise<void> {
  const db = await getDb();
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS permit_local_drafts (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

export async function saveLocalPermitDraft(id: string, title: string, payload: SaveDraftPayload | CreatePermitPayload) {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO permit_local_drafts (id, title, status, payload, updated_at)
     VALUES (?, ?, 'draft', ?, datetime('now'))
     ON CONFLICT(id) DO UPDATE SET
       title = excluded.title,
       payload = excluded.payload,
       updated_at = excluded.updated_at`,
    id,
    title,
    JSON.stringify(payload),
  );
}

export async function listLocalPermitDrafts(): Promise<LocalPermitDraft[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    id: string;
    title: string;
    status: string;
    payload: string;
    updated_at: string;
  }>("SELECT id, title, status, payload, updated_at FROM permit_local_drafts ORDER BY updated_at DESC");

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    status: row.status,
    payload: row.payload,
    updatedAt: row.updated_at,
  }));
}

export async function getLocalPermitDraft(id: string): Promise<LocalPermitDraft | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{
    id: string;
    title: string;
    status: string;
    payload: string;
    updated_at: string;
  }>("SELECT id, title, status, payload, updated_at FROM permit_local_drafts WHERE id = ?", id);

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    title: row.title,
    status: row.status,
    payload: row.payload,
    updatedAt: row.updated_at,
  };
}

export async function removeLocalPermitDraft(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync("DELETE FROM permit_local_drafts WHERE id = ?", id);
}

export function isOfflineError(error: unknown): boolean {
  return error instanceof TypeError || (error instanceof Error && error.message.includes("Network request failed"));
}

export async function queuePermitMutation(input: {
  method: "POST" | "PATCH" | "POST_SUBMIT";
  path: string;
  payload?: Record<string, unknown>;
  localDraftId?: string;
  title?: string;
}) {
  const method = input.method === "POST_SUBMIT" ? "POST" : input.method;
  await enqueueSyncItem({
    entityType: "permits",
    method,
    path: input.path,
    payload: {
      ...(input.payload ?? {}),
      ...(input.localDraftId ? { localDraftId: input.localDraftId } : {}),
      ...(input.title ? { title: input.title } : {}),
      ...(input.method === "POST_SUBMIT" ? { submit: true } : {}),
    },
  });
}

export function localDraftToPermitRecord(draft: LocalPermitDraft): PermitRecord {
  const payload = JSON.parse(draft.payload) as CreatePermitPayload;
  const now = new Date().toISOString();

  return {
    id: draft.id,
    tenantId: "local",
    reference: null,
    status: draft.status,
    permitTypeId: payload.permitTypeId ?? "",
    title: draft.title,
    workScope: payload.workScope ?? null,
    plantId: payload.plantId ?? null,
    departmentId: payload.departmentId ?? null,
    locationId: payload.locationId ?? null,
    workstationId: payload.workstationId ?? null,
    machineryId: payload.machineryId ?? null,
    plannedStartAt: payload.plannedStartAt ?? null,
    plannedEndAt: payload.plannedEndAt ?? null,
    submittedAt: null,
    createdAt: now,
    updatedAt: draft.updatedAt,
  };
}
