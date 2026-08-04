import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const invoiceStatus = v.union(
  v.literal("completed"),
  v.literal("empty"),
  v.literal("unpaid"),
  v.literal("partial"),
);

export default defineSchema({
  users: defineTable({
    name: v.string(),
    is_active: v.boolean(),
  }).index("by_active", ["is_active"]),
  invoices: defineTable({
    store_name: v.string(),
    paid_amount: v.number(),
    updated_at: v.optional(v.number()),
    date: v.optional(v.string()),
    sort_time: v.optional(v.number()),
    total_orderers: v.optional(v.number()),
    paid_orderers: v.optional(v.number()),
    status: v.optional(invoiceStatus),
  }).index("by_sort_time", ["sort_time"]),
  orderers: defineTable({
    user_id: v.id("users"),
    invoice_id: v.id("invoices"),
    actual_price: v.number(),
    is_paid: v.boolean(),
    item_price: v.number(),
    percentage: v.number(),
    updated_at: v.optional(v.number()),
  })
    .index("by_invoice", ["invoice_id"])
    .index("by_user_paid", ["user_id", "is_paid"])
    .index("by_paid", ["is_paid"]),
});
