"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { listArchivedPermits } from "@/lib/closure/api";
import type { ArchivedPermitSummary, ArchiveSearchParams } from "@/lib/closure/types";
import { SearchFilters } from "@/components/closure/search-filters";
import { PermitStatusBadge } from "@/components/permit/permit-status-badge";
import { Button } from "@/components/ui/button";

export default function PermitArchivePage() {
  const [filters, setFilters] = useState<ArchiveSearchParams>({});
  const [items, setItems] = useState<ArchivedPermitSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);

  const loadArchive = useCallback(async (params?: ArchiveSearchParams) => {
    setIsLoading(true);
    setError(null);
    try {
      setItems(await listArchivedPermits(params));
      setHasLoaded(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to search archive");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadArchive();
  }, [loadArchive]);

  async function handleSearch() {
    await loadArchive(filters);
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Permit archive</h1>
          <p className="text-sm text-muted-foreground">
            Search closed permits and review historical records.
          </p>
        </div>
        <Link href="/closure">
          <Button variant="ghost">Back to closure</Button>
        </Link>
      </div>

      <SearchFilters
        value={filters}
        isLoading={isLoading}
        onChange={setFilters}
        onSearch={handleSearch}
      />

      {error ? (
        <div role="alert" className="text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {hasLoaded && !isLoading && items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No archived permits match your search.</p>
      ) : isLoading && items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Loading archive...</p>
      ) : (
        <div className="grid gap-3">
          {items.map((item) => (
            <article key={item.permit.id} className="rounded-lg border border-border p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="mb-1 flex items-center gap-2">
                    <h3 className="font-semibold">{item.permit.title}</h3>
                    <PermitStatusBadge status={item.permit.status} />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {item.permit.reference ?? item.permit.id.slice(0, 8)} · Closed{" "}
                    {new Date(item.closedAt).toLocaleString()}
                  </p>
                </div>
                <Link href={`/closure/archive/${item.permit.id}`}>
                  <Button variant="outline" size="sm">
                    View record
                  </Button>
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
