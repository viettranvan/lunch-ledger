import type { MutationCtx } from "../../_generated/server";
import type { Id } from "../../_generated/dataModel";

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
  totalOrders: number,
  paidOrders: number,
): InvoiceStatus {
  if (totalOrders === 0) return "empty";
  if (paidOrders === totalOrders) return "completed";
  if (paidOrders === 0) return "unpaid";
  return "partial";
}

export async function syncInvoiceStatus(
  ctx: MutationCtx,
  invoiceId: Id<"invoices">,
) {
  const invoice = await ctx.db.get(invoiceId);
  if (!invoice) return;

  const orders = await ctx.db
    .query("orderers")
    .withIndex("by_invoice", (q) => q.eq("invoice_id", invoiceId))
    .collect();

  const totalOrders = orders.length;
  const paidOrders = orders.filter((order) => order.is_paid).length;

  await ctx.db.patch(invoiceId, {
    sort_time: getSortTime(invoice.date, invoice._creationTime),
    total_orderers: totalOrders,
    paid_orderers: paidOrders,
    status: computeInvoiceStatus(totalOrders, paidOrders),
  });
}
