import { v } from "convex/values";
import type { Id } from "../../_generated/dataModel";
import { mutation } from "../../_generated/server";
import { getSortTime, syncInvoiceStatus } from "../invoices/helpers";

export const createDebtAdjustment = mutation({
  args: {
    user_id: v.id("users"),
    amount: v.number(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const today = new Date();
    const dateStr = `${today.getDate().toString().padStart(2, "0")}/${(today.getMonth() + 1).toString().padStart(2, "0")}/${today.getFullYear()}`;
    const now = Date.now();

    const invoiceId = await ctx.db.insert("invoices", {
      store_name: `Điều chỉnh nợ - ${args.reason}`,
      paid_amount: 0,
      date: dateStr,
      updated_at: now,
      sort_time: getSortTime(dateStr, now),
      total_orderers: 0,
      paid_orderers: 0,
      status: "empty",
    });

    await ctx.db.insert("orderers", {
      user_id: args.user_id,
      invoice_id: invoiceId,
      item_price: -args.amount,
      actual_price: -args.amount,
      is_paid: false,
      percentage: 0,
      updated_at: now,
    });

    await syncInvoiceStatus(ctx, invoiceId);
    return invoiceId;
  },
});

export const markAllPaidForUser = mutation({
  args: { user_id: v.id("users") },
  handler: async (ctx, args) => {
    const unpaidOrders = await ctx.db
      .query("orderers")
      .withIndex("by_user_paid", (q) =>
        q.eq("user_id", args.user_id).eq("is_paid", false),
      )
      .collect();

    const affectedInvoiceIds = new Set<Id<"invoices">>();

    await Promise.all(
      unpaidOrders.map(async (order) => {
        affectedInvoiceIds.add(order.invoice_id);
        await ctx.db.patch(order._id, {
          is_paid: true,
          updated_at: Date.now(),
        });
      }),
    );

    for (const invoiceId of affectedInvoiceIds) {
      await syncInvoiceStatus(ctx, invoiceId);
    }
  },
});
