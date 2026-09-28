import type { Doc, Id } from "../../_generated/dataModel";

export type DebtOverviewItem = {
  user_id: Id<"users">;
  name: string;
  teams_email: string | null;
  totalDebt: number;
  absTotal: number;
  direction: "owed" | "owes_you";
  details: number[];
};

export type DebtPayloadItem = {
  name: string;
  email: string | null;
  amount: number;
  formatted_total: string;
  details: string;
  line: string;
  direction: "owed";
};

export function aggregateUserDebts(
  users: Doc<"users">[],
  unpaidOrders: Doc<"orderers">[],
): DebtOverviewItem[] {
  const ordersByUser = new Map<Id<"users">, number[]>();

  for (const order of unpaidOrders) {
    const amounts = ordersByUser.get(order.user_id) ?? [];
    amounts.push(order.actual_price);
    ordersByUser.set(order.user_id, amounts);
  }

  return users
    .map((user) => {
      const details = ordersByUser.get(user._id) ?? [];
      const totalDebt = details.reduce((sum, amount) => sum + amount, 0);

      return {
        user_id: user._id,
        name: user.name,
        teams_email: user.teams_email ?? null,
        totalDebt,
        absTotal: Math.abs(totalDebt),
        direction: totalDebt > 0 ? ("owed" as const) : ("owes_you" as const),
        details,
      };
    })
    .filter((userDebt) => userDebt.totalDebt !== 0)
    .sort((a, b) => b.totalDebt - a.totalDebt);
}

function formatDetails(details: number[]): string {
  return details
    .map((amount) => {
      const display = (Math.abs(amount) / 1000).toLocaleString("vi-VN");
      return amount < 0 ? `-${display}` : display;
    })
    .join(" + ");
}

export function toTeamsDebtPayload(
  debts: DebtOverviewItem[],
): DebtPayloadItem[] {
  return debts
    .filter((debt) => debt.direction === "owed")
    .map((debt) => {
      const formattedTotal = `${debt.totalDebt.toLocaleString("vi-VN")}đ`;
      const details = formatDetails(debt.details);
      return {
        name: debt.name,
        email: debt.teams_email,
        amount: debt.totalDebt,
        formatted_total: formattedTotal,
        details,
        line: `${details} = ${formattedTotal}`,
        direction: "owed" as const,
      };
    });
}
