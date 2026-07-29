import { apiClient } from "./client";
import { offlineFetch } from "@/lib/offline";

export interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  version: string;
  timestamp: string;
}

export interface SystemVersion {
  version: string;
  apiVersion: string;
  environment: string;
  buildTime: string | null;
}

export function getHealth() {
  return offlineFetch<HealthStatus>("/health", { auth: false, method: "GET" });
}

export function getSystemVersion() {
  return apiClient.get<SystemVersion>("/system/version", { auth: false });
}
