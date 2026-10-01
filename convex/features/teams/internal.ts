import { internalQuery } from "../../_generated/server";

export const get = internalQuery({
  args: {},
  handler: async (ctx) => {
    const current = await ctx.db
      .query("app_settings")
      .withIndex("by_integration_key", (q) =>
        q.eq("integration", "teams").eq("key", "default"),
      )
      .first();
    return current;
  },
});
