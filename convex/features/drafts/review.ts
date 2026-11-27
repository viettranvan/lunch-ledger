import { ConvexError, v } from "convex/values";
import type { Id } from "../../_generated/dataModel";
import { mutation, query, type QueryCtx } from "../../_generated/server";
import { requireEditor } from "../../authz";
import { insertInvoice } from "../invoices/mutations";
import { allocateProportionally } from "../orders/allocation";
import { assertDate, assertLines, draftLine, memberSubtotals, receiptsOn, type DraftLine } from "./draft";

async function draftOn(ctx: QueryCtx, date: string) {
  assertDate(date);
  return ctx.db.query("lunch_drafts").withIndex("by_date", (q) => q.eq("date", date)).unique();
}

/** Receipts of the day with what is assigned, what is left and each member's share of the paid total. */
function preview(receipts: Awaited<ReturnType<typeof receiptsOn>>, lines: DraftLine[]) {
  return receipts.map((receipt) => {
    const remaining = receipt.items.map((item, index) =>
      item.quantity - lines.filter((line) => line.receipt_id === receipt.id && line.item_index === index)
        .reduce((sum, line) => sum + line.quantity, 0));
    const subtotals = memberSubtotals(receipt, lines);
    const amounts = receipt.total_vnd !== undefined && subtotals.length
      ? allocateProportionally(receipt.total_vnd, subtotals.map((share) => share.item_price))
      : [];
    return {
      ...receipt,
      remaining,
      used: subtotals.length > 0,
      complete: subtotals.length > 0 && remaining.every((left) => left === 0) && receipt.total_vnd !== undefined,
      shares: subtotals.map((share, index) => ({ ...share, amount: amounts[index]?.amount })),
    };
  });
}

export const get = query({
  args: { date: v.string() },
  handler: async (ctx, { date }) => {
    await requireEditor(ctx);
    const draft = await draftOn(ctx, date);
    const receipts = await receiptsOn(ctx, date);
    const members = await ctx.db.query("members").collect();
    return {
      draft,
      members: members.map((member) => ({ _id: member._id, name: member.name, is_active: member.is_active })),
      receipts: preview(receipts, draft?.lines ?? []),
    };
  },
});

export const pendingDates = query({
  args: {},
  handler: async (ctx) => {
    await requireEditor(ctx);
    // shortcut: scans the table; add a by_status index if drafts ever number in the thousands.
    const drafts = await ctx.db.query("lunch_drafts").collect();
    return drafts.filter((draft) => draft.status === "pending").map((draft) => draft.date).sort();
  },
});

export const setLines = mutation({
  args: { date: v.string(), lines: v.array(draftLine) },
  handler: async (ctx, { date, lines }) => {
    await requireEditor(ctx);
    const draft = await draftOn(ctx, date);
    if (!draft) throw new ConvexError("Chưa có bản nháp cho ngày này.");
    if (draft.status === "approved") throw new ConvexError("Bản nháp đã được duyệt nên không sửa được nữa.");
    await assertLines(ctx, await receiptsOn(ctx, date), lines);
    await ctx.db.patch(draft._id, { lines });
  },
});

/** Creates one invoice per receipt that has assignments; every portion of those receipts must be assigned. */
export const approve = mutation({
  args: { date: v.string() },
  handler: async (ctx, { date }) => {
    await requireEditor(ctx);
    const draft = await draftOn(ctx, date);
    if (!draft) throw new ConvexError("Chưa có bản nháp cho ngày này.");
    if (draft.status === "approved") throw new ConvexError("Bản nháp này đã được duyệt rồi.");
    const receipts = await receiptsOn(ctx, date);
    await assertLines(ctx, receipts, draft.lines);
    const used = preview(receipts, draft.lines).filter((receipt) => receipt.used);
    if (!used.length) throw new ConvexError("Bản nháp chưa gán món nào cho thành viên.");
    const incomplete = used.find((receipt) => !receipt.complete);
    if (incomplete) {
      throw new ConvexError(`${incomplete.restaurant}: còn món chưa gán hết hoặc chưa đọc được tổng tiền.`);
    }
    const invoiceIds: Id<"invoices">[] = [];
    for (const receipt of used) {
      invoiceIds.push(await insertInvoice(ctx, {
        store_name: receipt.restaurant,
        paid_amount: receipt.total_vnd!,
        date,
        orders: receipt.shares.map(({ member_id, item_price }) => ({ member_id, item_price })),
      }));
    }
    await ctx.db.patch(draft._id, { status: "approved", invoice_ids: invoiceIds });
    return invoiceIds;
  },
});
