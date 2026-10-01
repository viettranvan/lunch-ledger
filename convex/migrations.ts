import { Migrations } from "@convex-dev/migrations";
import { components } from "./_generated/api";
import { query } from "./_generated/server";
import type { DataModel } from "./_generated/dataModel";

export const migrations = new Migrations<DataModel>(components.migrations);

export const migrateLegacyMembers = migrations.define({
  table: "users",
  migrateOne: async (ctx, legacyUser) => {
    // Auth users have no business is_active flag; only old member documents move.
    if (legacyUser.is_active === undefined) return;

    let member = await ctx.db
      .query("members")
      .withIndex("by_legacy_user", (q) => q.eq("legacy_user_id", legacyUser._id))
      .first();

    if (!member) {
      const memberId = await ctx.db.insert("members", {
        name: legacyUser.name,
        is_active: legacyUser.is_active,
        teams_email: legacyUser.teams_email,
        legacy_user_id: legacyUser._id,
      });
      member = await ctx.db.get(memberId);
    }
    if (!member) throw new Error("Không tạo được member khi migrate dữ liệu cũ.");

    const legacyOrders = await ctx.db
      .query("orderers")
      .withIndex("by_user_paid", (q) => q.eq("user_id", legacyUser._id))
      .collect();

    for (const order of legacyOrders) {
      await ctx.db.patch(order._id, {
        member_id: member._id,
        user_id: undefined,
      });
    }

    await ctx.db.delete(legacyUser._id);
  },
});

// Exposes only aggregate counts so the migration can be verified through the CLI.
export const verifyLegacyMemberMigration = query({
  args: {},
  handler: async (ctx) => {
    const [users, orders, members] = await Promise.all([
      ctx.db.query("users").collect(),
      ctx.db.query("orderers").withIndex("by_paid").collect(),
      ctx.db.query("members").collect(),
    ]);

    return {
      remainingLegacyMembers: users.filter((user) => user.is_active !== undefined).length,
      remainingLegacyOrderers: orders.filter((order) => order.member_id === undefined).length,
      members: members.length,
    };
  },
});
