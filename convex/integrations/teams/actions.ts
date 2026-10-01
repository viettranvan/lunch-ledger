"use node";

import { action } from "../../_generated/server";
import { api, internal } from "../../_generated/api";
import type { DebtPayloadItem } from "../../features/debts/helpers";

type SendDebtReminderResult =
  | { sent: false; reason: "no_debts" }
  | { sent: false; reason: "no_emails"; missingEmail: string[] }
  | { sent: true; count: number; missingEmail: string[] };

function getWebhookUrl(): string | undefined {
  const env = (globalThis as { process?: { env?: Record<string, string> } })
    .process?.env;
  return env?.POWER_AUTOMATE_WEBHOOK_URL;
}

function getPublicAppUrl(): string | undefined {
  const env = (globalThis as { process?: { env?: Record<string, string> } })
    .process?.env;
  const value = env?.PUBLIC_APP_URL?.trim();
  if (!value) return undefined;

  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.hostname !== "localhost") {
      return undefined;
    }
    return url.toString().replace(/\/$/, "");
  } catch {
    return undefined;
  }
}

export const sendDebtReminder = action({
  args: {},
  handler: async (ctx): Promise<SendDebtReminderResult> => {
    if (!(await ctx.runQuery(api.auth.isEditorQuery, {}))) {
      throw new Error("Bạn cần đăng nhập bằng tài khoản editor để gửi Teams.");
    }
    const webhookUrl = getWebhookUrl();
    if (!webhookUrl) {
      throw new Error(
        "Chưa cấu hình POWER_AUTOMATE_WEBHOOK_URL trên Convex. Xem docs/POWER_AUTOMATE_SETUP.md",
      );
    }
    const publicAppUrl = getPublicAppUrl();
    if (!publicAppUrl) {
      throw new Error(
        "Chưa cấu hình PUBLIC_APP_URL hợp lệ trên Convex. Hãy đặt URL Lunch Ledger public trước khi gửi Teams.",
      );
    }

    const teamsConfig = await ctx.runQuery(
      internal.features.teams.internal.get,
      {},
    );
    if (!teamsConfig) {
      throw new Error("Chưa cấu hình kênh Teams trong mục Configuration.");
    }

    const teamId = teamsConfig.team_id?.trim() ?? "";
    const channelId = teamsConfig.channel_id?.trim() ?? "";
    const channelName = teamsConfig.channel_name?.trim() || undefined;
    const tenantId = teamsConfig.tenant_id?.trim() ?? "";
    const qrImageUrl = teamsConfig.qr_image_url?.trim() || undefined;
    if (!teamId || !channelId || !tenantId) {
      throw new Error("Thiếu Team ID, Channel ID hoặc Tenant ID của Teams.");
    }

    const debts: DebtPayloadItem[] = await ctx.runQuery(
      internal.features.debts.internal.getDebtPayload,
    );

    if (debts.length === 0) {
      return { sent: false, reason: "no_debts" };
    }

    const withEmail = debts.filter((d) => d.email);
    const missingEmail = debts
      .filter((d) => !d.email)
      .map((d) => d.name);

    if (withEmail.length === 0) {
      return {
        sent: false,
        reason: "no_emails",
        missingEmail,
      };
    }

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        teamId,
        channelId,
        channelName,
        tenantId,
        qrImageUrl,
        appUrl: publicAppUrl,
        debts: withEmail.map((d) => ({
          name: d.name,
          email: d.email,
          amount: d.amount,
          formatted_total: d.formatted_total,
          details: d.details,
          line: d.line,
        })),
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Power Automate webhook failed (${response.status}): ${body}`,
      );
    }

    return {
      sent: true,
      count: withEmail.length,
      missingEmail,
    };
  },
});
