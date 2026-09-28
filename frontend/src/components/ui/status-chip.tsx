import { cn } from "@/lib/utils";

/** The one status chip: tinted in its colour with a solid dot. Permit, LOTOTO, incident and SIMOPS badges all render this. */
export function StatusChip({ label, color, className }: { label: string; color: string; className?: string }) {
  return (
    <span
      className={cn("chip inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold", className)}
      style={{ "--chip": color } as React.CSSProperties}
    >
      <span aria-hidden className="size-1.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}
