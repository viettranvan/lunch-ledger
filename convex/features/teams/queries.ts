import { query } from "../../_generated/server";
import { requireEditor } from "../../authz";

const integration = "teams";
const settingsKey = "default";

export const get = query({
  args: {},
  handler: async (ctx) => {
    await requireEditor(ctx);
    const current = await ctx.db
      .query("app_settings")
      .withIndex("by_integration_key", (q) =>
        q.eq("integration", integration).eq("key", settingsKey),
      )
      .first();
    return current;
  },
});
