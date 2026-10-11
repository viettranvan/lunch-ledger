// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";

describe("editor-only mutations", () => {
  it("rejects anonymous writes across all business mutation groups without changing data", async () => {
    const t = convexTest(schema, modules);
    const { memberId, invoiceId, orderId } = await t.run(async (ctx) => {
      const memberId = await ctx.db.insert("members", {
        name: "Test member",
        is_active: true,
      });
      const invoiceId = await ctx.db.insert("invoices", {
        store_name: "Test invoice",
        paid_amount: 10_000,
        invoice_type: "receivable",
        date: "2026-10-01",
        status: "unpaid",
        total_orderers: 1,
        paid_orderers: 0,
      });
      const orderId = await ctx.db.insert("orderers", {
        member_id: memberId,
        invoice_id: invoiceId,
        item_price: 10_000,
        actual_price: 10_000,
        percentage: 100,
        is_paid: false,
      });
      return { memberId, invoiceId, orderId };
    });

    const invoiceOrder = [{ member_id: memberId, item_price: 10_000 }];
    const attempts = [
      () => t.mutation(api.features.invoices.mutations.create, {
        store_name: "New invoice", paid_amount: 10_000, date: "2026-10-01", orders: invoiceOrder,
      }),
      () => t.mutation(api.features.invoices.mutations.updateWithOrders, {
        id: invoiceId, store_name: "Changed invoice", paid_amount: 10_000,
        date: "2026-10-01", orders: invoiceOrder,
      }),
      () => t.mutation(api.features.invoices.mutations.deleteInvoice, { id: invoiceId }),
      () => t.mutation(api.features.orders.mutations.create, {
        member_id: memberId, invoice_id: invoiceId, item_price: 10_000,
      }),
      () => t.mutation(api.features.orders.mutations.togglePaid, { id: orderId, is_paid: true }),
      () => t.mutation(api.features.orders.mutations.settleUserBalance, {
        member_id: memberId, expected_net_amount: 10_000,
      }),
      () => t.mutation(api.features.orders.mutations.update, { id: orderId, item_price: 12_000 }),
      () => t.mutation(api.features.orders.mutations.deleteOrder, { id: orderId }),
      () => t.mutation(api.features.users.mutations.create, { name: "New member" }),
      () => t.mutation(api.features.users.mutations.updateTeamsEmail, {
        id: memberId, teams_email: "member@example.com",
      }),
      () => t.mutation(api.features.users.mutations.toggleActive, {
        id: memberId, is_active: false,
      }),
      () => t.mutation(api.features.teams.mutations.save, {
        team_id: "team", channel_id: "channel", tenant_id: "tenant",
      }),
      () => t.action(api.integrations.teams.actions.sendDebtReminder, {
        previewSnapshot: [],
      }),
    ];

    for (const attempt of attempts) {
      await expect(attempt()).rejects.toThrow(/editor/i);
    }
    await expect(t.query(api.features.users.queries.getAll, {})).rejects.toThrow(/editor/i);
    await expect(t.query(api.features.teams.queries.get, {})).rejects.toThrow(/editor/i);

    const persisted = await t.run(async (ctx) => ({
      members: await ctx.db.query("members").collect(),
      invoices: await ctx.db.query("invoices").collect(),
      orders: await ctx.db.query("orderers").collect(),
      appSettings: await ctx.db.query("app_settings").collect(),
    }));
    expect(persisted.members).toHaveLength(1);
    expect(persisted.invoices).toHaveLength(1);
    expect(persisted.orders).toHaveLength(1);
    expect(persisted.appSettings).toHaveLength(0);
  });

  it("allows anonymous read queries while redacting member contact details", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      const memberId = await ctx.db.insert("members", {
        name: "Public member",
        is_active: true,
        teams_email: "private@example.com",
      });
      const invoiceId = await ctx.db.insert("invoices", {
        store_name: "Public invoice",
        paid_amount: 10_000,
        invoice_type: "receivable",
        date: "2026-10-01",
        status: "unpaid",
        total_orderers: 1,
        paid_orderers: 0,
      });
      await ctx.db.insert("orderers", {
        member_id: memberId,
        invoice_id: invoiceId,
        item_price: 10_000,
        actual_price: 10_000,
        percentage: 100,
        is_paid: false,
      });
    });

    expect(await t.query(api.features.users.queries.getActive, {})).toMatchObject([
      { name: "Public member", is_active: true },
    ]);
    const debts = await t.query(api.features.debts.queries.getDebtOverview, {});
    expect(debts).toMatchObject([
      { name: "Public member", teams_email: null, totalDebt: 10_000 },
    ]);
  });
});
