import { cloneElement, isValidElement } from "react";
import { cn } from "@/lib/utils";

/** A labelled field. `error` is shown under it and tied to the control for assistive technology. */
export function FormField({
  label,
  htmlFor,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const errorId = `${htmlFor}-error`;
  const control =
    error && isValidElement<{ "aria-invalid"?: boolean; "aria-describedby"?: string }>(children)
      ? cloneElement(children, { "aria-invalid": true, "aria-describedby": errorId })
      : children;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-(--text-secondary)">
        {label}
      </label>
      {control}
      {error ? (
        <p id={errorId} className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export const fieldClassName =
  "h-11 w-full rounded-lg border border-input bg-input-fill px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive";
