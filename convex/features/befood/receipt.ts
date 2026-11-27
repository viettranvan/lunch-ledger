import { ConvexError, v } from "convex/values";

export const beFoodReceipt = v.object({
  order_id: v.string(),
  order_on: v.string(),
  restaurant: v.string(),
  items: v.array(v.object({ quantity: v.number(), name: v.string(), amount: v.number() })),
  charges: v.array(v.object({ label: v.string(), amount: v.number() })),
  total_vnd: v.number(),
});

export function assertBeFoodReceipt(receipt: typeof beFoodReceipt.type) {
  const { order_id, order_on, restaurant, items, charges, total_vnd } = receipt;
  const date = new Date(order_on);
  const invalidDate = !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== order_on;
  const invalidItems = items.some(({ quantity, name, amount }) =>
    !Number.isSafeInteger(quantity) || quantity <= 0 || !name.trim() ||
    !Number.isSafeInteger(amount) || amount < 0,
  );
  const invalidCharges = charges.some(({ label, amount }) =>
    !label.trim() || !Number.isSafeInteger(amount),
  );
  const calculated = [...items, ...charges].reduce((sum, { amount }) => sum + amount, 0);
  if (!/^\d+$/.test(order_id) || invalidDate || !restaurant.trim() || !items.length ||
      invalidItems || invalidCharges || !Number.isSafeInteger(total_vnd) ||
      total_vnd < 0 || !Number.isSafeInteger(calculated)) {
    throw new ConvexError("Chi tiết đơn beFood thiếu dữ liệu hoặc có số tiền không hợp lệ.");
  }
}
