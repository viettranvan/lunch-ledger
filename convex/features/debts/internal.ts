import { internalQuery } from "../../_generated/server";
import { aggregateUserDebts, toTeamsDebtPayload } from "./helpers";
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

    return toTeamsDebtPayload(aggregateUserDebts(users, unpaidOrders));
  },
});
