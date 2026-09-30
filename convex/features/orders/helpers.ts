import type { MutationCtx } from "../../_generated/server";
import type { Id } from "../../_generated/dataModel";
import { syncInvoiceStatus } from "../invoices/helpers";
import { allocateProportionally } from "./allocation";

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

  const weights = orders.map((order) => order.item_price);
  const totalItemsPrice = weights.reduce((sum, itemPrice) => sum + itemPrice, 0);
  const isPayable = invoice?.invoice_type === "payable";
  if (isPayable && orders.length > 1) {
    throw new Error("Hóa đơn phải trả chỉ được có một chủ nợ.");
  }
  if (isPayable && orders.length === 1) {
    const order = orders[0];
    await ctx.db.patch(invoiceId, {
      paid_amount: order.item_price,
      total_orderers: 1,
      updated_at: Date.now(),
    });
    await ctx.db.patch(order._id, {
      actual_price: order.item_price,
      percentage: 100,
      updated_at: Date.now(),
    });
    await syncInvoiceStatus(ctx, invoiceId);
    return;
  }

  if (isPayable) {
    await ctx.db.patch(invoiceId, {
      paid_amount: 0,
      total_orderers: 0,
      updated_at: Date.now(),
    });
  }

  const canAllocateExactly =
    Number.isSafeInteger(invoiceTotal) &&
    invoiceTotal >= 0 &&
    orders.length > 0 &&
    Number.isFinite(totalItemsPrice) &&
    weights.every((weight) => Number.isFinite(weight) && weight > 0);
  const allocations = canAllocateExactly
    ? allocateProportionally(invoiceTotal, weights)
    : undefined;

  for (const [index, order] of orders.entries()) {
    let percentage = 0;
    let actualPrice = order.item_price;

    if (totalItemsPrice > 0) {
      percentage = order.item_price / totalItemsPrice;
      actualPrice = Math.round(percentage * invoiceTotal);
    }

    if (allocations) {
      percentage = allocations[index].percentage / 100;
      actualPrice = allocations[index].amount;
    }

    await ctx.db.patch(order._id, {
      actual_price: actualPrice,
      percentage: percentage * 100,
      updated_at: Date.now(),
    });
  }

  await syncInvoiceStatus(ctx, invoiceId);
}
