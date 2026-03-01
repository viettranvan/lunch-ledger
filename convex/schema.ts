import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    name: v.string(),
    is_active: v.boolean(),
  }),
  invoices: defineTable({
    store_name: v.string(),
    paid_amount: v.number(),
    updated_at: v.optional(v.number()),
    date: v.optional(v.string()),
  }),
  orderers: defineTable({
    user_id: v.id("users"),
    invoice_id: v.id("invoices"),
    actual_price: v.number(),
    is_paid: v.boolean(),
    item_price: v.number(),
    percentage: v.number(),
    updated_at: v.optional(v.number()),
  }),
});
