import { v } from "convex/values";
import { query } from "../../_generated/server";
import { requireEditor } from "../../authz";
import { assertWorkWeek, currentWorkWeek } from "./week";
import { parseGrabReceipt } from "./parse";

export const defaultWeek = query({
  args: {},
  handler: async (ctx) => {
    await requireEditor(ctx);
    return currentWorkWeek();
  },
});

export const list = query({
  args: { from: v.string(), to: v.string() },
  handler: async (ctx, args) => {
    await requireEditor(ctx);
    assertWorkWeek(args.from, args.to);
    const receipts = await ctx.db
      .query("grab_receipts")
      .withIndex("by_order_on", (q) => q.gte("order_on", args.from).lte("order_on", args.to))
      .collect();
    return receipts.sort((left, right) =>
      right.order_on.localeCompare(left.order_on) || right.synced_at - left.synced_at,
    ).flatMap((receipt) => {
      const parsed = parseGrabReceipt({
        subject: receipt.subject,
        body: receipt.body_text,
        orderOn: receipt.order_on,
        normalized: true,
      });
      if (!parsed) return [];
      return [{
        _id: receipt._id,
        subject: receipt.subject,
        order_on: receipt.order_on,
        restaurant: parsed.restaurant ?? receipt.restaurant,
        total_vnd: parsed.totalVnd ?? receipt.total_vnd,
        items: parsed.items,
        charges: parsed.charges,
      }];
    });
  },
});
