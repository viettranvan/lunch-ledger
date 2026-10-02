import { internalQuery } from "../../_generated/server";
import {
  aggregateUserDebts,
  toTeamsDebtPayload,
  withInvoiceTypes,
} from "./helpers";
import type { DebtPayloadItem } from "./helpers";

export type { DebtPayloadItem } from "./helpers";

export const getDebtPayload = internalQuery({
  args: {},
  handler: async (ctx): Promise<DebtPayloadItem[]> => {
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
    const invoiceTypes = new Map(
      invoices
        .filter((invoice) => invoice !== null)
        .map((invoice) => [
          invoice._id,
          invoice.invoice_type ?? "receivable",
        ]),
    );

    return toTeamsDebtPayload(
      aggregateUserDebts(users, withInvoiceTypes(unpaidOrders, invoiceTypes)),
    );
  },
});
