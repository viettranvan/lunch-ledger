import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { query } from "../../_generated/server";

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
