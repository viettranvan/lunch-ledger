import type { MutationCtx } from "../../_generated/server";
import type { Id } from "../../_generated/dataModel";
import { syncInvoiceStatus } from "../invoices/helpers";

export async function recalculateInvoiceOrders(
  ctx: MutationCtx,
  invoiceId: Id<"invoices">,
) {
  const invoice = await ctx.db.get(invoiceId);
  const invoiceTotal = invoice ? invoice.paid_amount : 0;

  const orders = await ctx.db
    .query("orderers")
    .withIndex("by_invoice", (q) => q.eq("invoice_id", invoiceId))
    .collect();

  const totalItemsPrice = orders.reduce((sum, order) => sum + order.item_price, 0);

  for (const order of orders) {
    let percentage = 0;
    let actualPrice = order.item_price;

    if (totalItemsPrice > 0) {
      percentage = order.item_price / totalItemsPrice;
      actualPrice = Math.round(percentage * invoiceTotal);
    }

    await ctx.db.patch(order._id, {
      actual_price: actualPrice,
      percentage: percentage * 100,
      updated_at: Date.now(),
    });
  }

  await syncInvoiceStatus(ctx, invoiceId);
}
