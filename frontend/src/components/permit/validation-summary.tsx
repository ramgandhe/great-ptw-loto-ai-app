"use client";

/** Moves to what an error is about: the field itself, or the first control of its section. */
function focusTarget(href: string) {
  const target = document.getElementById(href.slice(1));
  if (!target) return;
  const control = target.matches("input, select, textarea, button, [tabindex]")
    ? target
    : (target.querySelector<HTMLElement>('[aria-invalid="true"], [data-missing] :is(input, select, textarea, button):not([disabled])') ??
      target.querySelector<HTMLElement>("input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])"));
  target.scrollIntoView({ block: "center" });
  (control ?? target).focus({ preventScroll: true });
}

/** Errors after a refused submit; each link moves to the field (or section) where it is fixed. */
export function ValidationSummary<E extends { message: string; href?: string }>({
  errors,
  onGo,
}: {
  errors: E[];
  /** Called first, e.g. to show the step the field is on; the field is focused once that has rendered. */
  onGo?: (error: E) => void;
}) {
  if (errors.length === 0) {
    return null;
  }

  return (
    <div
      role="alert"
      tabIndex={-1}
      id="validation-summary"
      className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
    >
      <p className="font-medium">Please fix the following:</p>
      <ul className="mt-2 list-disc pl-5">
        {errors.map((error) => (
          <li key={error.message}>
            {error.href ? (
              <a
                href={error.href}
                onClick={(event) => {
                  event.preventDefault();
                  onGo?.(error);
                  setTimeout(() => focusTarget(error.href!), 0);
                }}
                className="underline underline-offset-2"
              >
                {error.message}
              </a>
            ) : (
              error.message
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
