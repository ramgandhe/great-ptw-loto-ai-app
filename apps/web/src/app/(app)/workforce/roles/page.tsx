"use client";

import { useState } from "react";
import Link from "next/link";
import { ApiError } from "@/lib/api";
import { assignUserRole } from "@/lib/workforce/api";
import { Button } from "@/components/ui/button";

export default function UserRolesPage() {
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      await assignUserRole(userId.trim(), role.trim());
      setMessage("Role assigned successfully.");
      setUserId("");
      setRole("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Assignment failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <div className="flex justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">User roles</h1>
          <p className="text-sm text-muted-foreground">Assign organisational roles to users.</p>
        </div>
        <Link href="/workforce"><Button variant="outline">Back</Button></Link>
      </div>
      <form onSubmit={handleSubmit} className="grid max-w-md gap-4 rounded-lg border border-border bg-card p-4">
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">User ID *</span>
          <input required value={userId} className="h-9 rounded-lg border border-border px-3" onChange={(e) => setUserId(e.target.value)} />
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Role *</span>
          <input required value={role} className="h-9 rounded-lg border border-border px-3" onChange={(e) => setRole(e.target.value)} />
        </label>
        <Button type="submit" disabled={submitting}>{submitting ? "Assigning..." : "Assign role"}</Button>
      </form>
      {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
    </main>
  );
}
