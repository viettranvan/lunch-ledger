import { describe, expect, it } from "vitest";
import { computeInvoiceStatus } from "./helpers";

describe("computeInvoiceStatus", () => {
  it("returns empty when an invoice has no orders", () => {
    expect(computeInvoiceStatus(0, 0)).toBe("empty");
  });

  it("returns unpaid when no orders are paid", () => {
    expect(computeInvoiceStatus(3, 0)).toBe("unpaid");
  });

  it("returns partial when only some orders are paid", () => {
    expect(computeInvoiceStatus(3, 1)).toBe("partial");
  });

  it("returns completed when all orders are paid", () => {
    expect(computeInvoiceStatus(3, 3)).toBe("completed");
  });
});
