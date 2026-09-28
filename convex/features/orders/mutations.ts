import { v } from "convex/values";
import { mutation } from "../../_generated/server";
import { syncInvoiceStatus } from "../invoices/helpers";
import { recalculateInvoiceOrders } from "./helpers";

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

    await recalculateInvoiceOrders(ctx, args.invoice_id);
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

    await recalculateInvoiceOrders(ctx, order.invoice_id);
  },
});

export const deleteOrder = mutation({
  args: { id: v.id("orderers") },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.id);
    if (!order) return;

    await ctx.db.delete(args.id);
    await recalculateInvoiceOrders(ctx, order.invoice_id);
  },
});
