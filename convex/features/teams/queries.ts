import { query } from "../../_generated/server";

const settingsKey = "default";

export const get = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("teams_settings")
      .withIndex("by_key", (q) => q.eq("key", settingsKey))
      .first();
  },
});
