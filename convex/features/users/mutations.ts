import { v } from "convex/values";
import { mutation } from "../../_generated/server";

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
