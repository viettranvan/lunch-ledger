import { internalQuery } from "../../_generated/server";

export const get = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("teams_settings")
      .withIndex("by_key", (q) => q.eq("key", "default"))
      .first();
  },
});
