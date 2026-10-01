import { v } from "convex/values";
import { mutation } from "../../_generated/server";
import { requireEditor } from "../../authz";

export const create = mutation({
  args: {
    name: v.string(),
    teams_email: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireEditor(ctx);
    return await ctx.db.insert("members", {
      name: args.name,
      is_active: true,
      teams_email: args.teams_email,
    });
  },
});

export const updateTeamsEmail = mutation({
  args: {
    id: v.id("members"),
    teams_email: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireEditor(ctx);
    const email = args.teams_email?.trim() || undefined;
    return await ctx.db.patch(args.id, { teams_email: email });
  },
});

export const toggleActive = mutation({
  args: { id: v.id("members"), is_active: v.boolean() },
  handler: async (ctx, args) => {
    await requireEditor(ctx);
    return await ctx.db.patch(args.id, { is_active: args.is_active });
  },
});
