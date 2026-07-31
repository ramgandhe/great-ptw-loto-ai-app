import { Check } from "lucide-react";
import {
  BILLING_INTERVAL_LABELS,
  formatPrice,
} from "@/lib/billing/labels";
import type { SubscriptionPlan } from "@/lib/billing/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PlanCardProps = {
  plan: SubscriptionPlan;
  currentPlanId?: string | null;
  isAdmin: boolean;
  isSubmitting?: boolean;
  onSelect?: (planId: string) => void;
};

export function PlanCard({
  plan,
  currentPlanId,
  isAdmin,
  isSubmitting = false,
  onSelect,
}: PlanCardProps) {
  const isCurrent = currentPlanId === plan.id;

  return (
    <article
      className={cn(
        "flex flex-col rounded-lg border border-border bg-card p-5",
        isCurrent && "ring-2 ring-primary",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">{plan.name}</h3>
          <p className="text-sm text-muted-foreground">{plan.code}</p>
        </div>
        {isCurrent ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
            <Check className="size-3" aria-hidden />
            Current plan
          </span>
        ) : null}
      </div>

      <p className="mt-4 text-2xl font-semibold">
        {formatPrice(plan.priceMinor, plan.currency)}
        <span className="ml-1 text-sm font-normal text-muted-foreground">
          / {BILLING_INTERVAL_LABELS[plan.billingInterval].toLowerCase()}
        </span>
      </p>

      {plan.description ? (
        <p className="mt-3 text-sm text-muted-foreground">{plan.description}</p>
      ) : null}

      {plan.enabledModules.length > 0 ? (
        <ul className="mt-4 flex flex-col gap-1 text-sm">
          {plan.enabledModules.map((module) => (
            <li key={module} className="flex items-center gap-2">
              <Check className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
              {module.toUpperCase()} module
            </li>
          ))}
        </ul>
      ) : null}

      {isAdmin && onSelect && !isCurrent ? (
        <Button
          type="button"
          className="mt-6"
          disabled={isSubmitting}
          onClick={() => onSelect(plan.id)}
        >
          {currentPlanId ? "Change to this plan" : "Subscribe"}
        </Button>
      ) : null}
    </article>
  );
}
