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
    if (!current) return null;
    return {
      team_id: current.team_id,
      channel_id: current.channel_id,
      channel_name: current.channel_name,
      tenant_id: current.tenant_id,
      qr_image_url: current.qr_image_url,
    };
  },
});
