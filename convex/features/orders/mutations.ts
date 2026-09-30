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
    const invoice = await ctx.db.get(args.invoice_id);
    if (!invoice) throw new Error("Không tìm thấy hóa đơn.");
    if (invoice.invoice_type === "payable") {
      const existingCounterparty = await ctx.db
        .query("orderers")
        .withIndex("by_invoice", (q) => q.eq("invoice_id", args.invoice_id))
        .first();
      if (existingCounterparty) {
        throw new Error("Hóa đơn phải trả chỉ được có một chủ nợ.");
      }
    }

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

export const settleUserBalance = mutation({
  args: {
    user_id: v.id("users"),
    expected_net_amount: v.number(),
  },
  handler: async (ctx, args) => {
    const unpaidOrders = await ctx.db
      .query("orderers")
      .withIndex("by_user_paid", (q) =>
        q.eq("user_id", args.user_id).eq("is_paid", false),
      )
      .collect();

    const invoiceIds = [...new Set(unpaidOrders.map((order) => order.invoice_id))];
    const invoices = await Promise.all(invoiceIds.map((id) => ctx.db.get(id)));
    const invoicesById = new Map(
      invoices
        .filter((invoice) => invoice !== null)
        .map((invoice) => [invoice._id, invoice]),
    );

    const netAmount = unpaidOrders.reduce((total, order) => {
      const invoice = invoicesById.get(order.invoice_id);
      const invoiceType = invoice?.invoice_type ?? "receivable";
      return total + (invoiceType === "payable" ? -order.actual_price : order.actual_price);
    }, 0);

    if (netAmount === 0 || netAmount !== args.expected_net_amount) {
      throw new Error("Số dư đã thay đổi. Vui lòng kiểm tra lại trước khi đối soát.");
    }

    const now = Date.now();
    for (const order of unpaidOrders) {
      await ctx.db.patch(order._id, { is_paid: true, updated_at: now });
    }

    await Promise.all(invoiceIds.map((invoiceId) => syncInvoiceStatus(ctx, invoiceId)));

    return {
      net_amount: netAmount,
      settled_order_count: unpaidOrders.length,
      affected_invoice_count: invoiceIds.length,
    };
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
