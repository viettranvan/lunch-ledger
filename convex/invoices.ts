import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Helper to parse dates like "DD/MM/YYYY", "D/M/YYYY" or "YYYY-MM-DD"
function parseDateString(dateStr: string | undefined): number {
  if (!dateStr) return 0;

  // Handle DD/MM/YYYY or D/M/YYYY
  if (dateStr.includes("/")) {
    const parts = dateStr.split("/");
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1; // Months are 0-indexed in JS
      const year = parseInt(parts[2], 10);
      return new Date(year, month, day).getTime();
    }
  }

  // Fallback for standard YYYY-MM-DD format
  return new Date(dateStr).getTime();
}

export const getAll = query({
  args: {},
  handler: async (ctx) => {
    const invoices = await ctx.db.query("invoices").collect();

    // Sort by descending date (newest first)
    return invoices.sort((a, b) => {
      const timeA = parseDateString(a.date) || a._creationTime;
      const timeB = parseDateString(b.date) || b._creationTime;
      return timeB - timeA;
    });
  },
});

export const create = mutation({
  args: {
    store_name: v.string(),
    paid_amount: v.number(),
    date: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("invoices", {
      store_name: args.store_name,
      paid_amount: args.paid_amount,
      updated_at: Date.now(),
      date: args.date,
    });
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
    return await ctx.db.patch(id, {
      ...updates,
      updated_at: Date.now(),
    });
  },
});

export const deleteInvoice = mutation({
  args: { id: v.id("invoices") },
  handler: async (ctx, args) => {
    // Delete all orderers associated with this invoice first
    const orderers = await ctx.db
      .query("orderers")
      .filter((q) => q.eq(q.field("invoice_id"), args.id))
      .collect();

    for (const order of orderers) {
      await ctx.db.delete(order._id);
    }

    // Delete the invoice itself
    return await ctx.db.delete(args.id);
  },
});
