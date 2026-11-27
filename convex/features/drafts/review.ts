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

/** Receipts of the day with what is assigned and what is left. */
function preview(receipts: Awaited<ReturnType<typeof receiptsOn>>, lines: DraftLine[]) {
  return receipts.map((receipt) => {
    const remaining = receipt.items.map((item, index) =>
      item.quantity - lines.filter((line) => line.receipt_id === receipt.id && line.item_index === index)
        .reduce((sum, line) => sum + line.quantity, 0));
    const subtotals = memberSubtotals(receipt, lines);
    return {
      ...receipt,
      remaining,
      subtotals,
      used: subtotals.length > 0,
      complete: subtotals.length > 0 && remaining.every((left) => left === 0) && receipt.total_vnd !== undefined,
    };
  });
}

/** One invoice per restaurant: a group order split into several receipts becomes a single invoice. */
export function plannedInvoices(receipts: ReturnType<typeof preview>) {
  const byRestaurant = new Map<string, { store_name: string; paid_amount?: number; prices: Map<Id<"members">, number> }>();
  for (const receipt of receipts.filter((r) => r.used)) {
    const invoice = byRestaurant.get(receipt.restaurant) ??
      { store_name: receipt.restaurant, paid_amount: 0, prices: new Map() };
    invoice.paid_amount = invoice.paid_amount === undefined || receipt.total_vnd === undefined
      ? undefined : invoice.paid_amount + receipt.total_vnd;
    for (const { member_id, item_price } of receipt.subtotals) {
      invoice.prices.set(member_id, (invoice.prices.get(member_id) ?? 0) + item_price);
    }
    byRestaurant.set(receipt.restaurant, invoice);
  }
  return [...byRestaurant.values()].map(({ store_name, paid_amount, prices }) => {
    const orders = [...prices].map(([member_id, item_price]) => ({ member_id, item_price }));
    const amounts = paid_amount === undefined ? [] : allocateProportionally(paid_amount, orders.map((o) => o.item_price));
    return { store_name, paid_amount, orders: orders.map((order, index) => ({ ...order, amount: amounts[index]?.amount })) };
  });
}

export const get = query({
  args: { date: v.string() },
  handler: async (ctx, { date }) => {
    await requireEditor(ctx);
    const draft = await draftOn(ctx, date);
    const receipts = await receiptsOn(ctx, date);
    const members = await ctx.db.query("members").collect();
    const previewed = preview(receipts, draft?.lines ?? []);
    return {
      draft,
      members: members.map((member) => ({ _id: member._id, name: member.name, is_active: member.is_active })),
      receipts: previewed,
      invoices: plannedInvoices(previewed),
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

/** Deletes a pending draft so the skill can start over; approved drafts stay as the record of their invoices. */
export const remove = mutation({
  args: { date: v.string() },
  handler: async (ctx, { date }) => {
    await requireEditor(ctx);
    const draft = await draftOn(ctx, date);
    if (!draft) throw new ConvexError("Chưa có bản nháp cho ngày này.");
    if (draft.status === "approved") throw new ConvexError("Bản nháp đã duyệt thành hóa đơn nên không xóa được.");
    await ctx.db.delete(draft._id);
  },
});

/** Creates one invoice per restaurant that has assignments; every portion of those receipts must be assigned. */
export const approve = mutation({
  args: { date: v.string() },
  handler: async (ctx, { date }) => {
    await requireEditor(ctx);
    const draft = await draftOn(ctx, date);
    if (!draft) throw new ConvexError("Chưa có bản nháp cho ngày này.");
    if (draft.status === "approved") throw new ConvexError("Bản nháp này đã được duyệt rồi.");
    const receipts = await receiptsOn(ctx, date);
    await assertLines(ctx, receipts, draft.lines);
    const previewed = preview(receipts, draft.lines);
    const used = previewed.filter((receipt) => receipt.used);
    if (!used.length) throw new ConvexError("Bản nháp chưa gán món nào cho thành viên.");
    const incomplete = used.find((receipt) => !receipt.complete);
    if (incomplete) {
      throw new ConvexError(`${incomplete.restaurant}: còn món chưa gán hết hoặc chưa đọc được tổng tiền.`);
    }
    const invoiceIds: Id<"invoices">[] = [];
    for (const invoice of plannedInvoices(previewed)) {
      invoiceIds.push(await insertInvoice(ctx, {
        store_name: invoice.store_name,
        paid_amount: invoice.paid_amount!,
        date,
        orders: invoice.orders.map(({ member_id, item_price }) => ({ member_id, item_price })),
      }));
    }
    await ctx.db.patch(draft._id, { status: "approved", invoice_ids: invoiceIds });
    return invoiceIds;
  },
});
