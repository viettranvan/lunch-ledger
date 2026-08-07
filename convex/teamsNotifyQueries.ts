import { internalQuery } from "./_generated/server";

export type DebtPayloadItem = {
  name: string;
  email: string | null;
  amount: number;
  formatted_total: string;
  details: string;
  line: string;
  direction: "owed" | "owes_you" | "clear";
};

function formatDetails(details: number[]): string {
  return details
    .map((val) => {
      const display = (Math.abs(val) / 1000).toLocaleString("vi-VN");
      return val < 0 ? `-${display}` : display;
    })
    .join(" + ");
}

export const getDebtPayload = internalQuery({
  args: {},
  handler: async (ctx): Promise<DebtPayloadItem[]> => {
    const users = await ctx.db
      .query("users")
      .withIndex("by_active", (q) => q.eq("is_active", true))
      .collect();

    const unpaidOrders = await ctx.db
      .query("orderers")
      .withIndex("by_paid", (q) => q.eq("is_paid", false))
      .collect();

    return users
      .map((user) => {
        const userOrders = unpaidOrders.filter((o) => o.user_id === user._id);
        const totalDebt = userOrders.reduce(
          (sum, order) => sum + order.actual_price,
          0,
        );
        const details = userOrders.map((order) => order.actual_price);

        let direction: DebtPayloadItem["direction"] = "clear";
        if (totalDebt > 0) direction = "owed";
        else if (totalDebt < 0) direction = "owes_you";

        const formattedTotal = `${totalDebt.toLocaleString("vi-VN")}đ`;
        const detailsText = formatDetails(details);

        return {
          name: user.name,
          email: user.teams_email ?? null,
          amount: totalDebt,
          formatted_total: formattedTotal,
          details: detailsText,
          line: `${detailsText} = ${formattedTotal}`,
          direction,
        };
      })
      .filter((d) => d.direction === "owed")
      .sort((a, b) => b.amount - a.amount);
  },
});
