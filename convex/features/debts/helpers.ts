import type { Doc, Id } from "../../_generated/dataModel";

export type DebtOverviewItem = {
  member_id: Id<"members">;
  name: string;
  teams_email: string | null;
  totalDebt: number;
  absTotal: number;
  direction: "owed" | "owes_you";
  details: number[];
  receivableTotal: number;
  payableTotal: number;
};

export type DebtLedgerOrder = Pick<
  Doc<"orderers">,
  "member_id" | "actual_price"
> & { invoice_type?: "receivable" | "payable" };

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
  users: Doc<"members">[],
  unpaidOrders: DebtLedgerOrder[],
): DebtOverviewItem[] {
  const ordersByUser = new Map<
    Id<"members">,
    { details: number[]; receivableTotal: number; payableTotal: number }
  >();

  for (const order of unpaidOrders) {
    const memberId = order.member_id;
    if (!memberId) continue;

    const totals = ordersByUser.get(memberId) ?? {
      details: [],
      receivableTotal: 0,
      payableTotal: 0,
    };
    const amount = Math.abs(order.actual_price);
    const signedAmount = order.invoice_type === "payable" ? -amount : order.actual_price;
    totals.details.push(signedAmount);
    if (order.invoice_type === "payable") totals.payableTotal += amount;
    else totals.receivableTotal += order.actual_price;
    ordersByUser.set(memberId, totals);
  }

  return users
    .map((user) => {
      const totals = ordersByUser.get(user._id) ?? {
        details: [],
        receivableTotal: 0,
        payableTotal: 0,
      };
      const totalDebt = totals.receivableTotal - totals.payableTotal;
      const direction: DebtOverviewItem["direction"] =
        totalDebt > 0 ? "owed" : "owes_you";

      return {
        member_id: user._id,
        name: user.name,
        teams_email: user.teams_email ?? null,
        totalDebt,
        absTotal: Math.abs(totalDebt),
        direction,
        details: totals.details,
        receivableTotal: totals.receivableTotal,
        payableTotal: totals.payableTotal,
      };
    })
    .filter((userDebt) => userDebt.totalDebt !== 0)
    .sort((a, b) => b.totalDebt - a.totalDebt);
}

function formatDetails(details: number[]): string {
  return details
    .map((amount, index) => {
      const display = (Math.abs(amount) / 1000).toLocaleString("vi-VN");
      if (index === 0) return amount < 0 ? `−${display}` : display;
      const operator = amount < 0 ? "−" : "+";
      return `${operator} ${display}`;
    })
    .join(" ");
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
