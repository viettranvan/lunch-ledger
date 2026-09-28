import { v } from "convex/values";
import { internalMutation, mutation } from "../../_generated/server";
import { getSortTime, syncInvoiceStatus } from "./helpers";

export const create = mutation({
  args: {
    store_name: v.string(),
    paid_amount: v.number(),
    date: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("invoices", {
      store_name: args.store_name,
      paid_amount: args.paid_amount,
      updated_at: now,
      date: args.date,
      sort_time: getSortTime(args.date, now),
      total_orderers: 0,
      paid_orderers: 0,
      status: "empty",
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("invoices"),
    store_name: v.optional(v.string()),
    paid_amount: v.optional(v.number()),
    date: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const invoice = await ctx.db.get(id);
    if (!invoice) return;

    const patch: Record<string, unknown> = {
      ...updates,
      updated_at: Date.now(),
    };

    if (updates.date !== undefined) {
      patch.sort_time = getSortTime(updates.date, invoice._creationTime);
    }

    return await ctx.db.patch(id, patch);
  },
});

export const deleteInvoice = mutation({
  args: { id: v.id("invoices") },
  handler: async (ctx, args) => {
    const orders = await ctx.db
      .query("orderers")
      .withIndex("by_invoice", (q) => q.eq("invoice_id", args.id))
      .collect();

    for (const order of orders) {
      await ctx.db.delete(order._id);
    }

    return await ctx.db.delete(args.id);
  },
});

export const backfillStatus = internalMutation({
  args: {},
  handler: async (ctx) => {
    const invoices = await ctx.db.query("invoices").collect();
    for (const invoice of invoices) {
      await syncInvoiceStatus(ctx, invoice._id);
    }
    return { updated: invoices.length };
  },
});
