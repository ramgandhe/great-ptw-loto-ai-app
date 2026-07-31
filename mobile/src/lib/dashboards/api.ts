import { offlineFetch } from "@/lib/offline/client";
import type { DashboardKind, DashboardPayload } from "./types";

export function getDashboard(kind?: DashboardKind) {
  const query = kind ? `?kind=${kind}` : "";
  return offlineFetch<DashboardPayload>(`/dashboard${query}`);
}
