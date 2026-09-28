import { useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import DebtAdjustmentDialog from "./DebtAdjustmentDialog";
import ConfirmDialog from "../../../shared/components/ConfirmDialog";
import Modal from "../../../shared/components/Modal";

function formatDebtDetails(details: number[]) {
  return details
    .map((amount) => {
      const display = (Math.abs(amount) / 1000).toLocaleString("vi-VN");
      return amount < 0 ? `-${display}` : display;
    })
    .join(" + ");
}

export default function DebtOverview() {
  const debts = useQuery(api.features.debts.queries.getDebtOverview);
  const teamsConfig = useQuery(api.features.teams.queries.get);
  const markAllPaidForUser = useMutation(api.features.debts.mutations.markAllPaidForUser);
  const sendDebtReminder = useAction(api.integrations.teams.actions.sendDebtReminder);

  const [confirmPay, setConfirmPay] = useState<{
    isOpen: boolean;
    userId: Id<"users">;
    name: string;
  }>({ isOpen: false, userId: "" as Id<"users">, name: "" });

  const [adjustmentUser, setAdjustmentUser] = useState<{
    userId: Id<"users">;
    userName: string;
  } | null>(null);

  const [sendingTeams, setSendingTeams] = useState(false);
  const [teamsSendResult, setTeamsSendResult] = useState<string | null>(null);
  const [isTeamsPreviewOpen, setIsTeamsPreviewOpen] = useState(false);

  const handleSendToTeams = () => {
    if (!debts || debts.length === 0) return;

    setTeamsSendResult(null);
    setIsTeamsPreviewOpen(true);
  };

  const handleConfirmSendToTeams = async () => {
    if (!debts || debts.length === 0) return;

    setIsTeamsPreviewOpen(false);
    setSendingTeams(true);
    setTeamsSendResult(null);
    try {
      const result = await sendDebtReminder();
      if (!result.sent) {
        if (result.reason === "no_debts") {
          setTeamsSendResult("Không có ai còn nợ.");
        } else if (result.reason === "no_emails") {
          setTeamsSendResult(
            "Không gửi được — chưa có Teams email nào. Thêm email ở mục Thành viên.",
          );
        }
      } else {
        let msg = `Đã gửi nhắc nợ cho ${result.count} người vào Teams.`;
        if (result.missingEmail && result.missingEmail.length > 0) {
          msg += ` (Bỏ qua: ${result.missingEmail.join(", ")})`;
        }
        setTeamsSendResult(msg);
      }
    } catch (err) {
      setTeamsSendResult(
        err instanceof Error ? err.message : "Gửi Teams thất bại.",
      );
    } finally {
      setSendingTeams(false);
      setTimeout(() => setTeamsSendResult(null), 5000);
    }
  };

  if (debts === undefined) {
    return <div className="loader">Đang tải nợ...</div>;
  }

  const owedDebts = debts.filter((debt) => debt.direction === "owed");
  const sendableDebts = owedDebts.filter((debt) => debt.teams_email);
  const missingEmailDebts = owedDebts.filter((debt) => !debt.teams_email);

  return (
    <div style={{ width: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <h2 style={{ margin: 0 }}>Tổng Nợ</h2>
        {debts.length > 0 && (
          <button
              onClick={handleSendToTeams}
              disabled={sendingTeams}
              style={{
                background: sendingTeams
                  ? "rgba(110, 231, 183, 0.2)"
                  : "rgba(99, 102, 241, 0.2)",
                color: sendingTeams ? "#6ee7b7" : "#a5b4fc",
                border: `1px solid ${sendingTeams ? "rgba(110, 231, 183, 0.3)" : "rgba(99, 102, 241, 0.4)"}`,
                padding: "6px 14px",
                borderRadius: "8px",
                cursor: sendingTeams ? "wait" : "pointer",
                fontSize: "0.85rem",
                fontWeight: "500",
                transition: "all 0.2s",
                whiteSpace: "nowrap",
                opacity: sendingTeams ? 0.7 : 1,
              }}
            >
              {sendingTeams ? "Đang gửi..." : "📤 Gửi Teams"}
            </button>
        )}
      </div>
      {teamsSendResult && (
        <p
          style={{
            margin: "8px 0 0",
            fontSize: "0.85rem",
            color: teamsSendResult.includes("thất bại") || teamsSendResult.includes("Không gửi")
              ? "#fca5a5"
              : "#6ee7b7",
          }}
        >
          {teamsSendResult}
        </p>
      )}
      {debts.length === 0 ? (
        <div className="empty-state" style={{ padding: "2rem" }}>
          Tuyệt vời! Không ai còn nợ tiền ăn. 🎉
        </div>
      ) : (
        <div className="invoice-details-table-container">
          <table className="invoice-details-table">
            <thead>
              <tr>
                <th
                  style={{
                    textAlign: "left",
                    paddingLeft: "1.5rem",
                    width: "25%",
                  }}
                >
                  Thành viên
                </th>
                <th style={{ textAlign: "center", width: "40%" }}>
                  Chi tiết nợ
                </th>
                <th
                  style={{
                    textAlign: "right",
                    width: "20%",
                  }}
                >
                  Tổng nợ
                </th>
                <th
                  style={{
                    textAlign: "center",
                    paddingRight: "1.5rem",
                    width: "15%",
                  }}
                >
                  Hành động
                </th>
              </tr>
            </thead>
            <tbody>
              {debts.map((userDebt) => (
                <tr key={userDebt.user_id}>
                  <td style={{ textAlign: "left", paddingLeft: "1.5rem" }}>
                    <strong
                      style={{ color: "var(--text-main)", fontSize: "1.05rem" }}
                    >
                      {userDebt.name}
                    </strong>
                  </td>
                  <td
                    style={{
                      textAlign: "center",
                      fontStyle: "italic",
                      opacity: 0.8,
                    }}
                  >
                    {formatDebtDetails(userDebt.details)}
                  </td>
                  <td
                    style={{
                      textAlign: "right",
                      color:
                        userDebt.direction === "owes_you"
                          ? "#6ee7b7"
                          : "#f472b6",
                      fontWeight: "bold",
                    }}
                  >
                    {userDebt.direction === "owes_you"
                      ? `Bạn nợ: ${userDebt.absTotal.toLocaleString("vi-VN")}đ`
                      : `${userDebt.totalDebt.toLocaleString("vi-VN")}đ`}
                  </td>
                  <td style={{ textAlign: "center", paddingRight: "1.5rem" }}>
                    <div
                      style={{
                        display: "flex",
                        gap: "8px",
                        justifyContent: "center",
                      }}
                    >
                      {userDebt.direction === "owed" && (
                        <button
                          onClick={() => {
                            setAdjustmentUser({
                              userId: userDebt.user_id as Id<"users">,
                              userName: userDebt.name,
                            });
                          }}
                          style={{
                            background: "rgba(245, 158, 11, 0.2)",
                            color: "#fbbf24",
                            border: "1px solid rgba(245, 158, 11, 0.3)",
                            padding: "6px 12px",
                            borderRadius: "6px",
                            cursor: "pointer",
                            fontSize: "0.85rem",
                            fontWeight: "500",
                            transition: "background 0.2s",
                          }}
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.background =
                              "rgba(245, 158, 11, 0.3)")
                          }
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.background =
                              "rgba(245, 158, 11, 0.2)")
                          }
                        >
                          Trừ nợ
                        </button>
                      )}
                      {userDebt.direction === "owed" && (
                        <button
                          onClick={() => {
                            setConfirmPay({
                              isOpen: true,
                              userId: userDebt.user_id as Id<"users">,
                              name: userDebt.name,
                            });
                          }}
                          style={{
                            background: "var(--accent)",
                            color: "white",
                            border: "none",
                            padding: "6px 12px",
                            borderRadius: "6px",
                            cursor: "pointer",
                            fontSize: "0.85rem",
                            fontWeight: "500",
                            transition: "background 0.2s",
                          }}
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.background =
                              "var(--accent-hover)")
                          }
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.background = "var(--accent)")
                          }
                        >
                          Đã thanh toán
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {confirmPay.isOpen && (
        <ConfirmDialog
          title="Xác nhận thanh toán"
          message={`Xác nhận ${confirmPay.name} đã thanh toán toàn bộ nợ?`}
          confirmLabel="Xác nhận"
          confirmStyle={{ background: "var(--accent)" }}
          onCancel={() =>
            setConfirmPay((prev) => ({ ...prev, isOpen: false }))
          }
          onConfirm={async () => {
            await markAllPaidForUser({ user_id: confirmPay.userId });
            setConfirmPay((prev) => ({ ...prev, isOpen: false }));
          }}
        />
      )}

      {adjustmentUser && (
        <DebtAdjustmentDialog
          userId={adjustmentUser.userId}
          userName={adjustmentUser.userName}
          currentDebt={
            debts.find((debt) => debt.user_id === adjustmentUser.userId)
              ?.totalDebt ?? 0
          }
          onClose={() => setAdjustmentUser(null)}
        />
      )}

      {isTeamsPreviewOpen &&
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
                      <div className="teams-preview-debt" key={debt.user_id}>
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
                          Chi tiết: {formatDebtDetails(debt.details)}
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
                  Bỏ qua {missingEmailDebts.length} người do thiếu Teams email: {" "}
                  {missingEmailDebts.map((debt) => debt.name).join(", ")}.
                </p>
              )}

              <div className="custom-modal-actions">
                <button
                  className="cancel-btn"
                  onClick={() => setIsTeamsPreviewOpen(false)}
                >
                  Hủy
                </button>
                <button
                  className="confirm-btn teams-preview-send-btn"
                  onClick={handleConfirmSendToTeams}
                  disabled={sendingTeams || sendableDebts.length === 0}
                >
                  Gửi ngay
                </button>
              </div>
        </Modal>}
    </div>
  );
}
