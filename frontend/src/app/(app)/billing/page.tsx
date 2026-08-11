"use client";

import { CreditCard } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BillingAlertBanner } from "@/components/billing/billing-alert-banner";
import { InvoiceTable } from "@/components/billing/invoice-table";
import { PlanCard } from "@/components/billing/plan-card";
import { PlanChangeDialog } from "@/components/billing/plan-change-dialog";
import { UsageMeter } from "@/components/billing/usage-meter";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api";
import { getProfile } from "@/lib/auth/api";
import {
  changeSubscriptionPlan,
  createSubscription,
  getCurrentSubscription,
  issueInvoice,
  listInvoices,
  listPlanChanges,
  listSubscriptionPlans,
  listUsageRecords,
  payInvoice,
  recordUsage,
  voidInvoice,
} from "@/lib/billing/api";
import {
  currentPeriodLabel,
  formatDateLabel,
  formatPrice,
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
  const [usageQuantity, setUsageQuantity] = useState("0");
  const [usagePeriod, setUsagePeriod] = useState(currentPeriodLabel());
  const [usageSuccess, setUsageSuccess] = useState<string | null>(null);
  const [invoiceBusyId, setInvoiceBusyId] = useState<string | null>(null);

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
      loadBilling();
    } catch (err) {
      setDialogError(err instanceof ApiError ? err.message : "Failed to update subscription");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRecordUsage(event: React.FormEvent) {
    event.preventDefault();
    setUsageSuccess(null);
    setError(null);
    setIsSubmitting(true);

    try {
      await recordUsage({
        metricKey: usageMetricKey.trim(),
        quantity: Number(usageQuantity),
        periodLabel: usagePeriod.trim(),
      });
      setUsageSuccess("Usage recorded.");
      loadBilling();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to record usage");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex flex-1 flex-col gap-8 p-8">
      <div className="flex items-center gap-3">
        <CreditCard className="size-6" aria-hidden />
        <div>
          <h1 className="text-2xl font-semibold">Billing & subscription</h1>
          <p className="text-sm text-muted-foreground">
            Manage tenant plans, usage and invoice history.
          </p>
        </div>
      </div>

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

          {subscription ? (
            <section className="rounded-lg border border-border bg-card p-5">
              <h2 className="text-sm font-semibold">Current subscription</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="text-xs text-muted-foreground">Plan</p>
                  <p className="font-medium">{subscription.plan.name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <p className="font-medium">{SUBSCRIPTION_STATUS_LABELS[subscription.status]}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Price</p>
                  <p className="font-medium">
                    {formatPrice(subscription.plan.priceMinor, subscription.plan.currency)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Renews</p>
                  <p className="font-medium">{formatDateLabel(subscription.renewAt)}</p>
                </div>
              </div>
            </section>
          ) : null}

          <section>
            <h2 className="mb-3 text-sm font-semibold">Subscription plans</h2>
            {plans.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active plans are available.</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {plans.map((plan) => (
                  <PlanCard
                    key={plan.id}
                    plan={plan}
                    currentPlanId={subscription?.planId}
                    isAdmin={isAdmin}
                    isSubmitting={isSubmitting}
                    onSelect={isAdmin ? (planId) => setDialogPlan(plans.find((p) => p.id === planId) ?? null) : undefined}
                  />
                ))}
              </div>
            )}
            {!isAdmin ? (
              <p className="mt-3 text-xs text-muted-foreground">
                Plan changes require organisation administrator access.
              </p>
            ) : null}
          </section>

          <section className="rounded-lg border border-border p-5">
            <h2 className="text-sm font-semibold">Usage</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Monitor consumption against plan limits for the current billing period.
            </p>
            <div className="mt-4">
              <UsageMeter records={usage} limits={subscription?.plan.usageLimits} />
            </div>

            {isAdmin ? (
              <form
                onSubmit={handleRecordUsage}
                className="mt-6 grid max-w-xl gap-3 border-t border-border pt-6"
              >
                <h3 className="text-sm font-medium">Record usage (admin)</h3>
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
                    className="rounded-md border border-border bg-background px-3 py-2"
                    value={usageQuantity}
                    onChange={(event) => setUsageQuantity(event.target.value)}
                    required
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  Period (YYYY-MM)
                  <input
                    className="rounded-md border border-border bg-background px-3 py-2"
                    value={usagePeriod}
                    onChange={(event) => setUsagePeriod(event.target.value)}
                    required
                  />
                </label>
                {usageSuccess ? (
                  <p role="status" className="text-sm text-muted-foreground">
                    {usageSuccess}
                  </p>
                ) : null}
                <Button type="submit" disabled={isSubmitting} className="w-fit">
                  Save usage
                </Button>
              </form>
            ) : null}
          </section>

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
            <InvoiceTable
              invoices={invoices}
              canManage={isAdmin}
              busyId={invoiceBusyId}
              onIssue={async (invoiceId) => {
                setInvoiceBusyId(invoiceId);
                setError(null);
                try {
                  await issueInvoice(invoiceId);
                  loadBilling();
                } catch (err) {
                  setError(err instanceof ApiError ? err.message : "Failed to issue invoice");
                } finally {
                  setInvoiceBusyId(null);
                }
              }}
              onPay={async (invoiceId) => {
                setInvoiceBusyId(invoiceId);
                setError(null);
                try {
                  await payInvoice(invoiceId);
                  loadBilling();
                } catch (err) {
                  setError(err instanceof ApiError ? err.message : "Failed to mark invoice paid");
                } finally {
                  setInvoiceBusyId(null);
                }
              }}
              onVoid={async (invoiceId) => {
                setInvoiceBusyId(invoiceId);
                setError(null);
                try {
                  await voidInvoice(invoiceId);
                  loadBilling();
                } catch (err) {
                  setError(err instanceof ApiError ? err.message : "Failed to void invoice");
                } finally {
                  setInvoiceBusyId(null);
                }
              }}
            />
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
