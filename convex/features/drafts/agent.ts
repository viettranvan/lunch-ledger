import { ConvexError, v } from "convex/values";
import { internalMutation, internalQuery } from "../../_generated/server";
import { assertDate, assertLines, draftLine, receiptsOn, unmatchedMessage } from "./draft";

// Internal on purpose: only `npx convex run` (deploy key / dev login) can call these, never the browser.

/** Everything the lunch-draft skill needs to map one day's Teams orders onto that day's receipts. */
export const input = internalQuery({
  args: { date: v.string() },
  handler: async (ctx, { date }) => {
    assertDate(date);
    const members = await ctx.db.query("members").withIndex("by_active", (q) => q.eq("is_active", true)).collect();
    const threads = await ctx.db.query("teams_order_threads")
      .withIndex("by_post_date", (q) => q.eq("postDate", date)).collect();
    const message = ({ id, sentAt, authorName, text }: typeof threads[number]["post"]) => ({ id, sentAt, authorName, text });
    const draft = await ctx.db.query("lunch_drafts").withIndex("by_date", (q) => q.eq("date", date)).unique();
    return {
      date,
      existing_draft_status: draft?.status ?? null,
      members: members.map((member) => ({ id: member._id, name: member.name, teams_email: member.teams_email ?? null })),
      threads: threads.map((thread) => ({
        post: message(thread.post),
        replies: thread.replies.map(message),
        may_have_more_replies: thread.mayHaveMoreReplies,
      })),
      receipts: (await receiptsOn(ctx, date)).map((receipt) => ({
        ...receipt,
        items: receipt.items.map((item, item_index) => ({ item_index, ...item })),
      })),
    };
  },
});

/** Stores the skill's mapping as a pending draft for the editor to review on /drafts. */
export const submit = internalMutation({
  args: { date: v.string(), lines: v.array(draftLine), unmatched: v.array(unmatchedMessage) },
  handler: async (ctx, { date, lines, unmatched }) => {
    assertDate(date);
    if (unmatched.length > 100) throw new ConvexError("Tối đa 100 tin nhắn chưa khớp.");
    const assigned = await assertLines(ctx, await receiptsOn(ctx, date), lines);
    const existing = await ctx.db.query("lunch_drafts").withIndex("by_date", (q) => q.eq("date", date)).unique();
    if (existing?.status === "approved") throw new ConvexError(`Bản nháp ngày ${date} đã được duyệt thành hóa đơn.`);
    const doc = { date, lines, unmatched, status: "pending" as const, submitted_at: Date.now() };
    if (existing) await ctx.db.replace(existing._id, doc);
    else await ctx.db.insert("lunch_drafts", doc);
    return { saved_lines: lines.length, assigned_items: Object.fromEntries(assigned), unmatched: unmatched.length };
  },
});
