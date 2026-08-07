import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const getAll = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("users")
      .withIndex("by_active", (q) => q.eq("is_active", true))
      .order("desc")
      .collect();
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    teams_email: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("users", {
      name: args.name,
      is_active: true,
      teams_email: args.teams_email,
    });
  },
});

export const updateTeamsEmail = mutation({
  args: {
    id: v.id("users"),
    teams_email: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const email = args.teams_email?.trim() || undefined;
    return await ctx.db.patch(args.id, { teams_email: email });
  },
});

export const toggleActive = mutation({
  args: { id: v.id("users"), is_active: v.boolean() },
  handler: async (ctx, args) => {
    return await ctx.db.patch(args.id, { is_active: args.is_active });
  },
});

export const getDebtOverview = query({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db
      .query("users")
      .withIndex("by_active", (q) => q.eq("is_active", true))
      .collect();

    const unpaidOrders = await ctx.db
      .query("orderers")
      .withIndex("by_paid", (q) => q.eq("is_paid", false))
      .collect();

    const overview = users.map((user) => {
      const userOrders = unpaidOrders.filter((o) => o.user_id === user._id);
      const totalDebt = userOrders.reduce(
        (sum, order) => sum + order.actual_price,
        0,
      );
      const details = userOrders.map((order) => order.actual_price);

      return {
        user_id: user._id,
        name: user.name,
        teams_email: user.teams_email ?? null,
        totalDebt,
        absTotal: Math.abs(totalDebt),
        direction: totalDebt > 0 ? "owed" : "owes_you",
        details,
      };
    });

    return overview
      .filter((userDebt) => userDebt.totalDebt !== 0)
      .sort((a, b) => b.totalDebt - a.totalDebt);
  },
});
