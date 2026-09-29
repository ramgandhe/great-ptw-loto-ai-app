"use client";

import { PageHeader } from "@/components/layout/page-header";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BillingAlertBanner } from "@/components/billing/billing-alert-banner";
import { InvoiceTable } from "@/components/billing/invoice-table";
import { PlanCard } from "@/components/billing/plan-card";
import { PlanChangeDialog } from "@/components/billing/plan-change-dialog";
import { UsageMeter } from "@/components/billing/usage-meter";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api";
import { getProfile } from "@/lib/auth/api";
import {
  changeSubscriptionPlan,
  createSubscription,
  getCurrentSubscription,
  listInvoices,
  listPlanChanges,
  listSubscriptionPlans,
  listUsageRecords,
  recordUsage,
} from "@/lib/billing/api";
import {
  currentPeriodLabel,
  formatDateLabel,
  isBillingAdmin,
  SUBSCRIPTION_STATUS_LABELS,
} from "@/lib/billing/labels";
import type {
  BillingInvoice,
  InvoiceStatusFilter,
  PlanChangeRecord,
  SubscriptionPlan,
  TenantSubscription,
  UsageRecord,
} from "@/lib/billing/types";

export default function BillingPage() {
  const [subscription, setSubscription] = useState<TenantSubscription | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [usage, setUsage] = useState<UsageRecord[]>([]);
  const [invoices, setInvoices] = useState<BillingInvoice[]>([]);
  const [planChanges, setPlanChanges] = useState<PlanChangeRecord[]>([]);
  const [invoiceFilter, setInvoiceFilter] = useState<InvoiceStatusFilter>("all");
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dialogPlan, setDialogPlan] = useState<SubscriptionPlan | null>(null);
  const [dialogReason, setDialogReason] = useState("");
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [usageMetricKey, setUsageMetricKey] = useState("active_permits");
  const [usageQuantity, setUsageQuantity] = useState("");
  const [usagePeriod, setUsagePeriod] = useState(currentPeriodLabel());

  const loadBilling = useCallback(() => {
    setIsLoading(true);
    setError(null);

    Promise.all([
      getProfile(),
      getCurrentSubscription(),
      listSubscriptionPlans(),
      listUsageRecords(),
      listInvoices(invoiceFilter),
      listPlanChanges(),
    ])
      .then(([profile, current, planList, usageList, invoiceList, history]) => {
        setIsAdmin(isBillingAdmin(profile.roles));
        setSubscription(current);
        setPlans(planList);
        setUsage(usageList);
        setInvoices(invoiceList);
        setPlanChanges(history);
      })
      .catch((err) => {
        setSubscription(null);
        setPlans([]);
        setUsage([]);
        setInvoices([]);
        setPlanChanges([]);
        setError(err instanceof ApiError ? err.message : "Failed to load billing data");
      })
      .finally(() => setIsLoading(false));
  }, [invoiceFilter]);

  useEffect(() => {
    loadBilling();
  }, [loadBilling]);

  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.id === dialogPlan?.id) ?? dialogPlan,
    [dialogPlan, plans],
  );

  const isSubscribeFlow = subscription === null;

  const currentPlan = useMemo(
    () => plans.find((plan) => plan.id === subscription?.planId) ?? subscription?.plan ?? null,
    [plans, subscription],
  );

  const alternatePlans = useMemo(
    () => plans.filter((plan) => plan.id !== subscription?.planId),
    [plans, subscription?.planId],
  );

  async function handlePlanConfirm() {
    if (!selectedPlan) {
      return;
    }

    setIsSubmitting(true);
    setDialogError(null);

    try {
      if (isSubscribeFlow) {
        await createSubscription({ planId: selectedPlan.id, status: "trial" });
      } else {
        await changeSubscriptionPlan({
          planId: selectedPlan.id,
          reason: dialogReason.trim() || undefined,
        });
      }

      setDialogPlan(null);
      setDialogReason("");
      toast(isSubscribeFlow ? `Subscribed to ${selectedPlan.name}` : `Plan changed to ${selectedPlan.name}`);
      loadBilling();
    } catch (err) {
      setDialogError(err instanceof ApiError ? err.message : "Failed to update subscription");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRecordUsage(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await recordUsage({
        metricKey: usageMetricKey.trim(),
        quantity: Number(usageQuantity),
        periodLabel: usagePeriod.trim(),
      });
      toast("Usage recorded");
      setUsageQuantity("");
      loadBilling();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to record usage");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex flex-1 flex-col gap-8 px-4 pb-8 sm:px-8">
      <PageHeader title="Billing and subscription" description="Your plan, usage against its limits, and invoices." />

      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </div>
      ) : null}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading billing data…</p>
      ) : (
        <>
          <BillingAlertBanner subscription={subscription} />

          {subscription && currentPlan ? (
            <section>
              <h2 className="mb-3 text-sm font-semibold">Your subscription</h2>
              <div className="max-w-xl">
                <PlanCard
                  plan={currentPlan}
                  currentPlanId={subscription.planId}
                  isAdmin={isAdmin}
                  isSubmitting={isSubmitting}
                  subscriptionStatusLabel={SUBSCRIPTION_STATUS_LABELS[subscription.status]}
                  renewAtLabel={formatDateLabel(subscription.renewAt)}
                />
              </div>
            </section>
          ) : null}

          {isSubscribeFlow ? (
            <section>
              {plans.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border px-5 py-8 text-center">
                  <p className="font-medium">No subscription yet</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    No plans have been published for sign-up. Contact the platform administrator to set up your subscription.
                  </p>
                </div>
              ) : (
                <>
              <h2 className="mb-3 text-sm font-semibold">Choose a plan</h2>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {plans.map((plan) => (
                    <PlanCard
                      key={plan.id}
                      plan={plan}
                      isAdmin={isAdmin}
                      isSubmitting={isSubmitting}
                      onSelect={isAdmin ? (planId) => setDialogPlan(plans.find((p) => p.id === planId) ?? null) : undefined}
                    />
                  ))}
                </div>
                </>
              )}
              {!isAdmin && plans.length > 0 ? (
                <p className="mt-3 text-xs text-muted-foreground">
                  Plan changes require organisation administrator access.
                </p>
              ) : null}
            </section>
          ) : isAdmin && alternatePlans.length > 0 ? (
            <section>
              <h2 className="mb-3 text-sm font-semibold">Change plan</h2>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {alternatePlans.map((plan) => (
                  <PlanCard
                    key={plan.id}
                    plan={plan}
                    currentPlanId={subscription?.planId}
                    isAdmin={isAdmin}
                    isSubmitting={isSubmitting}
                    onSelect={(planId) => setDialogPlan(plans.find((p) => p.id === planId) ?? null)}
                  />
                ))}
              </div>
            </section>
          ) : !isAdmin ? (
            <p className="text-xs text-muted-foreground">
              Plan changes require organisation administrator access.
            </p>
          ) : null}

          {subscription ? (
          <section className="rounded-lg border border-border p-5">
            <h2 className="text-sm font-semibold">Usage</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Monitor consumption against plan limits for the current billing period.
            </p>
            <div className="mt-4">
              <UsageMeter records={usage} limits={subscription?.plan.usageLimits} />
            </div>

            {isAdmin ? (
              <details className="mt-6 border-t border-border pt-6">
                <summary className="cursor-pointer text-sm font-medium">Record usage (admin)</summary>
                <form onSubmit={handleRecordUsage} className="mt-4 grid max-w-xl gap-3">
                <label className="flex flex-col gap-1 text-sm">
                  Metric key
                  <input
                    className="rounded-md border border-border bg-background px-3 py-2"
                    value={usageMetricKey}
                    onChange={(event) => setUsageMetricKey(event.target.value)}
                    required
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  Quantity
                  <input
                    type="number"
                    min={0}
                    step={1}
                    inputMode="numeric"
                    placeholder="e.g. 12"
                    className="rounded-md border border-border bg-background px-3 py-2"
                    value={usageQuantity}
                    onChange={(event) => setUsageQuantity(event.target.value)}
                    required
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  Period (YYYY-MM)
                  <input
                    pattern="[0-9]{4}-(0[1-9]|1[0-2])"
                    title="Year and month, e.g. 2026-09"
                    className="rounded-md border border-border bg-background px-3 py-2"
                    value={usagePeriod}
                    onChange={(event) => setUsagePeriod(event.target.value)}
                    required
                  />
                </label>
                <Button type="submit" disabled={isSubmitting} className="w-fit">
                  Save usage
                </Button>
                </form>
              </details>
            ) : null}
          </section>
          ) : null}

          <section>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-semibold">Invoices</h2>
              <label className="flex items-center gap-2 text-sm">
                Status
                <select
                  className="rounded-md border border-border bg-background px-3 py-1.5"
                  value={invoiceFilter}
                  onChange={(event) =>
                    setInvoiceFilter(event.target.value as InvoiceStatusFilter)
                  }
                >
                  <option value="all">All</option>
                  <option value="draft">Draft</option>
                  <option value="issued">Issued</option>
                  <option value="paid">Paid</option>
                  <option value="void">Void</option>
                </select>
              </label>
            </div>
            <InvoiceTable invoices={invoices} />
          </section>

          {planChanges.length > 0 ? (
            <section className="rounded-lg border border-border p-5">
              <h2 className="text-sm font-semibold">Plan change history</h2>
              <ul className="mt-4 flex flex-col gap-2 text-sm">
                {planChanges.map((entry) => (
                  <li key={entry.id} className="flex flex-wrap justify-between gap-2 border-b border-border py-2 last:border-b-0">
                    <span>
                      Plan updated on {formatDateLabel(entry.changedAt)}
                      {entry.reason ? ` — ${entry.reason}` : ""}
                    </span>
                    <span className="text-muted-foreground">By {entry.changedBy.slice(0, 8)}…</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}

      <PlanChangeDialog
        open={dialogPlan !== null}
        plan={selectedPlan}
        isSubscribe={isSubscribeFlow}
        reason={dialogReason}
        isSubmitting={isSubmitting}
        error={dialogError}
        onReasonChange={setDialogReason}
        onConfirm={handlePlanConfirm}
        onClose={() => {
          if (!isSubmitting) {
            setDialogPlan(null);
            setDialogReason("");
            setDialogError(null);
          }
        }}
      />
    </main>
  );
}
