import { cn } from "@/lib/utils";
import { PERMIT_WIZARD_STEPS } from "@/lib/permit/form";

export function PermitStepNav({
  currentStep,
  onStepClick,
}: {
  currentStep: number;
  onStepClick?: (step: number) => void;
}) {
  return (
    <ol className="flex flex-wrap gap-2">
      {PERMIT_WIZARD_STEPS.map((step, index) => {
        const isActive = index === currentStep;
        const isComplete = index < currentStep;

        return (
          <li key={step.label}>
            <button
              type="button"
              onClick={() => onStepClick?.(index)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : isComplete
                    ? "bg-accent text-accent-foreground"
                    : "bg-muted text-muted-foreground",
              )}
            >
              {index + 1}. {step.label}
            </button>
          </li>
        );
      })}
    </ol>
  );
}
