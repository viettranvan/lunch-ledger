export type ProportionalAllocation = {
  amount: number;
  percentage: number;
};

/** Split an invoice in proportion to item prices, assigning rounding remainder by largest fraction. */
export function allocateProportionally(
  totalAmount: number,
  weights: number[],
): ProportionalAllocation[] {
  if (!Number.isSafeInteger(totalAmount) || totalAmount < 0) {
    throw new Error("Tổng hóa đơn phải là số nguyên không âm.");
  }
  if (weights.length === 0 || weights.some((weight) => !Number.isFinite(weight) || weight <= 0)) {
    throw new Error("Cần ít nhất một giá món hợp lệ để phân bổ.");
  }

  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);
  if (!Number.isFinite(weightTotal) || weightTotal <= 0) {
    throw new Error("Tổng giá món không hợp lệ.");
  }

  const shares = weights.map((weight) => {
    const ratio = weight / weightTotal;
    const exactAmount = ratio * totalAmount;
    const amount = Math.floor(exactAmount);
    return {
      amount,
      percentage: ratio * 100,
      remainder: exactAmount - amount,
    };
  });

  const remaining = totalAmount - shares.reduce((sum, share) => sum + share.amount, 0);
  if (!Number.isSafeInteger(remaining) || remaining < 0 || remaining > shares.length) {
    throw new Error("Không thể phân bổ chính xác tổng hóa đơn.");
  }

  const remainderOrder = shares
    .map((share, index) => ({ index, remainder: share.remainder }))
    .sort((left, right) => right.remainder - left.remainder || left.index - right.index);

  for (let index = 0; index < remaining; index += 1) {
    shares[remainderOrder[index].index].amount += 1;
  }

  return shares.map(({ amount, percentage }) => ({ amount, percentage }));
}
