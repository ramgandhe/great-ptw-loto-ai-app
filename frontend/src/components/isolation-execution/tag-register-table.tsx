import type { AppliedTag } from "@/lib/isolation-execution/types";

type TagRegisterTableProps = {
  tags: AppliedTag[];
  pointLabels: Record<string, string>;
};

export function TagRegisterTable({ tags, pointLabels }: TagRegisterTableProps) {
  if (tags.length === 0) {
    return <p className="text-sm text-muted-foreground">No tags applied yet.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left">
          <tr>
            <th className="px-3 py-2 font-medium">Isolation point</th>
            <th className="px-3 py-2 font-medium">Tag number</th>
            <th className="px-3 py-2 font-medium">Type</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium">Applied</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {tags.map((tag) => (
            <tr key={tag.id}>
              <td className="px-3 py-2">
                {pointLabels[tag.isolationPointId] ?? tag.isolationPointId.slice(0, 8)}
              </td>
              <td className="px-3 py-2">{tag.tagNumber}</td>
              <td className="px-3 py-2">{tag.tagType}</td>
              <td className="px-3 py-2 capitalize">{tag.status.replace(/_/g, " ")}</td>
              <td className="px-3 py-2 text-muted-foreground">
                {new Date(tag.appliedAt).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
