import { describe, expect, it } from "vitest";
import { collectBeFoodReceipts, readBeFoodOrderPage, readBeFoodReceiptJson } from "../../shared/befood/api";
import { beFoodApiPath, beFoodAutoRange, beFoodBookmarkletUrl } from "./bookmarklet";

describe("beFood JSON", () => {
  it("reads delivered orders and the next page", () => {
    expect(readBeFoodOrderPage({ flag: 143, next_page: 2, data: [
      { order_id: 123, created_at: "2026-11-20 11:30:12", display_status: "Giao thành công" },
      { order_id: 124, created_at: "2026-11-19 11:30:12", display_status: "Đã hủy" },
    ] })).toEqual({ nextPage: 2, orders: [
      { order_id: "123", order_on: "2026-11-20", delivered: true },
      { order_id: "124", order_on: "2026-11-19", delivered: false },
    ] });
    expect(() => readBeFoodOrderPage({ code: 500 })).toThrow();
  });

  it("reconciles the total after fees, discount and BeCoin", () => {
    const order = { order_id: "123", order_on: "2026-11-20" };
    const data = {
      order_id: 123,
      restaurant: { name: "Quán mẫu" },
      restaurant_items: [{ item_name: "Cơm", item_quantity: 2, price: 100_000, unit_price: 50_000 }],
      sub_total: 100_000,
      delivery_fee: 18_000,
      extra_fee: 3_000,
      insurance: { fee: 1_000 },
      discount: 47_000,
      spending_coin: 6_000,
      total: 69_000,
    };
    expect(readBeFoodReceiptJson(order, { flag: 143, data })).toMatchObject({
      total_vnd: 69_000,
      items: [{ quantity: 2, name: "Cơm", amount: 100_000 }],
    });
    expect(() => readBeFoodReceiptJson(order, { flag: 143, data: { ...data, total: 70_000 } })).toThrow();
  });

  it("collects delivered orders in range across pages and reports unreadable ones", async () => {
    const detail = (order_id: number, total: number) => ({ flag: 143, data: {
      order_id, restaurant: { name: "Quán" }, restaurant_items: [{ item_name: "Cơm", item_quantity: 1, price: 50_000 }],
      sub_total: 50_000, total,
    } });
    const responses: Record<string, unknown> = {
      "/api/v1/orders?page=1": { flag: 143, next_page: 2, data: [
        { order_id: 3, created_at: "2026-11-21 11:00:00", display_status: "Giao thành công" },
        { order_id: 2, created_at: "2026-11-20 11:00:00", display_status: "Giao thành công" },
      ] },
      "/api/v1/orders?page=2": { flag: 143, next_page: 3, data: [
        { order_id: 1, created_at: "2026-11-10 11:00:00", display_status: "Giao thành công" },
      ] },
      "/api/v1/orders/2": detail(2, 50_000),
      "/api/v1/orders/3": detail(3, 99_000),
    };
    const read = async (path: string) => responses[path];
    await expect(collectBeFoodReceipts(read, { from: "2026-11-16", to: "2026-11-21" })).resolves.toMatchObject({
      receipts: [{ order_id: "2", total_vnd: 50_000 }],
      failed: ["3"],
    });
  });

  it("builds a bookmarklet that only proxies order endpoints", () => {
    const url = beFoodBookmarkletUrl("https://ledger.example");
    expect(url.startsWith("javascript:")).toBe(true);
    expect(() => new Function(decodeURIComponent(url.slice("javascript:".length)))).not.toThrow();
    expect(["/api/v1/orders?page=2", "/api/v1/orders/123"].every((path) => beFoodApiPath.test(path))).toBe(true);
    expect(["/api/v1/auth/me", "/api/v1/orders/1/cancel", "//evil.example"].some((path) => beFoodApiPath.test(path))).toBe(false);
  });
});

describe("beFood bookmarklet range", () => {
  // 2026-11-21 23:30 in Vietnam is still 21/11 there but 16:30 UTC.
  const now = new Date("2026-11-21T16:30:00Z");

  it("catches up from the newest saved order through today in Vietnam", () => {
    expect(beFoodAutoRange("2026-11-15", now)).toEqual({ from: "2026-11-15", to: "2026-11-21" });
  });

  it("reads the last 30 days when nothing is saved yet", () => {
    expect(beFoodAutoRange(null, now)).toEqual({ from: "2026-10-22", to: "2026-11-21" });
  });
});
