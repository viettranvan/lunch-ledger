import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

export type InvoiceStatus = "completed" | "empty" | "unpaid" | "partial";

export function parseDateString(dateStr: string | undefined): number {
  if (!dateStr) return 0;

  if (dateStr.includes("/")) {
    const parts = dateStr.split("/");
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);
      return new Date(year, month, day).getTime();
    }
  }

  return new Date(dateStr).getTime();
}

export function getSortTime(
  date: string | undefined,
  creationTime: number,
): number {
  return parseDateString(date) || creationTime;
}

export function computeInvoiceStatus(
  totalOrderers: number,
  paidOrderers: number,
): InvoiceStatus {
  if (totalOrderers === 0) return "empty";
  if (paidOrderers === totalOrderers) return "completed";
  if (paidOrderers === 0) return "unpaid";
  return "partial";
}

export async function syncInvoiceStatus(
  ctx: MutationCtx,
  invoiceId: Id<"invoices">,
) {
  const invoice = await ctx.db.get(invoiceId);
  if (!invoice) return;

  const orderers = await ctx.db
    .query("orderers")
    .withIndex("by_invoice", (q) => q.eq("invoice_id", invoiceId))
    .collect();

  const totalOrderers = orderers.length;
  const paidOrderers = orderers.filter((o) => o.is_paid).length;

  await ctx.db.patch(invoiceId, {
    sort_time: getSortTime(invoice.date, invoice._creationTime),
    total_orderers: totalOrderers,
    paid_orderers: paidOrderers,
    status: computeInvoiceStatus(totalOrderers, paidOrderers),
  });
}
