import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";
import { threadSnapshot } from "./features/teams/threadSnapshot";
import { beFoodReceipt } from "./features/befood/receipt";
import { draftLine, unmatchedMessage } from "./features/drafts/draft";

const invoiceStatus = v.union(
  v.literal("completed"),
  v.literal("empty"),
  v.literal("unpaid"),
  v.literal("partial"),
);

export default defineSchema({
  ...authTables,
  // Business-member fields stay optional here temporarily so existing user
  // documents remain valid until the legacy-member migration is run.
  users: defineTable({
    name: v.string(),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    is_active: v.optional(v.boolean()),
    teams_email: v.optional(v.string()),
  })
    .index("email", ["email"])
    .index("phone", ["phone"])
    .index("by_active", ["is_active"]),
  members: defineTable({
    name: v.string(),
    is_active: v.boolean(),
    teams_email: v.optional(v.string()),
    // Kept to make the legacy migration safe to resume/re-run.
    legacy_user_id: v.optional(v.id("users")),
  })
    .index("by_active", ["is_active"])
    .index("by_legacy_user", ["legacy_user_id"]),
  auth_bootstrap: defineTable({
    claimed_at: v.number(),
  }),
  // Shared storage for settings owned by external integrations.
  app_settings: defineTable({
    integration: v.string(),
    key: v.string(),
    team_id: v.optional(v.string()),
    channel_id: v.optional(v.string()),
    channel_name: v.optional(v.string()),
    tenant_id: v.optional(v.string()),
    qr_image_url: v.optional(v.string()),
    // Keep legacy fields accepted until saving Teams settings clears existing documents.
    sharepoint_site_address: v.optional(v.string()),
    sharepoint_folder_path: v.optional(v.string()),
    updated_at: v.number(),
  }).index("by_integration_key", ["integration", "key"]),
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
    // user_id is retained only while migrating legacy records.
    user_id: v.optional(v.id("users")),
    member_id: v.optional(v.id("members")),
    invoice_id: v.id("invoices"),
    actual_price: v.number(),
    is_paid: v.boolean(),
    item_price: v.number(),
    percentage: v.number(),
    updated_at: v.optional(v.number()),
  })
    .index("by_invoice", ["invoice_id"])
    .index("by_user_paid", ["user_id", "is_paid"])
    .index("by_member_paid", ["member_id", "is_paid"])
    .index("by_paid", ["is_paid"]),
  teams_order_threads: defineTable(threadSnapshot.fields)
    .index("by_channel_post", ["channelId", "post.id"])
    .index("by_post_date", ["postDate"]),
  befood_receipts: defineTable({ ...beFoodReceipt.fields, synced_at: v.number() })
    .index("by_order_id", ["order_id"])
    .index("by_order_on", ["order_on"]),
  grab_receipts: defineTable({
    message_id: v.string(),
    from: v.string(),
    subject: v.string(),
    order_on: v.string(),
    restaurant: v.optional(v.string()),
    total_vnd: v.optional(v.number()),
    body_text: v.string(),
    synced_at: v.number(),
  })
    .index("by_message", ["message_id"])
    .index("by_order_on", ["order_on"]),
  lunch_drafts: defineTable({
    date: v.string(),
    lines: v.array(draftLine),
    unmatched: v.array(unmatchedMessage),
    status: v.union(v.literal("pending"), v.literal("approved")),
    submitted_at: v.number(),
    invoice_ids: v.optional(v.array(v.id("invoices"))),
  }).index("by_date", ["date"]),
});
