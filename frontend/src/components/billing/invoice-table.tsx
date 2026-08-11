import {
  formatDateLabel,
  formatPrice,
  INVOICE_STATUS_LABELS,
} from "@/lib/billing/labels";
import type { BillingInvoice } from "@/lib/billing/types";
import { Button } from "@/components/ui/button";

type InvoiceTableProps = {
  invoices: BillingInvoice[];
  canManage?: boolean;
  busyId?: string | null;
  onIssue?: (invoiceId: string) => void;
  onPay?: (invoiceId: string) => void;
  onVoid?: (invoiceId: string) => void;
};

export function InvoiceTable({
  invoices,
  canManage = false,
  busyId = null,
  onIssue,
  onPay,
  onVoid,
}: InvoiceTableProps) {
  if (invoices.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No invoices have been issued yet.</p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="border-b border-border bg-muted/40">
          <tr>
            <th className="px-4 py-3 font-medium">Invoice</th>
            <th className="px-4 py-3 font-medium">Period</th>
            <th className="px-4 py-3 font-medium">Amount</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Due</th>
            {canManage ? <th className="px-4 py-3 font-medium">Actions</th> : null}
          </tr>
        </thead>
        <tbody>
          {invoices.map((invoice) => (
            <tr key={invoice.id} className="border-b border-border last:border-b-0">
              <td className="px-4 py-3 font-medium">{invoice.invoiceNumber}</td>
              <td className="px-4 py-3 text-muted-foreground">
                {formatDateLabel(invoice.periodStart)} – {formatDateLabel(invoice.periodEnd)}
              </td>
              <td className="px-4 py-3 tabular-nums">
                {formatPrice(invoice.amountMinor, invoice.currency)}
              </td>
              <td className="px-4 py-3">
                <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                  {INVOICE_STATUS_LABELS[invoice.status]}
                </span>
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {formatDateLabel(invoice.dueAt)}
              </td>
              {canManage ? (
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    {invoice.status === "draft" ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busyId === invoice.id}
                        onClick={() => onIssue?.(invoice.id)}
                      >
                        Issue
                      </Button>
                    ) : null}
                    {invoice.status === "issued" ? (
                      <Button
                        type="button"
                        size="sm"
                        disabled={busyId === invoice.id}
                        onClick={() => onPay?.(invoice.id)}
                      >
                        Mark paid
                      </Button>
                    ) : null}
                    {invoice.status === "draft" || invoice.status === "issued" ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busyId === invoice.id}
                        onClick={() => onVoid?.(invoice.id)}
                      >
                        Void
                      </Button>
                    ) : null}
                  </div>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
