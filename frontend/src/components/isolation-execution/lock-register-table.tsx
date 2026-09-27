import type { AppliedLock } from "@/lib/isolation-execution/types";
import { formatDateTime } from "@/lib/format";

type LockRegisterTableProps = {
  locks: AppliedLock[];
  pointLabels: Record<string, string>;
};

export function LockRegisterTable({ locks, pointLabels }: LockRegisterTableProps) {
  if (locks.length === 0) {
    return <p className="text-sm text-muted-foreground">No locks applied yet.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left">
          <tr>
            <th className="px-3 py-2 font-medium">Isolation point</th>
            <th className="px-3 py-2 font-medium">Lock tag</th>
            <th className="px-3 py-2 font-medium">Method</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium">Applied</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {locks.map((lock) => (
            <tr key={lock.id}>
              <td className="px-3 py-2">
                {pointLabels[lock.isolationPointId] ?? "Unknown point"}
              </td>
              <td className="px-3 py-2">{lock.lockTag}</td>
              <td className="px-3 py-2">{lock.lockMethod}</td>
              <td className="px-3 py-2 capitalize">{lock.status.replace(/_/g, " ")}</td>
              <td className="px-3 py-2 text-muted-foreground">
                {formatDateTime(lock.appliedAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
