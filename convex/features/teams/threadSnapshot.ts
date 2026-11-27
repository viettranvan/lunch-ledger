import { v } from "convex/values";
import { orderOnInVietnam } from "../grab/gmail";

const messageFields = {
  id: v.string(),
  sentAt: v.string(),
  authorId: v.optional(v.string()),
  authorName: v.string(),
  text: v.string(),
};

export const threadSnapshot = v.object({
  channelId: v.string(),
  post: v.object(messageFields),
  replies: v.array(v.object(messageFields)),
  mayHaveMoreReplies: v.boolean(),
  observedAt: v.number(),
  postDate: v.string(),
  postUrl: v.optional(v.string()),
});

type TeamsMessage = typeof threadSnapshot.type.post;

function record(value: unknown, field = "message field") {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Expected an object for ${field}.`);
  }
  return value as Record<string, unknown>;
}

function requiredString(value: unknown, limit: number) {
  if (typeof value !== "string" || !value.trim() || value.length > limit) {
    throw new Error("Missing or invalid text field.");
  }
  return value;
}

function timestamp(value: unknown) {
  const time = Date.parse(requiredString(value, 64));
  if (!Number.isFinite(time)) throw new Error("Invalid timestamp.");
  return time;
}

function messageText(content: string, isHtml: boolean) {
  if (!isHtml) return content.trim();
  // Store plain text so the browser never interprets Teams content as markup.
  return content
    .replace(/<br\s*\/?>|<\/(?:div|p|li|blockquote)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&(?:amp|lt|gt|quot|apos|nbsp|#39);/g, (entity) => ({
      "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'", "&nbsp;": " ", "&#39;": "'",
    })[entity] ?? entity)
    .trim();
}

function readMessage(value: Record<string, unknown>): TeamsMessage {
  const from = value.from ? record(value.from) : {};
  const identity = from.user ?? from.application;
  const author = identity ? record(identity) : {};
  const body = value.body ? record(value.body) : {};
  const content = typeof body.content === "string" ? body.content.slice(0, 2_000) : "";
  return {
    id: requiredString(value.id, 128),
    sentAt: new Date(timestamp(value.createdDateTime)).toISOString(),
    authorId: typeof author.id === "string" ? author.id.slice(0, 128) : undefined,
    authorName: typeof author.displayName === "string" && author.displayName.trim()
      ? author.displayName.slice(0, 160)
      : "Không rõ người gửi",
    text: messageText(content, body.contentType === "html"),
  };
}

function teamsPostUrl(value: unknown) {
  if (typeof value !== "string" || value.length > 2_000) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol === "https:" && url.hostname === "teams.microsoft.com") return url.href;
  } catch {
    return undefined;
  }
}

export function readThreadSnapshot(value: unknown): typeof threadSnapshot.type {
  const input = record(value, "request body");
  const channelId = requiredString(input.channelId, 256);
  const observedAt = timestamp(input.observedAt);
  const rawPost = record(input.post, "post");
  if (rawPost.channelIdentity && record(rawPost.channelIdentity).channelId !== channelId) {
    throw new Error("Post belongs to another channel.");
  }
  const post = readMessage(rawPost);
  const replyPage = record(input.replies, "replies");
  if (!Array.isArray(replyPage.value) || replyPage.value.length > 50) {
    throw new Error("Expected up to 50 replies.");
  }

  const replies = new Map<string, TeamsMessage>();
  for (const raw of replyPage.value) {
    const row = record(raw);
    if (row.replyToId && row.replyToId !== post.id) throw new Error("Reply belongs to another thread.");
    if (row.deletedDateTime) continue;
    const reply = readMessage(row);
    replies.set(reply.id, reply);
  }

  return {
    channelId,
    post,
    postDate: orderOnInVietnam(Date.parse(post.sentAt)),
    postUrl: teamsPostUrl(rawPost.webUrl),
    observedAt,
    replies: [...replies.values()].sort((a, b) => a.sentAt.localeCompare(b.sentAt)),
    mayHaveMoreReplies: replyPage.value.length === 50 || Boolean(replyPage["@odata.nextLink"]),
  };
}
