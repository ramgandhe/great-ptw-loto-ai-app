export type HealthLevel = "healthy" | "degraded" | "unhealthy";

export type ServiceStatus = "up" | "down";

export interface ServiceHealth {
  status: ServiceStatus;
  message?: string;
}

export interface HealthStatus {
  status: HealthLevel;
  version: string;
  timestamp: string;
  services: Record<string, ServiceHealth>;
}

export type ReadinessLevel = "ready" | "not_ready";

export interface ReadinessStatus {
  status: ReadinessLevel;
  version: string;
  timestamp: string;
  services: Record<string, ServiceHealth>;
}

export interface LivenessStatus {
  status: "alive";
  version: string;
  timestamp: string;
}

export interface SystemVersion {
  version: string;
  apiVersion: string;
  environment: string;
  buildTime: string | null;
}

export interface ClientConfig {
  apiBaseUrl: string;
  keycloakUrl: string;
  keycloakRealm: string;
  keycloakClientId: string;
  features: Record<string, unknown>;
}
