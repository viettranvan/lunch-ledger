import { v } from "convex/values";
import { mutation } from "../../_generated/server";
import { requireEditor } from "../../authz";

const integration = "teams";
const settingsKey = "default";

export const save = mutation({
  args: {
    team_id: v.string(),
    channel_id: v.string(),
    channel_name: v.optional(v.string()),
    tenant_id: v.string(),
    qr_image_url: v.optional(v.string()),
    sharepoint_site_address: v.optional(v.string()),
    sharepoint_folder_path: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireEditor(ctx);
    const teamId = args.team_id.trim();
    const channelId = args.channel_id.trim();
    const channelName = args.channel_name?.trim() || undefined;
    const tenantId = args.tenant_id.trim();
    const qrImageUrl = args.qr_image_url?.trim() || undefined;
    const sharePointSiteAddress = args.sharepoint_site_address?.trim() ?? "";
    const sharePointFolderPath = args.sharepoint_folder_path?.trim() ?? "";

    if (!teamId || !channelId || !tenantId) {
      throw new Error("Team ID, Channel ID và Tenant ID là bắt buộc.");
    }
    if (qrImageUrl && !/^https?:\/\//i.test(qrImageUrl)) {
      throw new Error("QR image URL phải bắt đầu bằng http:// hoặc https://.");
    }
    if (!sharePointSiteAddress || !sharePointFolderPath) {
      throw new Error("SharePoint Site Address và Folder Path là bắt buộc.");
    }
    let siteUrl: URL;
    try {
      siteUrl = new URL(sharePointSiteAddress);
    } catch {
      throw new Error("SharePoint Site Address phải là URL HTTPS hợp lệ.");
    }
    if (
      siteUrl.protocol !== "https:" ||
      siteUrl.search ||
      siteUrl.hash ||
      /\/Forms\/AllItems\.aspx$/i.test(siteUrl.pathname)
    ) {
      throw new Error(
        "SharePoint Site Address phải là URL site HTTPS, bỏ phần /Shared Documents/Forms/AllItems.aspx.",
      );
    }
    if (
      !sharePointFolderPath.startsWith("/") ||
      /\/Forms\/AllItems\.aspx(?:[?#]|$)/i.test(sharePointFolderPath)
    ) {
      throw new Error(
        "SharePoint Folder Path phải là đường dẫn thư mục như /Shared Documents, không phải URL AllItems.aspx.",
      );
    }

    const existing = await ctx.db
      .query("app_settings")
      .withIndex("by_integration_key", (q) =>
        q.eq("integration", integration).eq("key", settingsKey),
      )
      .first();
    const values = {
      integration,
      key: settingsKey,
      team_id: teamId,
      channel_id: channelId,
      channel_name: channelName,
      tenant_id: tenantId,
      qr_image_url: qrImageUrl,
      sharepoint_site_address: sharePointSiteAddress,
      sharepoint_folder_path: sharePointFolderPath,
      updated_at: Date.now(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, values);
      return existing._id;
    }

    return await ctx.db.insert("app_settings", values);
  },
});
