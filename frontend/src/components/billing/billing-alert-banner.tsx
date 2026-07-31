import { AlertTriangle, Info } from "lucide-react";
import { SUBSCRIPTION_STATUS_LABELS } from "@/lib/billing/labels";
import type { TenantSubscription } from "@/lib/billing/types";

type BillingAlertBannerProps = {
  subscription: TenantSubscription | null;
};

export function BillingAlertBanner({ subscription }: BillingAlertBannerProps) {
  if (!subscription) {
    return (
      <div
        role="status"
        className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm"
      >
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
        <div>
          <p className="font-medium">No active subscription</p>
          <p className="mt-1 text-muted-foreground">
            Choose a plan below to activate billing for this tenant.
          </p>
        </div>
      </div>
    );
  }

  if (subscription.status === "past_due") {
    return (
      <div
        role="alert"
        className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
      >
        <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
        <div>
          <p className="font-medium">
            Payment overdue — {SUBSCRIPTION_STATUS_LABELS.past_due}
          </p>
          <p className="mt-1">
            Review open invoices and update billing details to avoid service interruption.
          </p>
        </div>
      </div>
    );
  }

  if (subscription.status === "suspended") {
    return (
      <div
        role="alert"
        className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
      >
        <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
        <div>
          <p className="font-medium">
            Subscription suspended — {SUBSCRIPTION_STATUS_LABELS.suspended}
          </p>
          <p className="mt-1">Contact your organisation administrator to restore access.</p>
        </div>
      </div>
    );
  }

  if (subscription.status === "trial") {
    return (
      <div
        role="status"
        className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm"
      >
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
        <div>
          <p className="font-medium">Trial period — {SUBSCRIPTION_STATUS_LABELS.trial}</p>
          <p className="mt-1 text-muted-foreground">
            Your organisation is on a trial plan. Upgrade before the period ends to continue
            service.
          </p>
        </div>
      </div>
    );
  }

  return null;
}
