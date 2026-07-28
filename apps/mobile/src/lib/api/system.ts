import { apiClient } from "./client";

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
  return apiClient.get<HealthStatus>("/health", { auth: false });
}

export function getSystemVersion() {
  return apiClient.get<SystemVersion>("/system/version", { auth: false });
}
