import { v } from "convex/values";
import { query } from "../../_generated/server";

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
        const user = order.member_id ? await ctx.db.get(order.member_id) : null;
        return {
          ...order,
          user_name: user ? user.name : "Unknown User",
        };
      }),
    );
  },
});
