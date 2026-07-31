import { fetchApi } from "@/lib/api";
import type {
  ClientConfig,
  HealthStatus,
  LivenessStatus,
  ReadinessStatus,
  SystemVersion,
} from "./types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

async function fetchPublic<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`);
  const body = await response.json();

  if (!response.ok || body.success === false) {
    throw new Error(body.error?.message ?? "Request failed");
  }

  return body.data as T;
}

export function getHealth() {
  return fetchPublic<HealthStatus>("/health");
}

export function getLiveness() {
  return fetchPublic<LivenessStatus>("/health/live");
}

export async function getReadiness(): Promise<ReadinessStatus> {
  const response = await fetch(`${API_BASE_URL}/health/ready`);
  const body = await response.json();
  return (body.data ?? body) as ReadinessStatus;
}

export function getSystemVersion() {
  return fetchPublic<SystemVersion>("/system/version");
}

export function getSystemConfig() {
  return fetchPublic<ClientConfig>("/system/config");
}

export function getAuthenticatedHealth() {
  return fetchApi<HealthStatus>("/health");
}
