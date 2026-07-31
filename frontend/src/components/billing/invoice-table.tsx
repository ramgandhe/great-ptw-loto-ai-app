import {
  formatDateLabel,
  formatPrice,
  INVOICE_STATUS_LABELS,
} from "@/lib/billing/labels";
import type { BillingInvoice } from "@/lib/billing/types";

type InvoiceTableProps = {
  invoices: BillingInvoice[];
};

export function InvoiceTable({ invoices }: InvoiceTableProps) {
  if (invoices.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No invoices have been issued yet.</p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="border-b border-border bg-muted/40">
          <tr>
            <th className="px-4 py-3 font-medium">Invoice</th>
            <th className="px-4 py-3 font-medium">Period</th>
            <th className="px-4 py-3 font-medium">Amount</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Due</th>
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
