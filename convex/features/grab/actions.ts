"use node";

import { v } from "convex/values";
import { action } from "../../_generated/server";
import { api, internal } from "../../_generated/api";
import { gmailQuery, messageText, orderOnInVietnam, type GmailPart } from "./gmail";
import { parseGrabReceipt } from "./parse";
import { assertWorkWeek, currentWorkWeek } from "./week";

type GmailHeader = { name: string; value: string };
type GmailMessage = {
  id: string;
  internalDate?: string;
  payload?: {
    mimeType?: string;
    headers?: GmailHeader[];
    body?: { data?: string };
    parts?: GmailMessage["payload"][];
  };
};

function env(name: string) {
  const source = (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env;
  return source?.[name]?.trim() || undefined;
}

function header(message: GmailMessage, name: string) {
  return message.payload?.headers?.find((item) => item.name.toLowerCase() === name)?.value ?? "";
}

async function gmailAccessToken() {
  const clientId = env("GMAIL_CLIENT_ID");
  const clientSecret = env("GMAIL_CLIENT_SECRET");
  const refreshToken = env("GMAIL_REFRESH_TOKEN");
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "Chưa cấu hình GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET và GMAIL_REFRESH_TOKEN trên Convex.",
    );
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!response.ok) {
    throw new Error(`Gmail từ chối làm mới phiên (${response.status}).`);
  }
  const json = (await response.json()) as { access_token?: string };
  if (!json.access_token) throw new Error("Gmail không trả access token.");
  return json.access_token;
}

async function gmailGet<T>(token: string, path: string) {
  const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new Error(`Gmail trả lỗi ${response.status} khi đọc thư.`);
  }
  return (await response.json()) as T;
}

export const sync = action({
  args: {
    from: v.optional(v.string()),
    to: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!(await ctx.runQuery(api.auth.isEditorQuery, {}))) {
      throw new Error("Bạn cần đăng nhập bằng tài khoản editor.");
    }

    const week = currentWorkWeek();
    const from = args.from ?? week.from;
    const to = args.to ?? week.to;
    assertWorkWeek(from, to);

    const token = await gmailAccessToken();
    const query = encodeURIComponent(gmailQuery(from, to));
    const listed = await gmailGet<{ messages?: Array<{ id: string }> }>(
      token,
      `messages?maxResults=40&q=${query}`,
    );

    let saved = 0;
    let skipped = 0;
    for (const item of listed.messages ?? []) {
      const message = await gmailGet<GmailMessage>(token, `messages/${item.id}?format=full`);
      const orderOn = orderOnInVietnam(Number(message.internalDate ?? Date.now()));
      const parsed = parseGrabReceipt({
        subject: header(message, "subject"),
        body: messageText(message.payload as GmailPart | undefined),
        orderOn,
      });
      if (!parsed) {
        skipped += 1;
        continue;
      }
      await ctx.runMutation(internal.features.grab.internal.upsert, {
        message_id: message.id,
        from: header(message, "from"),
        subject: header(message, "subject"),
        order_on: parsed.orderOn,
        restaurant: parsed.restaurant,
        total_vnd: parsed.totalVnd,
        body_text: parsed.bodyText,
      });
      saved += 1;
    }

    return {
      from,
      to,
      fetched: listed.messages?.length ?? 0,
      saved,
      skipped,
    };
  },
});
