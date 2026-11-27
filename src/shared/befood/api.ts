import { assertBeFoodReceipt, type beFoodReceipt } from "../../../convex/features/befood/receipt";

export const beFoodOrigin = "https://food.be.com.vn";
export type BeFoodOrder = { order_id: string; order_on: string };
export type BeFoodReceipt = typeof beFoodReceipt.type;
export type BeFoodSyncResult = { receipts: BeFoodReceipt[]; failed: string[] };

type JsonObject = Record<string, unknown>;

function object(value: unknown): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Phản hồi beFood thiếu dữ liệu đối tượng.");
  }
  return value as JsonObject;
}

function text(value: unknown) {
  if (typeof value !== "string" || !value.trim()) throw new Error("Phản hồi beFood thiếu dữ liệu văn bản.");
  return value.trim();
}

function amount(value: unknown) {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error("Số tiền trong phản hồi beFood không hợp lệ.");
  }
  return value;
}

function orderId(value: unknown) {
  const id = typeof value === "number" && Number.isSafeInteger(value) ? String(value) : text(value);
  if (!/^\d+$/.test(id)) throw new Error("Mã đơn beFood không hợp lệ.");
  return id;
}

function payload(response: unknown) {
  const body = object(response);
  if (body.flag !== 143) throw new Error("beFood không trả dữ liệu đơn. Kiểm tra phiên đăng nhập beFood.");
  return body;
}

export function readBeFoodOrderPage(response: unknown) {
  const { data, next_page } = payload(response);
  if (!Array.isArray(data)) throw new Error("Không đọc được danh sách đơn từ API beFood.");
  if (next_page != null && next_page !== 0 &&
      (typeof next_page !== "number" || !Number.isSafeInteger(next_page) || next_page < 1)) {
    throw new Error("Thông tin phân trang beFood không hợp lệ.");
  }
  const orders = data.map((entry) => {
    const order = object(entry);
    const order_on = text(order.created_at).match(/^\d{4}-\d{2}-\d{2}(?=[ T]|$)/)?.[0];
    if (!order_on) throw new Error("Không đọc được ngày đặt đơn từ API beFood.");
    return {
      order_id: orderId(order.order_id),
      order_on,
      delivered: typeof order.display_status === "string" && order.display_status.trim() === "Giao thành công",
    };
  });
  return { orders, nextPage: typeof next_page === "number" && next_page > 0 ? next_page : null };
}

export function readBeFoodReceiptJson(order: BeFoodOrder, response: unknown): BeFoodReceipt {
  const detail = object(payload(response).data);
  if (orderId(detail.order_id) !== order.order_id || !Array.isArray(detail.restaurant_items)) {
    throw new Error("API beFood trả thông tin không khớp mã đơn.");
  }
  const items = detail.restaurant_items.map((entry) => {
    const item = object(entry);
    const name = text(item.item_name);
    const options = typeof item.display_customize_item === "string" ? item.display_customize_item.trim() : "";
    return {
      quantity: amount(item.item_quantity),
      name: options ? `${name} · ${options}` : name,
      amount: amount(item.price),
    };
  });
  const subtotal = amount(detail.sub_total);
  if (items.reduce((sum, item) => sum + item.amount, 0) !== subtotal) {
    throw new Error("Không đối chiếu được tạm tính của đơn beFood.");
  }

  const insurance = detail.insurance == null ? undefined : object(detail.insurance);
  const fees: Array<[string, unknown]> = [
    ["Cước giao hàng", detail.delivery_fee],
    ["Phí dịch vụ", detail.extra_fee],
    ["Phí giao tận cửa", detail.doorstep_delivery_fee],
    ["Phụ phí nhiên liệu", detail.fuel_fee],
    ["Phí cầu đường", detail.toll_charge],
    ["Phí đỗ xe", detail.parking_fee],
    ["Bảo hiểm", insurance?.fee],
    ["Tiền tip", detail.total_tip_amount ?? detail.pretip_amount],
  ];
  const deductions: Array<[string, unknown]> = [
    ["Giảm giá", detail.discount],
    ["BeCoin đã dùng", detail.spending_coin],
    ["Điểm Be đã dùng", detail.be_point_amount],
  ];
  const charges = [
    ...fees.map(([label, value]) => ({ label, amount: amount(value ?? 0) })),
    ...deductions.map(([label, value]) => ({ label, amount: -amount(value ?? 0) })),
  ].filter((charge) => charge.amount !== 0);

  const receipt = {
    ...order,
    restaurant: text(object(detail.restaurant).name),
    items,
    charges,
    total_vnd: amount(detail.total),
  };
  if (subtotal + charges.reduce((sum, charge) => sum + charge.amount, 0) !== receipt.total_vnd) {
    throw new Error("Không đối chiếu được tổng tiền của đơn beFood.");
  }
  assertBeFoodReceipt(receipt);
  return receipt;
}

/** Reads delivered orders in [from, to] through any same-origin reader of beFood's JSON API. */
export async function collectBeFoodReceipts(
  readJson: (path: string) => Promise<unknown>,
  { from, to }: { from: string; to: string },
): Promise<BeFoodSyncResult> {
  const orders = new Map<string, BeFoodOrder>();
  const seen = new Set<number>();
  let pageNumber: number | null = 1;
  while (pageNumber !== null) {
    if (seen.has(pageNumber)) throw new Error("API beFood trả trang lịch sử lặp lại.");
    seen.add(pageNumber);
    const { orders: batch, nextPage } = readBeFoodOrderPage(await readJson(`/api/v1/orders?page=${pageNumber}`));
    for (const { order_id, order_on, delivered } of batch) {
      if (delivered && order_on >= from && order_on <= to) orders.set(order_id, { order_id, order_on });
    }
    if (batch.length > 0 && batch.every((order) => order.order_on < from)) break;
    pageNumber = nextPage;
  }
  const receipts: BeFoodReceipt[] = [];
  const failed: string[] = [];
  for (const order of orders.values()) {
    try {
      receipts.push(readBeFoodReceiptJson(order, await readJson(`/api/v1/orders/${order.order_id}`)));
    } catch {
      failed.push(order.order_id);
    }
  }
  return { receipts, failed };
}
