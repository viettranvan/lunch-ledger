import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";
import {
  getSortTime,
  syncInvoiceStatus,
} from "./lib/invoiceStatus";

async function recalcAllOrdersForInvoice(
  ctx: MutationCtx,
  invoiceId: Id<"invoices">,
) {
  const invoice = await ctx.db.get(invoiceId);
  const invoiceTotal = invoice ? invoice.paid_amount : 0;

  const allOrders = await ctx.db
    .query("orderers")
    .withIndex("by_invoice", (q) => q.eq("invoice_id", invoiceId))
    .collect();

  const totalItemsPrice = allOrders.reduce((sum, o) => sum + o.item_price, 0);

  for (const order of allOrders) {
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

export const getByInvoice = query({
  args: { invoice_id: v.id("invoices") },
  handler: async (ctx, args) => {
    const orders = await ctx.db
      .query("orderers")
      .withIndex("by_invoice", (q) => q.eq("invoice_id", args.invoice_id))
      .order("desc")
      .collect();

    return await Promise.all(
      orders.map(async (order) => {
        const user = await ctx.db.get(order.user_id);
        return {
          ...order,
          user_name: user ? user.name : "Unknown User",
        };
      }),
    );
  },
});

export const create = mutation({
  args: {
    user_id: v.id("users"),
    invoice_id: v.id("invoices"),
    item_price: v.number(),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("orderers", {
      user_id: args.user_id,
      invoice_id: args.invoice_id,
      actual_price: args.item_price,
      item_price: args.item_price,
      is_paid: false,
      percentage: 0,
      updated_at: Date.now(),
    });

    await recalcAllOrdersForInvoice(ctx, args.invoice_id);

    return id;
  },
});

export const togglePaid = mutation({
  args: { id: v.id("orderers"), is_paid: v.boolean() },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.id);
    if (!order) return;

    await ctx.db.patch(args.id, {
      is_paid: args.is_paid,
      updated_at: Date.now(),
    });

    await syncInvoiceStatus(ctx, order.invoice_id);
  },
});

export const update = mutation({
  args: {
    id: v.id("orderers"),
    item_price: v.number(),
  },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.id);
    if (!order) return;

    await ctx.db.patch(args.id, {
      item_price: args.item_price,
      updated_at: Date.now(),
    });

    await recalcAllOrdersForInvoice(ctx, order.invoice_id);
  },
});

export const deleteOrder = mutation({
  args: { id: v.id("orderers") },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.id);
    if (!order) return;

    await ctx.db.delete(args.id);

    await recalcAllOrdersForInvoice(ctx, order.invoice_id);
  },
});

export const createDebtAdjustment = mutation({
  args: {
    user_id: v.id("users"),
    amount: v.number(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const today = new Date();
    const dateStr = `${today.getDate().toString().padStart(2, "0")}/${(today.getMonth() + 1).toString().padStart(2, "0")}/${today.getFullYear()}`;

    const invoiceId = await ctx.db.insert("invoices", {
      store_name: `Điều chỉnh nợ - ${args.reason}`,
      paid_amount: 0,
      date: dateStr,
      updated_at: Date.now(),
      sort_time: getSortTime(dateStr, Date.now()),
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
      updated_at: Date.now(),
    });

    await recalcAllOrdersForInvoice(ctx, invoiceId);

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
