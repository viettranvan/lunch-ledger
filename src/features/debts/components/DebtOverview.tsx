import { useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import Modal from "../../../shared/components/Modal";
import ConfirmDialog from "../../../shared/components/ConfirmDialog";
import { toast } from "../../../shared/lib/toast";

function formatDebtDetails(details: number[]) {
  return details
    .map((amount, index) => {
      const display = (Math.abs(amount) / 1000).toLocaleString("vi-VN");
      if (index === 0) return amount < 0 ? `−${display}` : display;
      return `${amount < 0 ? "−" : "+"} ${display}`;
    })
    .join(" ");
}

export default function DebtOverview() {
  const isEditor = useQuery(api.auth.isEditorQuery) === true;
  const debts = useQuery(api.features.debts.queries.getDebtOverview);
  const teamsConfig = useQuery(api.features.teams.queries.get, isEditor ? {} : "skip");
  const sendDebtReminder = useAction(
    api.integrations.teams.actions.sendDebtReminder,
  );
  const settleUserBalance = useMutation(
    api.features.orders.mutations.settleUserBalance,
  );
  const [sendingTeams, setSendingTeams] = useState(false);
  const [settlingUserId, setSettlingUserId] = useState<Id<"members"> | null>(null);
  const [isSettling, setIsSettling] = useState(false);
  const [isTeamsPreviewOpen, setIsTeamsPreviewOpen] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<Id<"invoices"> | null>(null);
  const [selectedDebtUserId, setSelectedDebtUserId] = useState<Id<"members"> | null>(null);
  const selectedInvoice = useQuery(
    api.features.invoices.queries.getById,
    selectedInvoiceId ? { id: selectedInvoiceId } : "skip",
  );
  const selectedInvoiceOrders = useQuery(
    api.features.orders.queries.getByInvoice,
    selectedInvoiceId ? { invoice_id: selectedInvoiceId } : "skip",
  );
  const debtToSettle = settlingUserId
    ? debts?.find((debt) => debt.member_id === settlingUserId) ?? null
    : null;

  const closeInvoiceModal = () => {
    setSelectedInvoiceId(null);
    setSelectedDebtUserId(null);
  };

  const handleConfirmSendToTeams = async () => {
    setIsTeamsPreviewOpen(false);
    setSendingTeams(true);
    try {
      const result = await sendDebtReminder();
      if (!result.sent) {
        if (result.reason === "no_debts") {
          toast.info("Không có khoản phải thu cần nhắc.");
        } else if (result.reason === "no_emails") {
          toast.warning(
            "Không gửi được — chưa có Teams email nào. Thêm email ở mục Thành viên.",
          );
        }
        return;
      }

      const skippedMembers = result.missingEmail?.length
        ? ` (Bỏ qua: ${result.missingEmail.join(", ")})`
        : "";
      toast.success(
        `Đã gửi nhắc nợ cho ${result.count} người vào Teams.${skippedMembers}`,
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gửi Teams thất bại.",
      );
    } finally {
      setSendingTeams(false);
    }
  };

  const handleConfirmSettleUser = async () => {
    if (!debtToSettle) return;

    setIsSettling(true);
    try {
      const result = await settleUserBalance({
        member_id: debtToSettle.member_id,
        expected_net_amount: debtToSettle.totalDebt,
      });
      setSettlingUserId(null);
      toast.success(
        `Đã đối soát với ${debtToSettle.name}: ${Math.abs(result.net_amount).toLocaleString("vi-VN")}đ qua ${result.affected_invoice_count} hóa đơn.`,
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Không thể đối soát số dư.",
      );
    } finally {
      setIsSettling(false);
    }
  };

  if (debts === undefined) {
    return <div className="loader">Đang tải công nợ...</div>;
  }

  const receivables = debts.filter((debt) => debt.direction === "owed");
  const sendableDebts = receivables.filter((debt) => debt.teams_email);
  const missingEmailDebts = receivables.filter((debt) => !debt.teams_email);

  return (
    <div className="debt-overview">
      <div className="debt-overview-heading">
        <h2>Tổng nợ</h2>
        {isEditor && receivables.length > 0 && (
          <button
            type="button"
            className="debt-send-teams"
            onClick={() => setIsTeamsPreviewOpen(true)}
            disabled={sendingTeams}
          >
            {sendingTeams ? "Đang gửi…" : "📤 Gửi Teams"}
          </button>
        )}
      </div>

      {debts.length === 0 ? (
        <div className="empty-state" style={{ padding: "2rem" }}>
          Không còn khoản phải thu hoặc phải trả nào. 🎉
        </div>
      ) : (
        <div className="invoice-details-table-container">
          <table className="invoice-details-table debt-overview-table">
            <thead>
              <tr>
                <th className="debt-member-heading">Thành viên</th>
                <th>Chi tiết ròng</th>
                <th className="debt-net-heading">Số dư ròng</th>
                {isEditor && <th className="debt-action-heading">Thao tác</th>}
              </tr>
            </thead>
            <tbody>
              {debts.map((debt) => {
                const entries = [...debt.entries].sort((a, b) =>
                  b.date.localeCompare(a.date),
                );

                return (
                  <tr key={debt.member_id}>
                    <td className="debt-member-cell" data-label="Thành viên">
                      <strong>{debt.name}</strong>
                    </td>
                    <td className="debt-breakdown-cell" data-label="Chi tiết ròng">
                      <div className="debt-entry-list">
                        {entries.map((entry, index) => (
                          <button
                            key={`${entry.invoice_id}-${index}`}
                            type="button"
                            className={`debt-entry ${entry.amount < 0 ? "payable" : "receivable"}`}
                            onClick={() => {
                              setSelectedDebtUserId(debt.member_id);
                              setSelectedInvoiceId(entry.invoice_id);
                            }}
                            aria-label={`Hóa đơn ${entry.store_name}, ngày ${entry.date}: ${entry.amount < 0 ? "phải trả" : "phải thu"} ${Math.abs(entry.amount).toLocaleString("vi-VN")} đồng`}
                            title={`${entry.store_name} · ${entry.date.split("-").reverse().join("/")}`}
                          >
                            <strong>
                              {entry.amount < 0 ? "−" : "+"}
                              {Math.abs(entry.amount).toLocaleString("vi-VN")}đ
                            </strong>
                            <span>
                              {entry.date.split("-").reverse().join("/")}
                            </span>
                          </button>
                        ))}
                      </div>
                    </td>
                    <td className={`debt-net-cell ${debt.direction}`} data-label="Số dư ròng">
                      <strong>{debt.absTotal.toLocaleString("vi-VN")}đ</strong>
                    </td>
                    {isEditor && <td className="debt-action-cell" data-label="Thao tác">
                      <button
                        type="button"
                        className={`debt-settlement-icon-button ${debt.direction}`}
                        onClick={() => setSettlingUserId(debt.member_id)}
                        aria-label={`${debt.direction === "owed" ? "Xác nhận đã thu" : "Xác nhận đã trả"} ${debt.absTotal.toLocaleString("vi-VN")} đồng từ ${debt.name}`}
                        title={`${debt.direction === "owed" ? "Xác nhận đã thu" : "Xác nhận đã trả"} ${debt.absTotal.toLocaleString("vi-VN")}đ`}
                        disabled={isSettling}
                      >
                        <svg viewBox="0 0 20 20" aria-hidden="true">
                          <path d="m4 10 4 4 8-8" />
                        </svg>
                      </button>
                    </td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {isEditor && debtToSettle && (
        <ConfirmDialog
          title={`Đối soát với ${debtToSettle.name}`}
          message={
            <>
              <span style={{ display: "block" }}>
                Họ nợ bạn {debtToSettle.receivableTotal.toLocaleString("vi-VN")}đ ·
                bạn nợ họ {debtToSettle.payableTotal.toLocaleString("vi-VN")}đ.
              </span>
              <strong style={{ display: "block", margin: "0.5rem 0" }}>
                {debtToSettle.direction === "owed" ? debtToSettle.name : "Bạn"} sẽ {debtToSettle.direction === "owed" ? "chuyển bạn" : "trả họ"}{" "}
                {debtToSettle.absTotal.toLocaleString("vi-VN")}đ.
              </strong>
              <span style={{ display: "block" }}>
                Xác nhận sẽ đánh dấu {debtToSettle.entries.length} khoản chưa thanh toán
                trong {new Set(debtToSettle.entries.map((entry) => entry.invoice_id)).size} hóa đơn giữa hai người là đã đối soát.
              </span>
            </>
          }
          confirmLabel={debtToSettle.direction === "owed" ? "Xác nhận đã thu" : "Xác nhận đã trả"}
          onCancel={() => setSettlingUserId(null)}
          onConfirm={handleConfirmSettleUser}
          isLoading={isSettling}
        />
      )}

      {selectedInvoiceId && (
        <Modal
          className="debt-invoice-modal"
          ariaLabelledBy="debt-invoice-title"
          onClose={closeInvoiceModal}
        >
          <div className="debt-invoice-header">
            <div>
              <span className="teams-preview-eyebrow">CHI TIẾT HÓA ĐƠN</span>
              <h3 id="debt-invoice-title">
                {selectedInvoice?.store_name ?? "Đang tải hóa đơn..."}
              </h3>
              {selectedInvoice && (
                <p>
                  {selectedInvoice.date
                    ? selectedInvoice.date.split("-").reverse().join("/")
                    : new Date(selectedInvoice._creationTime).toLocaleDateString("vi-VN")}
                </p>
              )}
            </div>
            <button
              type="button"
              className="teams-preview-close"
              onClick={closeInvoiceModal}
              aria-label="Đóng chi tiết hóa đơn"
            >
              ×
            </button>
          </div>

          <div className="debt-invoice-body">
            {selectedInvoice === undefined || selectedInvoiceOrders === undefined ? (
              <div className="loader" role="status" aria-live="polite">
                Đang tải chi tiết hóa đơn...
              </div>
            ) : selectedInvoice === null ? (
              <div className="empty-state">Không tìm thấy hóa đơn này.</div>
            ) : (
              <>
                <div className="debt-invoice-summary">
                  <span>
                    {selectedInvoice.invoice_type === "payable"
                      ? "Bạn phải trả"
                      : "Tổng hóa đơn"}
                  </span>
                  <strong>
                    {selectedInvoice.paid_amount.toLocaleString("vi-VN")}đ
                  </strong>
                </div>
                {selectedInvoiceOrders.length === 0 ? (
                  <div className="empty-state">Hóa đơn chưa có chi tiết.</div>
                ) : (
                  <div className="invoice-details-table-container debt-invoice-orders">
                    <table className="invoice-details-table">
                      <thead>
                        <tr>
                          <th style={{ textAlign: "left" }}>
                            {selectedInvoice.invoice_type === "payable"
                              ? "Chủ nợ"
                              : "Thành viên"}
                          </th>
                          <th>
                            {selectedInvoice.invoice_type === "payable"
                              ? "Khoản phải trả"
                              : "Phần ăn"}
                          </th>
                          <th>
                            {selectedInvoice.invoice_type === "payable"
                              ? "Số tiền trả"
                              : "Số tiền phải thu"}
                          </th>
                          <th>Trạng thái</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedInvoiceOrders.map((order) => (
                          <tr
                            key={order._id}
                            className={
                              order.member_id === selectedDebtUserId
                                ? "debt-invoice-member-highlight"
                                : undefined
                            }
                          >
                            <td
                              data-label={
                                selectedInvoice.invoice_type === "payable"
                                  ? "Chủ nợ"
                                  : "Thành viên"
                              }
                              style={{ textAlign: "left" }}
                            >
                              {order.user_name}
                              {order.member_id === selectedDebtUserId && (
                                <span className="debt-invoice-member-current">
                                  Đang xem
                                </span>
                              )}
                            </td>
                            <td
                              data-label={
                                selectedInvoice.invoice_type === "payable"
                                  ? "Khoản phải trả"
                                  : "Phần ăn"
                              }
                            >
                              {selectedInvoice.invoice_type === "payable"
                                ? "—"
                                : `${order.item_price.toLocaleString("vi-VN")}đ`}
                            </td>
                            <td
                              data-label={
                                selectedInvoice.invoice_type === "payable"
                                  ? "Số tiền trả"
                                  : "Số tiền phải thu"
                              }
                            >
                              {order.actual_price.toLocaleString("vi-VN")}đ
                            </td>
                            <td data-label="Trạng thái">
                              <span
                                className={`invoice-payment-status ${order.is_paid ? "paid" : "unpaid"}`}
                              >
                                {order.is_paid
                                  ? selectedInvoice.invoice_type === "payable"
                                    ? "Đã trả"
                                    : "Đã thu"
                                  : selectedInvoice.invoice_type === "payable"
                                    ? "Chưa trả"
                                    : "Chưa thu"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        </Modal>
      )}

      {isEditor && isTeamsPreviewOpen && (
        <Modal
          className="teams-preview-modal"
          onClose={() => setIsTeamsPreviewOpen(false)}
        >
          <div className="teams-preview-header">
            <div>
              <span className="teams-preview-eyebrow">PREVIEW</span>
              <h3 id="teams-preview-title">Kiểm tra trước khi gửi</h3>
            </div>
            <button
              type="button"
              className="teams-preview-close"
              onClick={() => setIsTeamsPreviewOpen(false)}
              aria-label="Đóng preview"
            >
              ×
            </button>
          </div>

          <div className="teams-preview-destination">
            <span>Gửi tới</span>
            <strong>
              {teamsConfig?.channel_name || "Kênh Teams đã cấu hình"}
            </strong>
          </div>

          {sendableDebts.length > 0 ? (
            <div className="teams-preview-message">
              <p className="teams-preview-section-title">
                Danh sách nhắc nợ ({sendableDebts.length})
              </p>
              <div className="teams-preview-list">
                {sendableDebts.map((debt) => (
                  <div className="teams-preview-debt" key={debt.member_id}>
                    <div className="teams-preview-debt-heading">
                      <div className="teams-preview-debt-person">
                        <strong>{debt.name}</strong>
                        <span>{debt.teams_email}</span>
                      </div>
                      <strong className="teams-preview-debt-total">
                        {debt.totalDebt.toLocaleString("vi-VN")}đ
                      </strong>
                    </div>
                    <p>
                      Chi tiết ròng: {formatDebtDetails(debt.details)} ={" "}
                      {debt.totalDebt.toLocaleString("vi-VN")}đ
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="teams-preview-empty">
              Không có thành viên nào có Teams email để mention.
            </div>
          )}

          {missingEmailDebts.length > 0 && (
            <p className="teams-preview-warning">
              Bỏ qua {missingEmailDebts.length} người do thiếu Teams email:{" "}
              {missingEmailDebts.map((debt) => debt.name).join(", ")}.
            </p>
          )}

          <div className="custom-modal-actions">
            <button
              type="button"
              className="cancel-btn"
              onClick={() => setIsTeamsPreviewOpen(false)}
            >
              Hủy
            </button>
            <button
              type="button"
              className="confirm-btn teams-preview-send-btn"
              onClick={handleConfirmSendToTeams}
              disabled={sendingTeams || sendableDebts.length === 0}
            >
              Gửi ngay
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
