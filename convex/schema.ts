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
    teams_email: v.optional(v.string()),
  }).index("by_active", ["is_active"]),
  teams_settings: defineTable({
    key: v.string(),
    team_id: v.string(),
    channel_id: v.string(),
    channel_name: v.optional(v.string()),
    tenant_id: v.string(),
    qr_image_url: v.optional(v.string()),
    updated_at: v.number(),
  }).index("by_key", ["key"]),
  invoices: defineTable({
    store_name: v.string(),
    paid_amount: v.number(),
    // Missing on legacy invoices; readers treat those as receivables.
    invoice_type: v.optional(
      v.union(v.literal("receivable"), v.literal("payable")),
    ),
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
