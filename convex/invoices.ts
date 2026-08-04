import {
  internalMutation,
  mutation,
  query,
} from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import {
  computeInvoiceStatus,
  getSortTime,
  parseDateString,
  syncInvoiceStatus,
  type InvoiceStatus,
} from "./lib/invoiceStatus";

type InvoiceWithStatus = Doc<"invoices"> & {
  total_orderers: number;
  paid_orderers: number;
  status: InvoiceStatus;
};

function withStatusFields(
  invoice: Doc<"invoices">,
  totalOrderers: number,
  paidOrderers: number,
): InvoiceWithStatus {
  return {
    ...invoice,
    total_orderers: invoice.total_orderers ?? totalOrderers,
    paid_orderers: invoice.paid_orderers ?? paidOrderers,
    status:
      invoice.status ?? computeInvoiceStatus(totalOrderers, paidOrderers),
  };
}

export const create = mutation({
  args: {
    store_name: v.string(),
    paid_amount: v.number(),
    date: v.string(),
  },
  handler: async (ctx, args) => {
    const sortTime = getSortTime(args.date, Date.now());
    return await ctx.db.insert("invoices", {
      store_name: args.store_name,
      paid_amount: args.paid_amount,
      updated_at: Date.now(),
      date: args.date,
      sort_time: sortTime,
      total_orderers: 0,
      paid_orderers: 0,
      status: "empty",
    });
  },
});

export const getWithStatus = query({
  args: {},
  handler: async (ctx) => {
    const invoices = await ctx.db.query("invoices").collect();
    const allOrderers = await ctx.db.query("orderers").collect();

    const orderersByInvoice = new Map<string, typeof allOrderers>();
    for (const orderer of allOrderers) {
      const key = orderer.invoice_id;
      const existing = orderersByInvoice.get(key) ?? [];
      existing.push(orderer);
      orderersByInvoice.set(key, existing);
    }

    const withStatus = invoices.map((invoice) => {
      const orderers = orderersByInvoice.get(invoice._id) ?? [];
      const totalOrderers = orderers.length;
      const paidOrderers = orderers.filter((o) => o.is_paid).length;
      return withStatusFields(invoice, totalOrderers, paidOrderers);
    });

    return withStatus.sort((a, b) => {
      const timeA =
        a.sort_time ?? (parseDateString(a.date) || a._creationTime);
      const timeB =
        b.sort_time ?? (parseDateString(b.date) || b._creationTime);
      return timeB - timeA;
    });
  },
});

export const listPaginated = query({
  args: {
    paginationOpts: paginationOptsValidator,
    includeCompleted: v.boolean(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("invoices")
      .withIndex("by_sort_time")
      .order("desc")
      .filter((q) =>
        args.includeCompleted
          ? true
          : q.neq(q.field("status"), "completed"),
      )
      .paginate(args.paginationOpts);
  },
});

export const getById = query({
  args: { id: v.id("invoices") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
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
    const orderers = await ctx.db
      .query("orderers")
      .withIndex("by_invoice", (q) => q.eq("invoice_id", args.id))
      .collect();

    for (const order of orderers) {
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
