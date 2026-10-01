import { query } from "../../_generated/server";
import { aggregateUserDebts } from "./helpers";
import { isEditor } from "../../authz";

export const getDebtOverview = query({
  args: {},
  handler: async (ctx) => {
    const [users, unpaidOrders] = await Promise.all([
      ctx.db
        .query("members")
        .withIndex("by_active", (q) => q.eq("is_active", true))
        .collect(),
      ctx.db
        .query("orderers")
        .withIndex("by_paid", (q) => q.eq("is_paid", false))
        .collect(),
    ]);

    const invoices = await Promise.all(
      [...new Set(unpaidOrders.map((order) => order.invoice_id))].map((id) =>
        ctx.db.get(id),
      ),
    );
    const invoicesById = new Map(
      invoices
        .filter((invoice) => invoice !== null)
        .map((invoice) => [invoice._id, invoice]),
    );
    const invoiceTypes = new Map(
      [...invoicesById].map(([id, invoice]) => [
        id,
        invoice.invoice_type ?? "receivable",
      ]),
    );
    const entriesByUser = new Map<
      (typeof unpaidOrders)[number]["member_id"],
      {
        invoice_id: (typeof unpaidOrders)[number]["invoice_id"];
        store_name: string;
        date: string;
        amount: number;
        invoice_type: "receivable" | "payable";
      }[]
    >();

    for (const order of unpaidOrders) {
      const invoice = invoicesById.get(order.invoice_id);
      if (!invoice || !order.member_id) continue;

      const invoiceType = invoice.invoice_type ?? "receivable";
      const entries = entriesByUser.get(order.member_id) ?? [];
      entries.push({
        invoice_id: invoice._id,
        store_name: invoice.store_name,
        date:
          invoice.date ?? new Date(invoice._creationTime).toISOString().slice(0, 10),
        amount: invoiceType === "payable" ? -order.actual_price : order.actual_price,
        invoice_type: invoiceType,
      });
      entriesByUser.set(order.member_id, entries);
    }

    const debts = aggregateUserDebts(
      users,
      unpaidOrders.map((order) => ({
        member_id: order.member_id,
        actual_price: order.actual_price,
        invoice_type: invoiceTypes.get(order.invoice_id) ?? "receivable",
      })),
    );

    const canSeeContactDetails = await isEditor(ctx);
    return debts.map((debt) => ({
      ...debt,
      teams_email: canSeeContactDetails ? debt.teams_email : null,
      entries: entriesByUser.get(debt.member_id) ?? [],
    }));
  },
});
