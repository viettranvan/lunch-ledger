import { useMutation, useQuery } from "convex/react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { InvoiceDatePicker } from "../../shared/components/DatePickers";
import { toast } from "../../shared/lib/toast";

const currency = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" });
const todayInVietnam = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
const displayDate = (date: string) => date.split("-").reverse().join("/");

export default function DraftsPage() {
  const [params, setParams] = useSearchParams();
  const date = params.get("date") ?? todayInVietnam();
  const data = useQuery(api.features.drafts.review.get, { date });
  const pendingDates = useQuery(api.features.drafts.review.pendingDates, {});
  const setLines = useMutation(api.features.drafts.review.setLines);
  const approve = useMutation(api.features.drafts.review.approve);

  const draft = data?.draft;
  const lines = draft?.lines ?? [];
  const isApproved = draft?.status === "approved";
  const memberName = new Map(data?.members.map((member) => [member._id, member.name]));
  const activeMembers = data?.members.filter((member) => member.is_active) ?? [];
  const canApprove = !isApproved && data?.receipts.some((receipt) => receipt.used) &&
    data.receipts.every((receipt) => !receipt.used || receipt.complete);

  async function saveLines(next: typeof lines) {
    try {
      await setLines({ date, lines: next });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không lưu được thay đổi.");
    }
  }

  async function runApprove() {
    try {
      const ids = await approve({ date });
      toast.success(`Đã tạo ${ids.length} hóa đơn cho ngày ${displayDate(date)}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không duyệt được bản nháp.");
    }
  }

  return (
    <div className="dashboard-grid">
      <section className="panel teams-settings-panel" aria-labelledby="drafts-heading">
        <h2 id="drafts-heading">Bản nháp hóa đơn ngày {displayDate(date)}</h2>
        <div className="grab-toolbar">
          <InvoiceDatePicker value={date} onChange={(next) => next && setParams({ date: next })} />
        </div>
        {pendingDates && pendingDates.length > 0 && (
          <nav className="receipt-sources draft-dates" aria-label="Ngày có bản nháp chờ duyệt">
            {pendingDates.map((pending) => (
              <Link key={pending} to={`/drafts?date=${pending}`} aria-current={pending === date ? "page" : undefined}>
                {displayDate(pending)}
              </Link>
            ))}
          </nav>
        )}

        {data === undefined ? (
          <p className="text-muted">Đang tải…</p>
        ) : !draft ? (
          <p className="text-muted">
            Chưa có bản nháp. Trong Claude Code hoặc Antigravity, mở repo Lunch Ledger và yêu cầu chạy skill
            {" "}<code>lunch-draft</code> cho ngày <code>{date}</code>.
            {data.receipts.length === 0 && " Ngày này cũng chưa có biên nhận beFood/Grab nào, hãy đồng bộ trước."}
          </p>
        ) : (
          <>
            <p className="text-muted" role="status">
              {isApproved
                ? `Đã duyệt thành ${draft.invoice_ids?.length ?? 0} hóa đơn.`
                : `Gửi lúc ${new Date(draft.submitted_at).toLocaleString("vi-VN")}. Dòng viền vàng là AI chưa chắc chắn.`}
            </p>
            <ul className="grab-receipt-list">
              {data.receipts.map((receipt) => (
                <li key={receipt.id} className="draft-receipt">
                  <h3>
                    {receipt.restaurant}{" "}
                    <span className="text-muted">
                      {receipt.source === "befood" ? "beFood" : "Grab"} ·{" "}
                      {receipt.total_vnd === undefined ? "chưa đọc được tổng" : currency.format(receipt.total_vnd)}
                    </span>
                  </h3>
                  <ul className="draft-items">
                    {receipt.items.map((item, itemIndex) => (
                      <li key={itemIndex}>
                        <div>
                          <strong>{item.quantity} × {item.name}</strong>
                          {receipt.remaining[itemIndex] !== 0 && (
                            <span className="draft-warning"> · còn {receipt.remaining[itemIndex]} phần chưa gán</span>
                          )}
                        </div>
                        <div className="draft-chips">
                          {lines.map((line, lineIndex) => line.receipt_id === receipt.id && line.item_index === itemIndex && (
                            <span key={lineIndex} className={`draft-chip${line.confidence === "low" ? " is-low" : ""}`} title={line.note}>
                              {memberName.get(line.member_id) ?? "?"}{line.quantity > 1 && ` ×${line.quantity}`}
                              {!isApproved && (
                                <button type="button" aria-label={`Bỏ ${memberName.get(line.member_id)} khỏi ${item.name}`}
                                  onClick={() => void saveLines(lines.filter((_, index) => index !== lineIndex))}>×</button>
                              )}
                            </span>
                          ))}
                          {!isApproved && receipt.remaining[itemIndex] > 0 && (
                            <select aria-label={`Gán thêm người cho ${item.name}`} value="" onChange={(event) => void saveLines([
                              ...lines,
                              { member_id: event.target.value as Id<"members">, receipt_id: receipt.id, item_index: itemIndex, quantity: 1, confidence: "high" },
                            ])}>
                              <option value="">+ Gán</option>
                              {activeMembers.map((member) => <option key={member._id} value={member._id}>{member.name}</option>)}
                            </select>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                  {receipt.shares.length > 0 && (
                    <dl className="grab-charges">
                      {receipt.shares.map((share) => (
                        <div key={share.member_id}>
                          <dt>{memberName.get(share.member_id)} <span className="text-muted">({currency.format(share.item_price)} giá món)</span></dt>
                          <dd>{share.amount === undefined ? "—" : currency.format(share.amount)}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </li>
              ))}
            </ul>
            {draft.unmatched.length > 0 && (
              <>
                <h3>Tin nhắn chưa khớp</h3>
                <ul className="draft-unmatched">
                  {draft.unmatched.map((message, index) => (
                    <li key={index}><strong>{message.author}:</strong> {message.text} <span className="text-muted">— {message.reason}</span></li>
                  ))}
                </ul>
              </>
            )}
            {!isApproved && (
              <div className="grab-toolbar">
                <button type="button" className="submit-btn small-btn" disabled={!canApprove} onClick={() => void runApprove()}>
                  Duyệt và tạo hóa đơn
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
