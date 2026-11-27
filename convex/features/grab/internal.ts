import { v } from "convex/values";
import { internalMutation } from "../../_generated/server";

export const upsert = internalMutation({
  args: {
    message_id: v.string(),
    from: v.string(),
    subject: v.string(),
    order_on: v.string(),
    restaurant: v.optional(v.string()),
    total_vnd: v.optional(v.number()),
    body_text: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("grab_receipts")
      .withIndex("by_message", (q) => q.eq("message_id", args.message_id))
      .unique();
    const doc = { ...args, synced_at: Date.now() };
    if (existing) {
      await ctx.db.patch(existing._id, doc);
      return existing._id;
    }
    return await ctx.db.insert("grab_receipts", doc);
  },
});
