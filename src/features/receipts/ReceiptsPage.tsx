import { useEffect, useRef, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../../../convex/_generated/api";
import { beFoodOrigin, collectBeFoodReceipts, type BeFoodSyncResult } from "../../shared/befood/api";
import { beFoodAutoRange, beFoodBookmarkletUrl, beFoodOpener, readThroughBeFoodTab } from "../befood/bookmarklet";
import { ReceiptDateRangePicker } from "../../shared/components/DatePickers";
import { toast } from "../../shared/lib/toast";

const currency = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" });
type DateRange = { from: string; to: string };

export default function ReceiptsPage() {
  const [params] = useSearchParams();
  const isBeFood = params.get("source") === "befood";
  const sourceLabel = isBeFood ? "beFood" : "Grab";
  const week = useQuery(api.features.grab.queries.defaultWeek, {});
  const [range, setRange] = useState<DateRange>();
  const [isSyncing, setIsSyncing] = useState(false);
  const [status, setStatus] = useState("");
  const activeRange = range ?? week;
  const grabReceipts = useQuery(api.features.grab.queries.list, isBeFood ? "skip" : activeRange ?? "skip");
  const beFoodReceipts = useQuery(api.features.befood.receipts.list, isBeFood ? activeRange ?? "skip" : "skip");
  const receipts = isBeFood ? beFoodReceipts : grabReceipts;
  const syncGrab = useAction(api.features.grab.actions.sync);
  const save = useMutation(api.features.befood.receipts.save);
  const lastOrderOn = useQuery(api.features.befood.receipts.lastOrderOn, isBeFood ? {} : "skip");
  const autoSynced = useRef(false);

  async function runGrabSync() {
    if (!activeRange) return;
    setIsSyncing(true);
    try {
      const result = await syncGrab(activeRange);
      toast.success(`Đã lưu ${result.saved} biên nhận Grab, bỏ qua ${result.skipped} thư khác.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không lấy được biên nhận Grab.");
    } finally {
      setIsSyncing(false);
    }
  }

  async function syncBeFood(syncRange = activeRange) {
    if (!syncRange) return;
    const beFoodTab = beFoodOpener();
    if (!beFoodTab) {
      window.open(`${beFoodOrigin}/orders`, "_blank", "noopener");
      setStatus("Trên tab beFood vừa mở, đăng nhập nếu cần rồi bấm dấu trang Lunch Ledger · beFood.");
      return;
    }
    setIsSyncing(true);
    setStatus("Đang đọc đơn từ tab beFood…");
    try {
      await saveResult(await collectBeFoodReceipts(readThroughBeFoodTab(beFoodTab), syncRange));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Không đồng bộ được beFood.");
      setIsSyncing(false);
    }
  }

  // Opened by the bookmarklet: catch up from the newest saved order through today, no extra click.
  useEffect(() => {
    if (!isBeFood || lastOrderOn === undefined || autoSynced.current || !beFoodOpener()) return;
    autoSynced.current = true;
    const syncRange = beFoodAutoRange(lastOrderOn);
    setRange(syncRange);
    void syncBeFood(syncRange);
  });

  async function saveResult(result: BeFoodSyncResult) {
    setIsSyncing(true);
    let saved = 0;
    try {
      for (let index = 0; index < result.receipts.length; index += 50) {
        const batch = result.receipts.slice(index, index + 50);
        await save({ receipts: batch });
        saved += batch.length;
      }
      setStatus(result.failed.length
        ? `Đã lưu ${saved} đơn. Chưa đọc được đơn: ${result.failed.join(", ")}.`
        : saved ? `Đã đồng bộ ${saved} đơn beFood.` : "Không có đơn đã giao trong khoảng ngày này.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Không đồng bộ được beFood.";
      setStatus(saved ? `Đã lưu ${saved} đơn trước khi gặp lỗi. ${message}` : message);
      toast.error(message);
    } finally {
      setIsSyncing(false);
    }
  }

  return (
    <div className="dashboard-grid">
      <section className="panel teams-settings-panel" aria-labelledby="receipt-heading">
        <h2 id="receipt-heading">Biên nhận đặt món</h2>
        <nav className="receipt-sources" aria-label="Nguồn biên nhận">
          <Link to="/receipts" aria-current={!isBeFood ? "page" : undefined}>Grab</Link>
          <Link to="/receipts?source=befood" aria-current={isBeFood ? "page" : undefined}>beFood</Link>
        </nav>
        <div className="grab-toolbar">
          {activeRange && week && (
            <ReceiptDateRangePicker
              value={activeRange}
              week={week}
              disabled={isSyncing}
              onChange={(nextRange) => { setRange(nextRange); setStatus(""); }}
            />
          )}
          <button
            type="button"
            className="submit-btn small-btn"
            disabled={isSyncing || !activeRange}
            onClick={() => void (isBeFood ? syncBeFood() : runGrabSync())}
          >
            {isSyncing ? "Đang xử lý…" : `Đồng bộ ${sourceLabel}`}
          </button>
        </div>
        {isBeFood && status && <p className="text-muted" role="status">{status}</p>}
        {isBeFood && (
          <p className="text-muted">
            Kéo nút{" "}
            {/* React blocks javascript: hrefs in JSX, so the bookmark URL is set on the element directly. */}
            <a className="befood-bookmarklet" ref={(link) => link?.setAttribute("href", beFoodBookmarkletUrl(window.location.origin))}
              onClick={(event) => event.preventDefault()}>
              Lunch Ledger · beFood
            </a>{" "}
            lên thanh dấu trang. Khi cần đồng bộ, mở beFood và bấm dấu trang này. Lunch Ledger tự đọc và lưu các đơn từ ngày của đơn mới nhất đã lưu đến hôm nay (lần đầu: 30 ngày gần nhất). Muốn lấy khoảng khác, chọn ngày trong cửa sổ đó rồi bấm Đồng bộ beFood.
          </p>
        )}
        {receipts === undefined ? (
          <p className="text-muted">Đang tải biên nhận đã lưu…</p>
        ) : receipts.length === 0 ? (
          <p className="text-muted">Chưa có biên nhận {sourceLabel} trong khoảng này.</p>
        ) : (
          <ul className="grab-receipt-list">
            {receipts.map((receipt) => (
              <li key={receipt._id}>
                <details>
                  <summary>
                    <strong>{receipt.restaurant ?? ("subject" in receipt ? receipt.subject : "Biên nhận")}</strong>
                    <span className="text-muted">{receipt.order_on.split("-").reverse().join("/")}</span>
                    <span>{receipt.total_vnd === undefined ? "Chưa đọc được tổng" : currency.format(receipt.total_vnd)}</span>
                  </summary>
                  {"order_id" in receipt && <p className="text-muted">Mã đơn {receipt.order_id}</p>}
                  {receipt.items.length ? <dl>
                    {receipt.items.map((item, index) => (
                      <div key={index}>
                        <dt>{item.quantity} × {item.name}</dt>
                        <dd>{currency.format(item.amount)}</dd>
                      </div>
                    ))}
                  </dl> : <p className="text-muted">Chưa trích xuất được các món từ biên nhận này.</p>}
                  {receipt.charges.length > 0 && (
                    <dl className="grab-charges">
                      {receipt.charges.map((charge, index) => (
                        <div key={index}>
                          <dt>{charge.label}</dt>
                          <dd>{currency.format(charge.amount)}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                  {"difference_vnd" in receipt && receipt.difference_vnd !== 0 && (
                    <p className="text-muted">
                      Chênh lệch so với các dòng Be hiển thị {currency.format(receipt.difference_vnd)}
                    </p>
                  )}
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
