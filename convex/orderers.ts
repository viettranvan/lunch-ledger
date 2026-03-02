import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";

// Helper: recalculate actual_price & percentage for ALL orders in an invoice
async function recalcAllOrdersForInvoice(
  ctx: MutationCtx,
  invoiceId: Id<"invoices">,
) {
  const invoice = await ctx.db.get(invoiceId);
  const invoiceTotal = invoice ? invoice.paid_amount : 0;

  const allOrders = await ctx.db
    .query("orderers")
    .filter((q) => q.eq(q.field("invoice_id"), invoiceId))
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
}

export const getByInvoice = query({
  args: { invoice_id: v.id("invoices") },
  handler: async (ctx, args) => {
    const orders = await ctx.db
      .query("orderers")
      .filter((q) => q.eq(q.field("invoice_id"), args.invoice_id))
      .order("desc")
      .collect();

    // Just join with user names — actual_price & percentage are already stored
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

    // Recalculate all orders in this invoice (including the new one)
    await recalcAllOrdersForInvoice(ctx, args.invoice_id);

    return id;
  },
});

export const togglePaid = mutation({
  args: { id: v.id("orderers"), is_paid: v.boolean() },
  handler: async (ctx, args) => {
    return await ctx.db.patch(args.id, {
      is_paid: args.is_paid,
      updated_at: Date.now(),
    });
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

    // Recalculate all orders in this invoice
    await recalcAllOrdersForInvoice(ctx, order.invoice_id);
  },
});

export const deleteOrder = mutation({
  args: { id: v.id("orderers") },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.id);
    if (!order) return;

    await ctx.db.delete(args.id);

    // Recalculate remaining orders in this invoice
    await recalcAllOrdersForInvoice(ctx, order.invoice_id);
  },
});

export const markAllPaidForUser = mutation({
  args: { user_id: v.id("users") },
  handler: async (ctx, args) => {
    const unpaidOrders = await ctx.db
      .query("orderers")
      .filter((q) => q.eq(q.field("user_id"), args.user_id))
      .filter((q) => q.eq(q.field("is_paid"), false))
      .collect();

    await Promise.all(
      unpaidOrders.map((order) =>
        ctx.db.patch(order._id, {
          is_paid: true,
          updated_at: Date.now(),
        }),
      ),
    );
  },
});
