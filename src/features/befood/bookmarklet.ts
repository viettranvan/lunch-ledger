import { beFoodOrigin } from "../../shared/befood/api";

type FetchRequest = { source: "lunch-ledger"; kind: "befood-fetch"; id: string; path: string };
type FetchReply = { source: "lunch-ledger-befood"; kind: "befood-json"; id: string; status: number; json: unknown };

export const beFoodApiPath = /^\/api\/v1\/orders(?:\?page=\d+|\/\d+)$/;

// Runs inside the beFood tab, so it must stay self-contained (it is stringified into the bookmark).
// It only proxies read-only order endpoints, and only for the Lunch Ledger origin it was built for.
function bookmarklet(ledgerOrigin: string, beFood: string, allowedPath: RegExp) {
  if (location.origin !== beFood) {
    alert("Mở food.be.com.vn, đăng nhập rồi bấm lại dấu trang Lunch Ledger · beFood.");
    return;
  }
  // Open synchronously inside the click so popup blockers allow it.
  if (!window.open(`${ledgerOrigin}/receipts?source=befood&via=bookmarklet`, "lunch-ledger-befood")) {
    alert("Trình duyệt đã chặn cửa sổ Lunch Ledger. Cho phép mở cửa sổ cho food.be.com.vn rồi bấm lại.");
    return;
  }
  const flag = "__lunchLedgerBeFood";
  const page = window as unknown as Record<string, boolean>;
  if (page[flag]) return;
  page[flag] = true;
  window.addEventListener("message", async (event: MessageEvent<FetchRequest>) => {
    const request = event.data;
    if (event.origin !== ledgerOrigin || !event.source || request?.source !== "lunch-ledger" ||
        request.kind !== "befood-fetch" || typeof request.path !== "string" || !allowedPath.test(request.path)) return;
    let status = 0;
    let json: unknown = null;
    try {
      const response = await fetch(request.path, { cache: "no-store" });
      status = response.status;
      json = await response.json().catch(() => null);
    } catch { /* status 0 reports a network failure */ }
    (event.source as Window).postMessage(
      { source: "lunch-ledger-befood", kind: "befood-json", id: request.id, status, json } satisfies FetchReply,
      ledgerOrigin,
    );
  });
}

export function beFoodBookmarkletUrl(ledgerOrigin: string) {
  const args = [JSON.stringify(ledgerOrigin), JSON.stringify(beFoodOrigin), beFoodApiPath.toString()].join(",");
  return `javascript:${encodeURIComponent(`(${bookmarklet.toString()})(${args});void 0`)}`;
}

/** Range a bookmarklet click syncs: from the newest saved order (or 30 days back) through today in Vietnam. */
export function beFoodAutoRange(lastOrderOn: string | null, now = new Date()) {
  const to = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(now);
  const from = lastOrderOn && lastOrderOn <= to
    ? lastOrderOn
    : new Date(Date.parse(to) - 30 * 86_400_000).toISOString().slice(0, 10);
  return { from, to };
}

/** The beFood tab that opened this window through the bookmarklet, if it is still there. */
export function beFoodOpener() {
  const params = new URLSearchParams(window.location.search);
  return params.get("via") === "bookmarklet" && window.opener && !window.opener.closed
    ? window.opener as Window
    : null;
}

export function readThroughBeFoodTab(beFoodTab: Window) {
  return (path: string) => new Promise<unknown>((resolve, reject) => {
    const id = crypto.randomUUID();
    const finish = () => {
      window.clearTimeout(timeout);
      window.removeEventListener("message", receive);
    };
    const receive = (event: MessageEvent<FetchReply>) => {
      const reply = event.data;
      if (event.origin !== beFoodOrigin || event.source !== beFoodTab ||
          reply?.source !== "lunch-ledger-befood" || reply.id !== id) return;
      finish();
      if (reply.status === 401 || reply.status === 403) {
        reject(new Error("Phiên beFood đã hết hạn. Đăng nhập lại trên tab beFood rồi bấm dấu trang lần nữa."));
      } else if (reply.status !== 200 || reply.json === null) {
        reject(new Error(`Không đọc được phản hồi JSON từ beFood (HTTP ${reply.status}).`));
      } else {
        resolve(reply.json);
      }
    };
    const timeout = window.setTimeout(() => {
      finish();
      reject(new Error("Tab beFood không phản hồi. Mở lại tab beFood và bấm dấu trang Lunch Ledger · beFood."));
    }, 20_000);
    window.addEventListener("message", receive);
    beFoodTab.postMessage({ source: "lunch-ledger", kind: "befood-fetch", id, path } satisfies FetchRequest, beFoodOrigin);
  });
}
