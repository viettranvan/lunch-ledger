import { v } from "convex/values";
import { mutation } from "../../_generated/server";

const settingsKey = "default";

export const save = mutation({
  args: {
    team_id: v.string(),
    channel_id: v.string(),
    channel_name: v.optional(v.string()),
    tenant_id: v.string(),
    qr_image_url: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const teamId = args.team_id.trim();
    const channelId = args.channel_id.trim();
    const channelName = args.channel_name?.trim() || undefined;
    const tenantId = args.tenant_id.trim();
    const qrImageUrl = args.qr_image_url?.trim() || undefined;

    if (!teamId || !channelId || !tenantId) {
      throw new Error("Team ID, Channel ID và Tenant ID là bắt buộc.");
    }
    if (qrImageUrl && !/^https?:\/\//i.test(qrImageUrl)) {
      throw new Error("QR image URL phải bắt đầu bằng http:// hoặc https://.");
    }

    const existing = await ctx.db
      .query("teams_settings")
      .withIndex("by_key", (q) => q.eq("key", settingsKey))
      .first();
    const values = {
      key: settingsKey,
      team_id: teamId,
      channel_id: channelId,
      channel_name: channelName,
      tenant_id: tenantId,
      qr_image_url: qrImageUrl,
      updated_at: Date.now(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, values);
      return existing._id;
    }

    return await ctx.db.insert("teams_settings", values);
  },
});
