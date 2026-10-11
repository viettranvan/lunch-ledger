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
    if (!current) return null;
    return {
      _id: current._id,
      _creationTime: current._creationTime,
      integration: current.integration,
      key: current.key,
      team_id: current.team_id,
      channel_id: current.channel_id,
      channel_name: current.channel_name,
      tenant_id: current.tenant_id,
      qr_image_url: current.qr_image_url,
      updated_at: current.updated_at,
    };
  },
});
