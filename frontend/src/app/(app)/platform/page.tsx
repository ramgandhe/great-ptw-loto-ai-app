"use client";

import { Activity, CheckCircle2, Server, XCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  getHealth,
  getLiveness,
  getReadiness,
  getSystemVersion,
} from "@/lib/system/api";
import type { HealthStatus, ReadinessStatus, SystemVersion } from "@/lib/system/types";

function statusIcon(status: string) {
  if (status === "healthy" || status === "ready" || status === "alive" || status === "up") {
    return <CheckCircle2 className="size-4 text-primary" aria-hidden />;
  }
  if (status === "degraded" || status === "not_ready") {
    return <Activity className="size-4 text-muted-foreground" aria-hidden />;
  }
  return <XCircle className="size-4 text-destructive" aria-hidden />;
}

function formatStatusLabel(status: string): string {
  return status.replace(/_/g, " ");
}

export default function PlatformPage() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [readiness, setReadiness] = useState<ReadinessStatus | null>(null);
  const [liveStatus, setLiveStatus] = useState<string | null>(null);
  const [version, setVersion] = useState<SystemVersion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(() => {
    setIsLoading(true);
    setError(null);

    Promise.all([
      getHealth(),
      getReadiness().catch(() => null),
      getLiveness(),
      getSystemVersion(),
    ])
      .then(([healthData, readinessData, live, versionData]) => {
        setHealth(healthData);
        setReadiness(readinessData);
        setLiveStatus(live.status);
        setVersion(versionData);
      })
      .catch((err) => {
        setHealth(null);
        setReadiness(null);
        setLiveStatus(null);
        setVersion(null);
        setError(err instanceof Error ? err.message : "Failed to load platform status");
      })
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Server className="size-6" aria-hidden />
          <div>
            <h1 className="text-2xl font-semibold">Platform status</h1>
            <p className="text-sm text-muted-foreground">
              Production readiness probes for API health, liveness and version.
            </p>
          </div>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={load} disabled={isLoading}>
          Refresh
        </Button>
      </div>

      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </div>
      ) : null}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Checking platform status…</p>
      ) : (
        <>
          {version ? (
            <section className="rounded-lg border border-border bg-card p-5">
              <h2 className="text-sm font-semibold">Release</h2>
              <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <dt className="text-xs text-muted-foreground">Version</dt>
                  <dd className="font-medium">{version.version}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">API</dt>
                  <dd className="font-medium">{version.apiVersion}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Environment</dt>
                  <dd className="font-medium">{version.environment}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Build time</dt>
                  <dd className="font-medium">{version.buildTime ?? "—"}</dd>
                </div>
              </dl>
            </section>
          ) : null}

          <section className="grid gap-4 lg:grid-cols-3">
            <article className="rounded-lg border border-border bg-card p-5">
              <div className="flex items-center gap-2">
                {statusIcon(health?.status ?? "unhealthy")}
                <h2 className="text-sm font-semibold">Health</h2>
              </div>
              <p className="mt-2 text-lg font-medium capitalize">
                {health ? formatStatusLabel(health.status) : "Unknown"}
              </p>
            </article>

            <article className="rounded-lg border border-border bg-card p-5">
              <div className="flex items-center gap-2">
                {statusIcon(readiness?.status ?? "not_ready")}
                <h2 className="text-sm font-semibold">Readiness</h2>
              </div>
              <p className="mt-2 text-lg font-medium capitalize">
                {readiness ? formatStatusLabel(readiness.status) : "Unavailable"}
              </p>
            </article>

            <article className="rounded-lg border border-border bg-card p-5">
              <div className="flex items-center gap-2">
                {statusIcon(liveStatus ?? "down")}
                <h2 className="text-sm font-semibold">Liveness</h2>
              </div>
              <p className="mt-2 text-lg font-medium capitalize">
                {liveStatus ? formatStatusLabel(liveStatus) : "Unknown"}
              </p>
            </article>
          </section>

          {health?.services ? (
            <section className="rounded-lg border border-border p-5">
              <h2 className="text-sm font-semibold">Dependencies</h2>
              <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                {Object.entries(health.services).map(([name, service]) => (
                  <li
                    key={name}
                    className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm"
                  >
                    <span className="font-medium capitalize">{name}</span>
                    <span className="inline-flex items-center gap-1.5">
                      {statusIcon(service.status)}
                      <span>{service.status === "up" ? "Up" : "Down"}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </main>
  );
}
