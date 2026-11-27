// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { describe, expect, it, vi } from "vitest";
import { api } from "../../_generated/api";
import schema from "../../schema";
import { modules } from "../../test.setup";

describe("beFood receipt storage", () => {
  it("restricts access to editors and updates an order on repeated imports", async () => {
    vi.stubEnv("EDITOR_EMAIL", "editor@example.com");
    try {
      const t = convexTest(schema, modules);
      const userId = await t.run((ctx) => ctx.db.insert("users", {
        name: "Editor",
        email: "editor@example.com",
      }));
      const editor = t.withIdentity({ subject: userId });
      const receipt = {
        order_id: "12345",
        order_on: "2026-11-20",
        restaurant: "Quán cơm",
        items: [{ quantity: 1, name: "Cơm gà", amount: 50_000 }],
        charges: [{ label: "Phí áp dụng", amount: 10_000 }],
        total_vnd: 54_000,
      };
      const range = { from: receipt.order_on, to: receipt.order_on };
      const { list, save } = api.features.befood.receipts;

      await expect(t.mutation(save, { receipts: [receipt] })).rejects.toThrow(/editor/i);
      await expect(t.query(list, range)).rejects.toThrow(/editor/i);
      await editor.mutation(save, { receipts: [receipt] });
      const [saved] = await editor.query(list, range);
      await editor.mutation(save, { receipts: [{ ...receipt, restaurant: "Quán cơm mới" }] });
      expect(await editor.query(list, range)).toMatchObject([
        { _id: saved._id, order_id: receipt.order_id, restaurant: "Quán cơm mới", difference_vnd: -6_000 },
      ]);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
