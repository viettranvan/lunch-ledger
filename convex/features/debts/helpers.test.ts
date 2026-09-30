import { describe, expect, it } from "vitest";
import type { Doc, Id } from "../../_generated/dataModel";
import {
  aggregateUserDebts,
  toTeamsDebtPayload,
  type DebtLedgerOrder,
} from "./helpers";

function makeUser(
  id: string,
  name: string,
  teams_email?: string,
): Doc<"users"> {
  return {
    _id: id as Id<"users">,
    _creationTime: 0,
    name,
    is_active: true,
    teams_email,
  };
}

function makeOrder(
  userId: string,
  actualPrice: number,
  invoice_type: "receivable" | "payable" = "receivable",
): DebtLedgerOrder {
  return {
    user_id: userId as Id<"users">,
    actual_price: actualPrice,
    invoice_type,
  };
}

describe("aggregateUserDebts", () => {
  it("nets receivables and payables by member and excludes zero balances", () => {
    const debts = aggregateUserDebts(
      [
        makeUser("u1", "An", "an@example.com"),
        makeUser("u2", "Bình"),
        makeUser("u3", "Chi"),
        makeUser("u4", "Dũng"),
      ],
      [
        makeOrder("u1", 50_000),
        makeOrder("u1", 20_000, "payable"),
        makeOrder("u2", 10_000),
        makeOrder("u3", 40_000, "payable"),
        makeOrder("u4", 20_000),
        makeOrder("u4", 20_000, "payable"),
      ],
    );

    expect(debts).toEqual([
      {
        user_id: "u1",
        name: "An",
        teams_email: "an@example.com",
        totalDebt: 30_000,
        absTotal: 30_000,
        direction: "owed",
        details: [50_000, -20_000],
        receivableTotal: 50_000,
        payableTotal: 20_000,
      },
      {
        user_id: "u2",
        name: "Bình",
        teams_email: null,
        totalDebt: 10_000,
        absTotal: 10_000,
        direction: "owed",
        details: [10_000],
        receivableTotal: 10_000,
        payableTotal: 0,
      },
      {
        user_id: "u3",
        name: "Chi",
        teams_email: null,
        totalDebt: -40_000,
        absTotal: 40_000,
        direction: "owes_you",
        details: [-40_000],
        receivableTotal: 0,
        payableTotal: 40_000,
      },
    ]);
  });

  it("returns no debt rows for users without unpaid orders", () => {
    expect(aggregateUserDebts([makeUser("u1", "An")], [])).toEqual([]);
  });

  it("creates the owed-only Teams payload and preserves missing emails", () => {
    const debts = aggregateUserDebts(
      [makeUser("u1", "An", "an@example.com"), makeUser("u2", "Bình")],
      [
        makeOrder("u1", 50_000),
        makeOrder("u1", 20_000, "payable"),
        makeOrder("u2", 30_000),
      ],
    );

    expect(toTeamsDebtPayload(debts)).toEqual([
      {
        name: "An",
        email: "an@example.com",
        amount: 30_000,
        formatted_total: "30.000đ",
        details: "50 − 20",
        line: "50 − 20 = 30.000đ",
        direction: "owed",
      },
      {
        name: "Bình",
        email: null,
        amount: 30_000,
        formatted_total: "30.000đ",
        details: "30",
        line: "30 = 30.000đ",
        direction: "owed",
      },
    ]);
  });
});
