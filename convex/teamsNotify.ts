"use node";

import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import type { DebtPayloadItem } from "./teamsNotifyQueries";

type SendDebtReminderResult =
  | { sent: false; reason: "no_debts" }
  | { sent: false; reason: "no_emails"; missingEmail: string[] }
  | { sent: true; count: number; missingEmail: string[] };

function getWebhookUrl(): string | undefined {
  const env = (globalThis as { process?: { env?: Record<string, string> } })
    .process?.env;
  return env?.POWER_AUTOMATE_WEBHOOK_URL;
}

export const sendDebtReminder = action({
  args: {},
  handler: async (ctx): Promise<SendDebtReminderResult> => {
    const webhookUrl = getWebhookUrl();
    if (!webhookUrl) {
      throw new Error(
        "Chưa cấu hình POWER_AUTOMATE_WEBHOOK_URL trên Convex. Xem docs/POWER_AUTOMATE_SETUP.md",
      );
    }

    const debts: DebtPayloadItem[] = await ctx.runQuery(
      internal.teamsNotifyQueries.getDebtPayload,
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
