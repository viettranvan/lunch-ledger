"use node";

import { v } from "convex/values";
import { action } from "../../_generated/server";
import { api, internal } from "../../_generated/api";
import type { DebtPayloadItem } from "../../features/debts/helpers";

type SendDebtReminderResult =
  | { sent: false; reason: "no_debts" }
  | { sent: false; reason: "no_emails"; missingEmail: string[] }
  | { sent: false; reason: "accepted"; count: number; missingEmail: string[] }
  | { sent: true; count: number; missingEmail: string[] };

const INTRO_QUOTES = [
  "🍜 Ăn chung một bữa nên duyên<br>Chia bill gọn ghẽ, thêm duyên chuyện trò",
  "🍚 Ngồi chung một bữa thật vui<br>Bill chia gọn ghẽ, niềm vui trọn ngày",
  "🥢 Ăn ngon thêm chuyện thêm vui<br>Bill chia gọn ghẽ, niềm vui thêm đầy",
  "🍽️ Bữa trưa góp chuyện thêm vui<br>Cơm ngon bill gọn, niềm vui trọn ngày",
  "🌿 Ngồi chung câu chuyện rộn ràng<br>Cơm ngon bill gọn, rộn ràng niềm vui",
  "🍜 Ăn ngon, chuyện cũng thêm duyên<br>Bill chia gọn ghẽ, chuyện duyên thêm dài",
  "🥢 Một bàn ríu rít chuyện vui<br>Cơm ngon bill gọn, niềm vui mang về",
  "🍚 Ăn chung một bữa thật vui<br>Chuyện thêm một chút, tiếng cười thêm đôi",
  "🍽️ Cơm ngon, câu chuyện cũng ngon<br>Bill chia ngay ngắn, niềm vui vẫn tròn",
];

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
  args: {
    previewSnapshot: v.array(
      v.object({ name: v.string(), amount: v.number(), details: v.string() }),
    ),
  },
  handler: async (ctx, args): Promise<SendDebtReminderResult> => {
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
    const currentSnapshot = debts.map(({ name, amount, details }) => ({
      name,
      amount,
      details,
    }));
    const sortSnapshot = (snapshot: typeof currentSnapshot) =>
      [...snapshot].sort(
        (a, b) =>
          a.name.localeCompare(b.name) ||
          a.amount - b.amount ||
          a.details.localeCompare(b.details),
      );
    const previewSnapshot = sortSnapshot(args.previewSnapshot);
    const latestSnapshot = sortSnapshot(currentSnapshot);
    const differences = { members: 0, amounts: 0, details: 0 };
    if (previewSnapshot.length !== latestSnapshot.length) {
      differences.members = Math.abs(previewSnapshot.length - latestSnapshot.length);
    } else {
      for (let index = 0; index < previewSnapshot.length; index++) {
        const preview = previewSnapshot[index];
        const latest = latestSnapshot[index];
        if (preview.name !== latest.name) {
          differences.members++;
          continue;
        }
        if (preview.amount !== latest.amount) differences.amounts++;
        if (preview.details !== latest.details) differences.details++;
      }
    }
    if (differences.members || differences.amounts || differences.details) {
      const differenceSummary = [
        `thành viên: ${differences.members}`,
        `số tiền: ${differences.amounts}`,
        `chi tiết: ${differences.details}`,
      ].join(", ");
      throw new Error(
        `Công nợ khác preview (${differenceSummary}). Hãy mở lại preview rồi gửi lại.`,
      );
    }

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

    const introQuote =
      INTRO_QUOTES[Math.floor(Math.random() * INTRO_QUOTES.length)];

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        teamId,
        channelId,
        channelName,
        tenantId,
        qrImageUrl,
        introQuote,
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

    if (response.status === 202) {
      return {
        sent: false,
        reason: "accepted",
        count: withEmail.length,
        missingEmail,
      };
    }

    return {
      sent: true,
      count: withEmail.length,
      missingEmail,
    };
  },
});
