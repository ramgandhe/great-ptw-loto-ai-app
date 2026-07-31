"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ApiError } from "@/lib/api";
import { listWorkforceDirectory } from "@/lib/workforce/api";
import type { WorkforceRecord } from "@/lib/workforce/types";
import { OrgStatusBadge } from "@/components/organisation/org-status-badge";
import { Button } from "@/components/ui/button";

export default function WorkforceDirectoryPage() {
  const [items, setItems] = useState<WorkforceRecord[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listWorkforceDirectory()
      .then(setItems)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load directory"));
  }, []);

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <div className="flex justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Workforce directory</h1>
          <p className="text-sm text-muted-foreground">All active workforce members.</p>
        </div>
        <Link href="/workforce"><Button variant="outline">Back</Button></Link>
      </div>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      <table className="min-w-full text-sm border border-border rounded-lg overflow-hidden">
        <thead className="bg-muted/50 text-left">
          <tr>
            <th className="px-4 py-3">Name</th>
            <th className="px-4 py-3">Email</th>
            <th className="px-4 py-3">Role</th>
            <th className="px-4 py-3">Status</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-t border-border">
              <td className="px-4 py-3">{item.name}</td>
              <td className="px-4 py-3 text-muted-foreground">{item.email ?? "—"}</td>
              <td className="px-4 py-3">{item.role ?? "—"}</td>
              <td className="px-4 py-3"><OrgStatusBadge status={item.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
