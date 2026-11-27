import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../../_generated/dataModel";
import type { QueryCtx } from "../../_generated/server";
import { parseGrabReceipt } from "../grab/parse";

export const draftLine = v.object({
  message_id: v.optional(v.string()),
  member_id: v.id("members"),
  receipt_id: v.string(),
  item_index: v.number(),
  quantity: v.number(),
  confidence: v.union(v.literal("high"), v.literal("low")),
  note: v.optional(v.string()),
});

export const unmatchedMessage = v.object({
  message_id: v.optional(v.string()),
  author: v.string(),
  text: v.string(),
  reason: v.string(),
});

export type DraftLine = typeof draftLine.type;
export type DraftReceipt = {
  id: string;
  source: "befood" | "grab";
  restaurant: string;
  total_vnd?: number;
  items: { quantity: number; name: string; amount: number }[];
  charges: { label: string; amount: number }[];
};

export function assertDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || new Date(date).toISOString().slice(0, 10) !== date) {
    throw new ConvexError("Ngày phải có dạng YYYY-MM-DD.");
  }
}

function fromBeFood(receipt: Doc<"befood_receipts">): DraftReceipt {
  return {
    id: receipt._id,
    source: "befood",
    restaurant: receipt.restaurant,
    total_vnd: receipt.total_vnd,
    items: receipt.items,
    charges: receipt.charges,
  };
}

function fromGrab(receipt: Doc<"grab_receipts">): DraftReceipt | null {
  const parsed = parseGrabReceipt({
    subject: receipt.subject, body: receipt.body_text, orderOn: receipt.order_on, normalized: true,
  });
  if (!parsed) return null;
  return {
    id: receipt._id,
    source: "grab",
    restaurant: parsed.restaurant ?? receipt.restaurant ?? receipt.subject,
    total_vnd: parsed.totalVnd ?? receipt.total_vnd,
    items: parsed.items,
    charges: parsed.charges,
  };
}

/** Every beFood and Grab receipt ordered on `date`, in one shape the agent and the review page share. */
export async function receiptsOn(ctx: QueryCtx, date: string) {
  const beFood = await ctx.db.query("befood_receipts")
    .withIndex("by_order_on", (q) => q.eq("order_on", date)).collect();
  const grab = await ctx.db.query("grab_receipts")
    .withIndex("by_order_on", (q) => q.eq("order_on", date)).collect();
  return [
    ...beFood.map(fromBeFood),
    ...grab.flatMap((receipt) => fromGrab(receipt) ?? []),
  ];
}

export function unitPrice(item: DraftReceipt["items"][number]) {
  return item.amount / item.quantity;
}

/** Rejects lines that point at missing receipts/items/members or assign more portions than were ordered. */
export async function assertLines(ctx: QueryCtx, receipts: DraftReceipt[], lines: DraftLine[]) {
  if (lines.length > 200) throw new ConvexError("Tối đa 200 dòng phân bổ mỗi ngày.");
  const byId = new Map(receipts.map((receipt) => [receipt.id, receipt]));
  const assigned = new Map<string, number>();
  const members = new Map<Id<"members">, Doc<"members"> | null>();
  for (const [index, line] of lines.entries()) {
    const where = `Dòng ${index + 1}`;
    const receipt = byId.get(line.receipt_id);
    if (!receipt) throw new ConvexError(`${where}: receipt_id không thuộc ngày này.`);
    const item = receipt.items[line.item_index];
    if (!Number.isInteger(line.item_index) || !item) {
      throw new ConvexError(`${where}: item_index ${line.item_index} không có trong ${receipt.restaurant}.`);
    }
    if (!Number.isSafeInteger(line.quantity) || line.quantity <= 0) {
      throw new ConvexError(`${where}: quantity phải là số nguyên dương.`);
    }
    if ((line.note?.length ?? 0) > 300) throw new ConvexError(`${where}: note tối đa 300 ký tự.`);
    if (!members.has(line.member_id)) members.set(line.member_id, await ctx.db.get(line.member_id));
    if (!members.get(line.member_id)?.is_active) {
      throw new ConvexError(`${where}: member_id không tồn tại hoặc đã ngừng hoạt động.`);
    }
    const key = `${line.receipt_id}#${line.item_index}`;
    const total = (assigned.get(key) ?? 0) + line.quantity;
    if (total > item.quantity) {
      throw new ConvexError(`${where}: "${item.name}" chỉ có ${item.quantity} phần nhưng đã gán ${total}.`);
    }
    assigned.set(key, total);
  }
  return assigned;
}

/** Per-receipt member subtotals at menu price; the invoice later spreads fees and discounts by these weights. */
export function memberSubtotals(receipt: DraftReceipt, lines: DraftLine[]) {
  const subtotals = new Map<Id<"members">, number>();
  for (const line of lines) {
    if (line.receipt_id !== receipt.id) continue;
    const item = receipt.items[line.item_index];
    subtotals.set(line.member_id, (subtotals.get(line.member_id) ?? 0) + unitPrice(item) * line.quantity);
  }
  return [...subtotals].map(([member_id, subtotal]) => ({ member_id, item_price: Math.round(subtotal) }));
}
