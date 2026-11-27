import { describe, expect, it } from "vitest";
import { parseGrabReceipt } from "./parse";

describe("parseGrabReceipt", () => {
  it("reads a GrabFood receipt total and restaurant", () => {
    const parsed = parseGrabReceipt({
      subject: "Your Grab e-receipt",
      orderOn: "2026-11-20",
      body: `
        <p>GrabFood order from Phở Quỳnh</p>
        <p>2026-11-20</p>
        <p>Total 150.000đ</p>
      `,
    });

    expect(parsed).toMatchObject({
      orderOn: "2026-11-20",
      restaurant: "Phở Quỳnh",
      totalVnd: 150000,
    });
  });

  it("ignores Grab mail that is not a receipt", () => {
    expect(
      parseGrabReceipt({
        subject: "Nâng cấp GrabUnlimited",
        orderOn: "2026-11-20",
        body: "Giảm 50% cho đơn hàng GrabFood tiếp theo",
      }),
    ).toBeNull();
  });

  it("reads Vietnamese receipt lines, fees and discounts from previously saved mail", () => {
    const parsed = parseGrabReceipt({
      subject: "Your Grab E-Receipt",
      orderOn: "2026-11-20",
      normalized: true,
      body: [
        "Tổng cộng", "115000₫", "CHI TIẾT ĐƠN HÀNG", "Đặt từ", "Quán mẫu",
        "HÓA ĐƠN CỦA BẠN", "Số lượng:", "2x", "Cơm gà", "100000₫",
        "Ghi chú cho món", "1x", "Trứng", "15000₫",
        "Tổng tạm tính", "115000₫", "Cước phí giao hàng", "6000₫",
        "Mã giảm giá", "- 6000₫", "BẠN TRẢ", "115000₫",
      ].join("\n"),
    });
    expect(parsed).toMatchObject({
      restaurant: "Quán mẫu",
      totalVnd: 115000,
      items: [
        { quantity: 2, name: "Cơm gà", amount: 100000 },
        { quantity: 1, name: "Trứng", amount: 15000 },
      ],
      charges: [
        { label: "Tổng tạm tính", amount: 115000 },
        { label: "Cước phí giao hàng", amount: 6000 },
        { label: "Mã giảm giá", amount: -6000 },
      ],
    });
  });
});
