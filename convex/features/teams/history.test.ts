// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { describe, expect, it, vi } from "vitest";
import { api } from "../../_generated/api";
import schema from "../../schema";
import { modules } from "../../test.setup";

describe("Teams order history", () => {
  it("authenticates imports, keeps the newest snapshot, and limits reading to editors", async () => {
    vi.stubEnv("EDITOR_EMAIL", "editor@example.com");
    vi.stubEnv("TEAMS_HISTORY_WEBHOOK_SECRET", "test-secret");
    vi.stubEnv("TEAMS_HISTORY_CHANNEL_ID", "channel-1");
    try {
      const t = convexTest(schema, modules);
      const editorId = await t.run((ctx) => ctx.db.insert("users", {
        name: "Editor",
        email: "editor@example.com",
      }));
      const editor = t.withIdentity({ subject: editorId });
      const post = {
        id: "post-1",
        createdDateTime: "2026-11-15T18:00:00Z",
        body: { contentType: "text", content: "Đặt cơm" },
      };
      const payload = {
        channelId: "channel-1",
        observedAt: "2026-11-20T10:00:00Z",
        post,
        replies: {
          value: [{
            ...post,
            id: "reply-1",
            replyToId: post.id,
            from: { user: { id: "user-1", displayName: "An" } },
            body: { contentType: "html", content: "<p>Cơm gà<br>+1 &amp; trứng</p>" },
          }],
        },
      };
      const send = (body: unknown, token = "test-secret") => t.fetch("/integrations/teams/history", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });

      expect((await send(payload, "wrong")).status).toBe(401);
      expect((await send({ ...payload, channelId: "other" })).status).toBe(403);
      expect((await send({ ...payload, replies: {} })).status).toBe(400);
      expect(await (await send(payload)).json()).toEqual({ saved: true });
      expect(await (await send(payload)).json()).toEqual({ saved: false });
      expect(await (await send({ ...payload, post: { ...post, body: {} }, observedAt: "2026-11-19T10:00:00Z" })).json())
        .toEqual({ saved: false });

      const args = { from: "2026-11-16", to: "2026-11-20", paginationOpts: { numItems: 10, cursor: null } };
      await expect(t.query(api.features.teams.history.list, args)).rejects.toThrow(/editor/i);
      const { page } = await editor.query(api.features.teams.history.list, args);
      expect(page).toHaveLength(1);
      expect(page[0]).toMatchObject({
        postDate: "2026-11-16",
        post: { text: "Đặt cơm" },
        replies: [{ authorId: "user-1", authorName: "An", text: "Cơm gà\n+1 & trứng" }],
      });
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
