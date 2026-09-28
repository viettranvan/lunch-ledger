import { query } from "../../_generated/server";
import { aggregateUserDebts } from "./helpers";

export const getDebtOverview = query({
  args: {},
  handler: async (ctx) => {
    const [users, unpaidOrders] = await Promise.all([
      ctx.db
        .query("users")
        .withIndex("by_active", (q) => q.eq("is_active", true))
        .collect(),
      ctx.db
        .query("orderers")
        .withIndex("by_paid", (q) => q.eq("is_paid", false))
        .collect(),
    ]);

    return aggregateUserDebts(users, unpaidOrders);
  },
});
