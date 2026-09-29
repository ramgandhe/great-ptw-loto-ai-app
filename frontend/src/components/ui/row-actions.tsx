import { Button } from "@/components/ui/button";

export type RowAction = {
  label: string;
  onClick: () => void;
  /** Delete, archive and other removals. */
  danger?: boolean;
  disabled?: boolean;
};

/** The actions at the end of an admin list row: same size and order everywhere, removals last in red. */
export function RowActions({ actions }: { actions: (RowAction | false | null | undefined)[] }) {
  return (
    <div className="flex flex-wrap justify-end gap-2" onClick={(e) => e.stopPropagation()}>
      {actions.filter((a): a is RowAction => Boolean(a)).map((a) => (
        <Button key={a.label} type="button" size="sm" variant={a.danger ? "destructive" : "outline"} disabled={a.disabled} onClick={a.onClick}>
          {a.label}
        </Button>
      ))}
    </div>
  );
}
