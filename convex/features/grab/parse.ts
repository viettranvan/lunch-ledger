export type ParsedGrabReceipt = {
  orderOn: string;
  restaurant?: string;
  totalVnd?: number;
  bodyText: string;
  items: { name: string; quantity: number; amount: number }[];
  charges: { label: string; amount: number }[];
};

const RECEIPT_SUBJECT = /\b(?:grab e-?receipt|grabfood receipt)\b|biên nhận.*grab|grab.*biên nhận/i;
const TOTAL_HINT = /(?:^|\n)\s*(?:total|tổng cộng|tổng thanh toán|thành tiền)\s*[:-]?\s*([0-9][0-9.,]*)/i;

function htmlToText(value: string) {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function vnd(raw: string) {
  const amount = Number(raw.replace(/[^\d]/g, ""));
  return Number.isSafeInteger(amount) && amount > 0 ? amount : undefined;
}

function orderOnFrom(text: string, fallback: string) {
  const match = text.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  if (!match) return fallback;
  const [, year, month, day] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function foodDetails(text: string) {
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  const order = lines.findIndex((line) => /^(chi tiết đơn hàng|order details)$/i.test(line));
  const restaurant = order < 0 ? -1 : lines.findIndex(
    (line, index) => index > order && /^(đặt từ|ordered from|merchant)$/i.test(line),
  );
  const quantity = lines.findIndex((line) => /^(số lượng|quantity):?$/i.test(line));
  const subtotal = lines.findIndex((line) => /^(tổng tạm tính|subtotal)$/i.test(line));
  const paid = lines.findIndex((line) => /^(bạn trả|you paid)$/i.test(line));
  const items: ParsedGrabReceipt["items"] = [];
  const charges: ParsedGrabReceipt["charges"] = [];
  const money = /^(-\s*)?([\d.,]+)\s*(?:₫|đ|VND)$/i;

  if (quantity >= 0 && subtotal > quantity) {
    for (let index = quantity + 1; index + 2 < subtotal; index++) {
      const count = lines[index].match(/^(\d+)\s*[x×]$/i);
      const amount = lines[index + 2].match(money);
      if (count && amount && !amount[1]) {
        const value = vnd(amount[2]);
        if (value !== undefined) items.push({ quantity: Number(count[1]), name: lines[index + 1], amount: value });
      }
    }
  }
  if (subtotal >= 0 && paid > subtotal) {
    for (let index = subtotal; index < paid; index += 2) {
      const amount = lines[index + 1]?.match(money);
      if (!amount) break;
      const value = vnd(amount[2]);
      if (value !== undefined) {
        charges.push({ label: lines[index], amount: amount[1] ? -value : value });
      }
    }
  }

  return { restaurant: restaurant < 0 ? undefined : lines[restaurant + 1], items, charges };
}

export function parseGrabReceipt(input: {
  subject: string;
  body: string;
  orderOn: string;
  normalized?: boolean;
}): ParsedGrabReceipt | null {
  if (!RECEIPT_SUBJECT.test(input.subject.trim())) return null;
  const bodyText = (input.normalized ? input.body : htmlToText(input.body)).slice(0, 20_000);
  const haystack = `${input.subject}\n${bodyText}`;
  const details = foodDetails(bodyText);
  if (!details.restaurant && !/(?:grabfood|chúc bạn ngon miệng)/i.test(bodyText)) return null;

  const totalMatch = haystack.match(TOTAL_HINT);
  const restaurantMatch = haystack.match(
    /(?:order from|from restaurant|từ quán|quán)\s*[:-]?\s*([^\n]{2,80})/i,
  );

  return {
    ...details,
    orderOn: orderOnFrom(haystack, input.orderOn),
    restaurant: details.restaurant ?? restaurantMatch?.[1]?.trim(),
    totalVnd: totalMatch ? vnd(totalMatch[1]) : undefined,
    bodyText,
  };
}
