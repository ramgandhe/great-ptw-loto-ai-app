"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CalendarClock } from "lucide-react";
import { ApiError } from "@/lib/api";
import {
  getMorningQueue,
  type MorningQueueBucket,
  type MorningQueueItem,
  type MorningQueueResponse,
} from "@/lib/multi-day/api";
import { PermitStatusBadge } from "@/components/permit/permit-status-badge";
import { Button } from "@/components/ui/button";

const BUCKET_ORDER: MorningQueueBucket[] = [
  "late_secure_required",
  "reopen_due",
  "tbt_due",
  "crew_due",
  "secure_due",
  "overtime_pending",
  "extension_pending",
  "validity_ending",
];

const BUCKET_LABELS: Record<MorningQueueBucket, string> = {
  late_secure_required: "Late secure",
  reopen_due: "Reopen due",
  tbt_due: "Toolbox talk due",
  crew_due: "Crew roster due",
  secure_due: "Secure due",
  overtime_pending: "Overtime pending",
  extension_pending: "Extension pending",
  validity_ending: "Validity ending",
};

function QueueSection({
  bucket,
  items,
}: {
  bucket: MorningQueueBucket;
  items: MorningQueueItem[];
}) {
  return (
    <section className="grid gap-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {BUCKET_LABELS[bucket]}{" "}
        <span className="font-normal normal-case">({items.length})</span>
      </h2>
      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
          None.
        </p>
      ) : (
        <div className="grid gap-2">
          {items.map((item) => (
            <article
              key={`${bucket}-${item.permitId}-${item.detail ?? ""}`}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-medium">{item.title}</h3>
                  <PermitStatusBadge status={item.status} />
                </div>
                <p className="text-sm text-muted-foreground">
                  {item.reference ?? "No reference"}
                  {item.operationalDate ? ` · ${item.operationalDate}` : ""}
                  {item.detail ? ` · ${item.detail}` : ""}
                </p>
              </div>
              <Link href={item.href}>
                <Button variant="outline" size="sm">
                  Open
                </Button>
              </Link>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export default function MorningQueuePage() {
  const [queue, setQueue] = useState<MorningQueueResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMorningQueue()
      .then(setQueue)
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Failed to load morning queue"),
      )
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <CalendarClock className="size-5" aria-hidden />
          Morning queue
        </h1>
        <p className="text-sm text-muted-foreground">
          Multi-day actions for today
          {queue
            ? ` · ${queue.operationalDate} (${queue.timezone}, cut-off ${queue.cutoff})`
            : ""}
          .
        </p>
      </div>

      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
        >
          {error}
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading morning queue…</p>
      ) : queue ? (
        <div className="grid gap-8">
          {BUCKET_ORDER.map((bucket) => (
            <QueueSection key={bucket} bucket={bucket} items={queue.buckets[bucket]} />
          ))}
        </div>
      ) : null}
    </main>
  );
}
