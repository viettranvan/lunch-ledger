import { useState } from "react";
import { createPortal } from "react-dom";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import parseAndCalculatePrice from "../utils/parseAndCalculatePrice";
import {
  buildTeamsDebtTable,
  buildTeamsMentions,
  copyRichText,
} from "../utils/teamsCopy";

export default function DebtOverview() {
  const debts = useQuery(api.users.getDebtOverview);
  const markAllPaidForUser = useMutation(api.orderers.markAllPaidForUser);
  const createDebtAdjustment = useMutation(api.orderers.createDebtAdjustment);
  const sendDebtReminder = useAction(api.teamsNotify.sendDebtReminder);

  const [confirmPay, setConfirmPay] = useState<{
    isOpen: boolean;
    userId: Id<"users">;
    name: string;
  }>({ isOpen: false, userId: "" as Id<"users">, name: "" });

  const [adjustModal, setAdjustModal] = useState<{
    isOpen: boolean;
    userId: Id<"users">;
    userName: string;
    amount: string;
    reason: string;
  }>({
    isOpen: false,
    userId: "" as Id<"users">,
    userName: "",
    amount: "",
    reason: "",
  });

  const [copied, setCopied] = useState(false);
  const [copiedMentions, setCopiedMentions] = useState(false);
  const [sendingTeams, setSendingTeams] = useState(false);
  const [teamsSendResult, setTeamsSendResult] = useState<string | null>(null);

  const handleSendToTeams = async () => {
    if (!debts || debts.length === 0) return;

    const owedDebts = debts.filter((d) => d.direction === "owed");
    const missingEmail = owedDebts.filter((d) => !d.teams_email);

    if (missingEmail.length > 0) {
      const names = missingEmail.map((d) => d.name).join(", ");
      const proceed = window.confirm(
        `${missingEmail.length} người chưa có Teams email (${names}). Họ sẽ không được mention. Tiếp tục gửi?`,
      );
      if (!proceed) return;
    }

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
        let msg = `Đã gửi nhắc nợ cho ${result.count} người vào channel Cơm Chưa.`;
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

  const handleCopyDebtTable = async () => {
    if (!debts || debts.length === 0) return;

    const { html, plain } = buildTeamsDebtTable(debts);
    await copyRichText(html, plain);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyMentions = async () => {
    if (!debts || debts.length === 0) return;

    const { html, plain } = buildTeamsMentions(debts);
    await copyRichText(html, plain);
    setCopiedMentions(true);
    setTimeout(() => setCopiedMentions(false), 2000);
  };

  if (debts === undefined) {
    return <div className="loader">Đang tải nợ...</div>;
  }

  return (
    <div style={{ width: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <h2 style={{ margin: 0 }}>Tổng Nợ</h2>
        {debts.length > 0 && (
          <>
            <button
              onClick={handleCopyDebtTable}
              style={{
                background: copied
                  ? "rgba(110, 231, 183, 0.2)"
                  : "rgba(255, 255, 255, 0.08)",
                color: copied ? "#6ee7b7" : "var(--text-secondary)",
                border: `1px solid ${copied ? "rgba(110, 231, 183, 0.3)" : "rgba(255, 255, 255, 0.15)"}`,
                padding: "6px 14px",
                borderRadius: "8px",
                cursor: "pointer",
                fontSize: "0.85rem",
                fontWeight: "500",
                transition: "all 0.2s",
                whiteSpace: "nowrap",
              }}
              onMouseEnter={(e) => {
                if (!copied) {
                  e.currentTarget.style.background = "rgba(255, 255, 255, 0.12)";
                }
              }}
              onMouseLeave={(e) => {
                if (!copied) {
                  e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)";
                }
              }}
            >
              {copied ? "✓ Đã copy" : "📋 Copy Teams"}
            </button>
            <button
              onClick={handleCopyMentions}
            style={{
              background: copiedMentions
                ? "rgba(110, 231, 183, 0.2)"
                : "rgba(255, 255, 255, 0.08)",
              color: copiedMentions ? "#6ee7b7" : "var(--text-secondary)",
              border: `1px solid ${copiedMentions ? "rgba(110, 231, 183, 0.3)" : "rgba(255, 255, 255, 0.15)"}`,
              padding: "6px 14px",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "0.85rem",
              fontWeight: "500",
              transition: "all 0.2s",
              whiteSpace: "nowrap",
            }}
            onMouseEnter={(e) => {
              if (!copiedMentions) {
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.12)";
              }
            }}
            onMouseLeave={(e) => {
              if (!copiedMentions) {
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)";
              }
            }}
          >
            {copiedMentions ? "✓ Đã copy" : "👥 Copy text"}
          </button>
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
          </>
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
                    {userDebt.details
                      .map((val) => {
                        const display = (Math.abs(val) / 1000).toLocaleString(
                          "vi-VN",
                        );
                        return val < 0 ? `-${display}` : display;
                      })
                      .join(" + ")}
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
                            setAdjustModal({
                              isOpen: true,
                              userId: userDebt.user_id as Id<"users">,
                              userName: userDebt.name,
                              amount: "",
                              reason: "",
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

      {confirmPay.isOpen &&
        createPortal(
          <div
            className="custom-modal-overlay"
            onClick={(e) => {
              e.stopPropagation();
              setConfirmPay((prev) => ({ ...prev, isOpen: false }));
            }}
          >
            <div className="custom-modal" onClick={(e) => e.stopPropagation()}>
              <h3>Xác nhận thanh toán</h3>
              <p>Xác nhận {confirmPay.name} đã thanh toán toàn bộ nợ?</p>
              <div className="custom-modal-actions">
                <button
                  className="cancel-btn"
                  onClick={() =>
                    setConfirmPay((prev) => ({ ...prev, isOpen: false }))
                  }
                >
                  Hủy
                </button>
                <button
                  className="confirm-btn"
                  onClick={async () => {
                    await markAllPaidForUser({
                      user_id: confirmPay.userId,
                    });
                    setConfirmPay((prev) => ({ ...prev, isOpen: false }));
                  }}
                  style={{ background: "var(--accent)" }}
                >
                  Xác nhận
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {adjustModal.isOpen &&
        (() => {
          const currentDebt =
            debts?.find((d) => d.user_id === adjustModal.userId)?.totalDebt ?? 0;
          const deductAmount = parseAndCalculatePrice(adjustModal.amount);
          const remaining = currentDebt - deductAmount;

          return createPortal(
            <div
              className="custom-modal-overlay"
              onClick={(e) => {
                e.stopPropagation();
                setAdjustModal((prev) => ({ ...prev, isOpen: false }));
              }}
            >
              <div
                className="custom-modal"
                onClick={(e) => e.stopPropagation()}
                style={{ padding: "24px" }}
              >
                <h3 style={{ marginBottom: "16px" }}>
                  Trừ nợ cho {adjustModal.userName}
                </h3>
                <p
                  style={{
                    marginBottom: "16px",
                    color: "#f472b6",
                    fontWeight: "600",
                    fontSize: "1rem",
                  }}
                >
                  Nợ hiện tại: {currentDebt.toLocaleString("vi-VN")}đ
                </p>
                <label
                  style={{
                    display: "block",
                    marginBottom: "6px",
                    fontSize: "0.9rem",
                    color: "var(--text-muted)",
                  }}
                >
                  Lý do trừ nợ:
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="VD: Đặt cơm từ bạn A"
                  value={adjustModal.reason}
                  onChange={(e) =>
                    setAdjustModal((prev) => ({
                      ...prev,
                      reason: e.target.value,
                    }))
                  }
                  style={{ width: "100%", marginBottom: "12px" }}
                />
                <label
                  style={{
                    display: "block",
                    marginBottom: "6px",
                    fontSize: "0.9rem",
                    color: "var(--text-muted)",
                  }}
                >
                  Số tiền trừ (nghìn đồng):
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="VD: 40 (= 40,000đ)"
                  value={adjustModal.amount}
                  onChange={(e) => {
                    const sanitized = e.target.value.replace(
                      /[^0-9+\-*/.]/g,
                      "",
                    );
                    setAdjustModal((prev) => ({
                      ...prev,
                      amount: sanitized,
                    }));
                  }}
                  autoFocus
                  style={{ width: "100%" }}
                />
                {deductAmount > 0 && (
                  <div
                    style={{
                      marginTop: "16px",
                      padding: "12px 16px",
                      background: "rgba(255,255,255,0.05)",
                      borderRadius: "8px",
                    }}
                  >
                    <p
                      style={{
                        color: "#fbbf24",
                        fontWeight: "600",
                        fontSize: "0.95rem",
                        margin: "0 0 8px 0",
                      }}
                    >
                      Sẽ trừ:{" "}
                      {deductAmount.toLocaleString("vi-VN")}đ
                    </p>
                    <p
                      style={{
                        fontWeight: "600",
                        fontSize: "1rem",
                        margin: 0,
                        color:
                          remaining > 0
                            ? "#f472b6"
                            : remaining < 0
                              ? "#6ee7b7"
                              : "#10b981",
                      }}
                    >
                      {remaining > 0
                        ? `Còn nợ: ${remaining.toLocaleString("vi-VN")}đ`
                        : remaining < 0
                          ? `Bạn dư: ${Math.abs(remaining).toLocaleString("vi-VN")}đ`
                          : "Hết nợ!"}
                    </p>
                  </div>
                )}
              <div className="custom-modal-actions">
                <button
                  className="cancel-btn"
                  onClick={() =>
                    setAdjustModal((prev) => ({ ...prev, isOpen: false }))
                  }
                >
                  Hủy
                </button>
                <button
                  className="confirm-btn"
                  onClick={async () => {
                    const amount = parseAndCalculatePrice(adjustModal.amount);
                    if (amount <= 0) {
                      alert("Vui lòng nhập số tiền lớn hơn 0.");
                      return;
                    }
                    if (!adjustModal.reason.trim()) {
                      alert("Vui lòng nhập lý do trừ nợ.");
                      return;
                    }
                    await createDebtAdjustment({
                      user_id: adjustModal.userId,
                      amount: amount,
                      reason: adjustModal.reason.trim(),
                    });
                    setAdjustModal((prev) => ({ ...prev, isOpen: false }));
                  }}
                  style={{ background: "rgba(245, 158, 11, 0.8)" }}
                >
                  Tạo điều chỉnh
                </button>
              </div>
            </div>
          </div>,
          document.body,
        );
        })()}
    </div>
  );
}
