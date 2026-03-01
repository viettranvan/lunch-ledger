import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const getByInvoice = query({
  args: { invoice_id: v.id("invoices") },
  handler: async (ctx, args) => {
    const invoice = await ctx.db.get(args.invoice_id);
    const invoiceTotal = invoice ? invoice.paid_amount : 0;

    const orders = await ctx.db
      .query("orderers")
      .filter((q) => q.eq(q.field("invoice_id"), args.invoice_id))
      .order("desc")
      .collect();

    const totalItemsPrice = orders.reduce((sum, o) => sum + o.item_price, 0);

    // Join with users data
    return await Promise.all(
      orders.map(async (order) => {
        const user = await ctx.db.get(order.user_id);

        let computedActualPrice = order.item_price;
        let percentage = 0;

        if (totalItemsPrice > 0) {
          percentage = order.item_price / totalItemsPrice;
          computedActualPrice = Math.round(percentage * invoiceTotal);
        }

        return {
          ...order,
          user_name: user ? user.name : "Unknown User",
          actual_price: computedActualPrice,
          percentage: percentage * 100,
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
    // For now, assume actual_price equals item_price.
    // The actual price and percentage will be calculated properly later when invoice changes.
    return await ctx.db.insert("orderers", {
      user_id: args.user_id,
      invoice_id: args.invoice_id,
      actual_price: args.item_price,
      item_price: args.item_price,
      is_paid: false,
      percentage: 100,
      updated_at: Date.now(),
    });
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
    return await ctx.db.patch(args.id, {
      actual_price: args.item_price,
      item_price: args.item_price,
      updated_at: Date.now(),
    });
  },
});

export const deleteOrder = mutation({
  args: { id: v.id("orderers") },
  handler: async (ctx, args) => {
    return await ctx.db.delete(args.id);
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
