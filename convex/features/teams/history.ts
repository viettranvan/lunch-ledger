import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { internalMutation, query } from "../../_generated/server";
import { requireEditor } from "../../authz";
import { assertWorkWeek } from "../grab/week";

import { threadSnapshot } from "./threadSnapshot";

export const saveThread = internalMutation({
  args: { thread: threadSnapshot },
  handler: async (ctx, { thread }) => {
    const existing = await ctx.db.query("teams_order_threads")
      .withIndex("by_channel_post", (q) => q.eq("channelId", thread.channelId).eq("post.id", thread.post.id))
      .unique();

    if (!existing) {
      await ctx.db.insert("teams_order_threads", thread);
      return { saved: true };
    }
    if (existing.observedAt >= thread.observedAt) return { saved: false };

    await ctx.db.replace(existing._id, thread);
    return { saved: true };
  },
});

export const list = query({
  args: { from: v.string(), to: v.string(), paginationOpts: paginationOptsValidator },
  handler: async (ctx, { from, to, paginationOpts }) => {
    await requireEditor(ctx);
    assertWorkWeek(from, to);
    return await ctx.db.query("teams_order_threads")
      .withIndex("by_post_date", (q) => q.gte("postDate", from).lte("postDate", to))
      .order("desc")
      .paginate({ ...paginationOpts, numItems: Math.min(paginationOpts.numItems, 20) });
  },
});
