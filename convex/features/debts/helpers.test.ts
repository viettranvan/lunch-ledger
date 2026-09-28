import { describe, expect, it } from "vitest";
import type { Doc, Id } from "../../_generated/dataModel";
import {
  aggregateUserDebts,
  toTeamsDebtPayload,
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

function makeOrder(userId: string, actualPrice: number): Doc<"orderers"> {
  return {
    _id: `order-${userId}-${actualPrice}` as Id<"orderers">,
    _creationTime: 0,
    user_id: userId as Id<"users">,
    invoice_id: "invoice" as Id<"invoices">,
    item_price: actualPrice,
    actual_price: actualPrice,
    is_paid: false,
    percentage: 0,
  };
}

describe("aggregateUserDebts", () => {
  it("aggregates positive and negative balances and excludes zero balances", () => {
    const debts = aggregateUserDebts(
      [
        makeUser("u1", "An", "an@example.com"),
        makeUser("u2", "Bình"),
        makeUser("u3", "Chi"),
      ],
      [
        makeOrder("u1", 50_000),
        makeOrder("u1", 10_000),
        makeOrder("u2", -20_000),
        makeOrder("u3", 30_000),
        makeOrder("u3", -30_000),
      ],
    );

    expect(debts).toEqual([
      {
        user_id: "u1",
        name: "An",
        teams_email: "an@example.com",
        totalDebt: 60_000,
        absTotal: 60_000,
        direction: "owed",
        details: [50_000, 10_000],
      },
      {
        user_id: "u2",
        name: "Bình",
        teams_email: null,
        totalDebt: -20_000,
        absTotal: 20_000,
        direction: "owes_you",
        details: [-20_000],
      },
    ]);
  });

  it("returns no debt rows for users without unpaid orders", () => {
    expect(aggregateUserDebts([makeUser("u1", "An")], [])).toEqual([]);
  });

  it("creates the owed-only Teams payload and preserves missing emails", () => {
    const debts = aggregateUserDebts(
      [makeUser("u1", "An", "an@example.com"), makeUser("u2", "Bình")],
      [makeOrder("u1", 50_000), makeOrder("u2", 30_000)],
    );

    expect(toTeamsDebtPayload(debts)).toEqual([
      {
        name: "An",
        email: "an@example.com",
        amount: 50_000,
        formatted_total: "50.000đ",
        details: "50",
        line: "50 = 50.000đ",
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
