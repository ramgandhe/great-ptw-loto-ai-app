"use client";

import type { ArchiveSearchParams } from "@/lib/closure/types";
import { Button } from "@/components/ui/button";

type SearchFiltersProps = {
  value: ArchiveSearchParams;
  isLoading?: boolean;
  onChange: (value: ArchiveSearchParams) => void;
  onSearch: () => void;
};

export function SearchFilters({ value, isLoading = false, onChange, onSearch }: SearchFiltersProps) {
  return (
    <form
      className="grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSearch();
      }}
    >
      <div className="sm:col-span-2">
        <label htmlFor="archive-q" className="text-sm font-medium">
          Search
        </label>
        <input
          id="archive-q"
          type="search"
          value={value.q ?? ""}
          onChange={(event) => onChange({ ...value, q: event.target.value || undefined })}
          placeholder="Title, reference, or permit ID"
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label htmlFor="archive-from" className="text-sm font-medium">
          Closed from
        </label>
        <input
          id="archive-from"
          type="date"
          value={value.from ?? ""}
          onChange={(event) => onChange({ ...value, from: event.target.value || undefined })}
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label htmlFor="archive-to" className="text-sm font-medium">
          Closed to
        </label>
        <input
          id="archive-to"
          type="date"
          value={value.to ?? ""}
          onChange={(event) => onChange({ ...value, to: event.target.value || undefined })}
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>
      <div className="sm:col-span-4">
        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Searching..." : "Search archive"}
        </Button>
      </div>
    </form>
  );
}
