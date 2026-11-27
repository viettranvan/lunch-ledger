import { useState } from "react";
import { useAction, usePaginatedQuery, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { api } from "../../../../convex/_generated/api";
import { ReceiptDateRangePicker } from "../../../shared/components/DatePickers";

const dateTime = new Intl.DateTimeFormat("vi-VN", {
  timeZone: "Asia/Ho_Chi_Minh",
  dateStyle: "short",
  timeStyle: "short",
});

export default function TeamsOrdersPage() {
  const week = useQuery(api.features.grab.queries.defaultWeek, {});
  const [range, setRange] = useState<{ from: string; to: string }>();
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  const activeRange = range ?? week;
  const syncOrderHistory = useAction(api.integrations.teams.actions.syncOrderHistory);
  const { results, status, loadMore } = usePaginatedQuery(
    api.features.teams.history.list,
    activeRange ?? "skip",
    { initialNumItems: 10 },
  );

  async function sync() {
    if (!activeRange || isSyncing) return;
    setIsSyncing(true);
    setSyncMessage("");
    try {
      await syncOrderHistory(activeRange);
      setSyncMessage("Đã yêu cầu đồng bộ. Bài đăng sẽ xuất hiện khi Power Automate gửi dữ liệu về.");
    } catch (error) {
      setSyncMessage(error instanceof ConvexError && typeof error.data === "string"
        ? error.data
        : "Không khởi chạy được đồng bộ Teams.");
    } finally {
      setIsSyncing(false);
    }
  }

  return (
    <div className="dashboard-grid">
      <section className="panel teams-settings-panel" aria-label="Lịch sử đặt món trên Teams">
        <h2>Bài đăng và phản hồi</h2>
        <div className="grab-toolbar">
          {week && activeRange && (
            <ReceiptDateRangePicker value={activeRange} week={week} disabled={isSyncing} onChange={(dates) => {
              setRange(dates);
              setSyncMessage("");
            }} />
          )}
          <button type="button" className="submit-btn small-btn" disabled={!activeRange || isSyncing} onClick={() => void sync()}>
            {isSyncing ? "Đang gửi yêu cầu…" : "Đồng bộ Teams"}
          </button>
        </div>
        {syncMessage && <p className="text-muted" role="status">{syncMessage}</p>}
        {!activeRange || status === "LoadingFirstPage" ? (
          <p role="status" className="text-muted">Đang tải lịch sử Teams…</p>
        ) : results.length === 0 ? (
          <p className="text-muted">Chưa có bài đăng Teams trong khoảng ngày này.</p>
        ) : (
          <ul className="grab-receipt-list teams-order-threads">
            {results.map((thread) => (
              <li key={thread._id}>
                <details>
                  <summary>
                    <strong>{thread.post.authorName}</strong>
                    <span className="text-muted">{dateTime.format(Date.parse(thread.post.sentAt))}</span>
                    <span>{thread.replies.length}{thread.mayHaveMoreReplies ? "+" : ""} phản hồi</span>
                  </summary>
                  <p className="teams-order-text">{thread.post.text || "Bài đăng không có nội dung văn bản."}</p>
                  {thread.postUrl && <a href={thread.postUrl} target="_blank" rel="noreferrer">Mở bài đăng trên Teams</a>}
                  {thread.replies.length > 0 && (
                    <ol>
                      {thread.replies.map((reply) => (
                        <li key={reply.id}>
                          <strong>{reply.authorName}</strong>{" "}
                          <time className="text-muted" dateTime={reply.sentAt}>{dateTime.format(Date.parse(reply.sentAt))}</time>
                          <p className="teams-order-text">{reply.text || "Phản hồi không có nội dung văn bản."}</p>
                        </li>
                      ))}
                    </ol>
                  )}
                </details>
              </li>
            ))}
          </ul>
        )}
        {(status === "CanLoadMore" || status === "LoadingMore") && (
          <div className="grab-toolbar">
            <button type="button" className="teams-channel-option" disabled={status === "LoadingMore"} onClick={() => loadMore(10)}>
              {status === "LoadingMore" ? "Đang tải…" : "Xem thêm bài đăng"}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
