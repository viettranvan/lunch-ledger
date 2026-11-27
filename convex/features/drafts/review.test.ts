// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { describe, expect, it, vi } from "vitest";
import { api, internal } from "../../_generated/api";
import schema from "../../schema";
import { modules } from "../../test.setup";

describe("lunch drafts", () => {
  it("validates agent lines, blocks incomplete approval and creates invoices once", async () => {
    vi.stubEnv("EDITOR_EMAIL", "editor@example.com");
    try {
      const t = convexTest(schema, modules);
      const date = "2026-11-17";
      const { userId, an, binh, receiptId } = await t.run(async (ctx) => ({
        userId: await ctx.db.insert("users", { name: "Editor", email: "editor@example.com" }),
        an: await ctx.db.insert("members", { name: "An", is_active: true }),
        binh: await ctx.db.insert("members", { name: "Bình", is_active: true }),
        receiptId: await ctx.db.insert("befood_receipts", {
          order_id: "1", order_on: date, restaurant: "Bún Bò",
          items: [{ quantity: 2, name: "Bún bò tái", amount: 100_000 }, { quantity: 1, name: "Trà đá", amount: 10_000 }],
          charges: [], total_vnd: 99_000, synced_at: 0,
        }),
      }));
      const editor = t.withIdentity({ subject: userId });
      const line = (member_id: typeof an, item_index: number, quantity = 1) =>
        ({ member_id, receipt_id: receiptId, item_index, quantity, confidence: "high" as const });
      const { submit } = internal.features.drafts.agent;
      const { approve, get } = api.features.drafts.review;

      await expect(t.mutation(submit, { date, lines: [line(an, 0, 3)], unmatched: [] })).rejects.toThrow();
      await t.mutation(submit, { date, lines: [line(an, 0), line(binh, 0)], unmatched: [] });
      await expect(editor.mutation(approve, { date })).rejects.toThrow();

      await t.mutation(submit, { date, lines: [line(an, 0), line(binh, 0), line(binh, 1)], unmatched: [] });
      const ids = await editor.mutation(approve, { date });
      expect(ids).toHaveLength(1);
      const orders = await t.run((ctx) => ctx.db.query("orderers").collect());
      expect(orders.map(({ member_id, item_price, actual_price }) => ({ member_id, item_price, actual_price })))
        .toEqual(expect.arrayContaining([
          { member_id: an, item_price: 50_000, actual_price: 45_000 },
          { member_id: binh, item_price: 60_000, actual_price: 54_000 },
        ]));
      expect((await editor.query(get, { date })).draft?.status).toBe("approved");
      await expect(editor.mutation(approve, { date })).rejects.toThrow();
      await expect(t.mutation(submit, { date, lines: [], unmatched: [] })).rejects.toThrow();
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
