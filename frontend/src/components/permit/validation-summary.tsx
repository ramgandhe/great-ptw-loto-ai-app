/** Errors after a refused submit; each links to the section where it is fixed. */
export function ValidationSummary({ errors }: { errors: { message: string; href?: string }[] }) {
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
              <a href={error.href} className="underline underline-offset-2">
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
