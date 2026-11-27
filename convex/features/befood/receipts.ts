import { ConvexError, v } from "convex/values";
import { mutation, query } from "../../_generated/server";
import { requireEditor } from "../../authz";
import { assertWorkWeek } from "../grab/week";
import { assertBeFoodReceipt, beFoodReceipt } from "./receipt";

export const list = query({
  args: { from: v.string(), to: v.string() },
  handler: async (ctx, { from, to }) => {
    await requireEditor(ctx);
    assertWorkWeek(from, to);
    const receipts = await ctx.db.query("befood_receipts")
      .withIndex("by_order_on", (q) => q.gte("order_on", from).lte("order_on", to))
      .order("desc")
      .collect();
    return receipts.map((receipt) => ({
      ...receipt,
      difference_vnd: receipt.total_vnd -
        [...receipt.items, ...receipt.charges].reduce((sum, { amount }) => sum + amount, 0),
    }));
  },
});

/** Date of the newest saved order, so the bookmarklet only re-reads what is new. */
export const lastOrderOn = query({
  args: {},
  handler: async (ctx) => {
    await requireEditor(ctx);
    const latest = await ctx.db.query("befood_receipts").withIndex("by_order_on").order("desc").first();
    return latest?.order_on ?? null;
  },
});

export const save = mutation({
  args: { receipts: v.array(beFoodReceipt) },
  handler: async (ctx, { receipts }) => {
    await requireEditor(ctx);
    if (receipts.length > 50) throw new ConvexError("Mỗi lần lưu tối đa 50 đơn beFood.");
    for (const receipt of receipts) {
      assertBeFoodReceipt(receipt);
      const existing = await ctx.db.query("befood_receipts")
        .withIndex("by_order_id", (q) => q.eq("order_id", receipt.order_id))
        .unique();
      const doc = { ...receipt, synced_at: Date.now() };
      if (existing) {
        await ctx.db.patch(existing._id, doc);
      } else {
        await ctx.db.insert("befood_receipts", doc);
      }
    }
  },
});
