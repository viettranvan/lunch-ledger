import { useState } from "react";
import { createPortal } from "react-dom";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id, Doc } from "../../convex/_generated/dataModel";

export default function ExpandableInvoiceItem({
  invoice,
  invoiceStatus,
  onClick,
}: {
  invoice: Doc<"invoices">;
  invoiceStatus: "completed" | "empty" | "unpaid" | "partial";
  onClick: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{
    isOpen: boolean;
    type: "invoice" | "order";
    id: Id<"invoices"> | Id<"orderers">;
    name: string;
  }>({ isOpen: false, type: "invoice", id: "" as Id<"invoices">, name: "" });

  const isAdjustment = invoice.store_name.startsWith("Điều chỉnh nợ");
  const shouldFetchOrderers = expanded || isAdjustment;

  const orderers = useQuery(
    api.orderers.getByInvoice,
    shouldFetchOrderers ? { invoice_id: invoice._id } : "skip",
  );
  const togglePaid = useMutation(api.orderers.togglePaid);
  const deleteOrder = useMutation(api.orderers.deleteOrder);
  const deleteInvoice = useMutation(api.invoices.deleteInvoice);

  const formatNumber = (num: number) => {
    return num.toLocaleString("vi-VN", { maximumFractionDigits: 2 });
  };

  const statusConfig = {
    completed: { label: "Hoàn tất", bg: "rgba(16, 185, 129, 0.2)", color: "#6ee7b7", border: "rgba(16, 185, 129, 0.3)" },
    empty: { label: "Mới tạo", bg: "rgba(107, 114, 128, 0.2)", color: "#9ca3af", border: "rgba(107, 114, 128, 0.3)" },
    unpaid: { label: "Chưa trả", bg: "rgba(239, 68, 68, 0.2)", color: "#fca5a5", border: "rgba(239, 68, 68, 0.3)" },
    partial: { label: "Trả một phần", bg: "rgba(245, 158, 11, 0.2)", color: "#fbbf24", border: "rgba(245, 158, 11, 0.3)" },
  };
  const statusStyle = statusConfig[invoiceStatus];

  const borderColorMap = {
    completed: "rgba(16, 185, 129, 0.4)",
    empty: "rgba(107, 114, 128, 0.3)",
    unpaid: "rgba(239, 68, 68, 0.4)",
    partial: "rgba(245, 158, 11, 0.4)",
  };

  return (
    <li
      className="list-item invoice-item"
      style={{
        flexDirection: "column",
        alignItems: "stretch",
        cursor: "default",
        padding: expanded ? "1rem" : "0.8rem 1.2rem",
        borderLeft: `3px solid ${borderColorMap[invoiceStatus]}`,
        opacity: invoiceStatus === "completed" ? 0.7 : 1,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          width: "100%",
        }}
      >
        <div
          onClick={() => setExpanded(!expanded)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            cursor: "pointer",
            flex: 1,
          }}
        >
          <span
            style={{
              fontSize: "0.85rem",
              color: "var(--text-muted)",
              width: "16px",
              textAlign: "center",
              display: "inline-block",
              transition: "transform 0.2s",
            }}
          >
            {expanded ? "▼" : "▶"}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <strong
              style={{
                fontSize: expanded ? "1.1rem" : "1.05rem",
                color: "white",
              }}
            >
              {invoice.store_name}
            </strong>
            {!isAdjustment && (
              <span
                style={{
                  background: statusStyle.bg,
                  color: statusStyle.color,
                  padding: "2px 8px",
                  borderRadius: "12px",
                  fontSize: "0.75rem",
                  fontWeight: "600",
                  border: `1px solid ${statusStyle.border}`,
                }}
              >
                {statusStyle.label}
              </span>
            )}
            {isAdjustment && (
              <span
                style={{
                  background: "rgba(245, 158, 11, 0.2)",
                  color: "#fbbf24",
                  padding: "2px 8px",
                  borderRadius: "12px",
                  fontSize: "0.75rem",
                  fontWeight: "600",
                  border: "1px solid rgba(245, 158, 11, 0.3)",
                }}
              >
                Điều chỉnh
              </span>
            )}
            <span style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
              (
              {invoice.date
                ? invoice.date.split("-").reverse().join("/")
                : new Date(invoice._creationTime).toLocaleDateString("vi-VN")}
              )
            </span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            className="price-tag"
            onClick={onClick}
            style={{
              cursor: "pointer",
              padding: "4px 8px",
              borderRadius: "6px",
              transition: "background 0.2s",
              color: isAdjustment ? "#fbbf24" : "#f472b6",
              fontWeight: "600",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = "rgba(255,255,255,0.05)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "transparent")
            }
          >
            {isAdjustment
              ? `Trừ: ${formatNumber(
                  Math.abs(
                    orderers?.reduce((sum, o) => sum + o.item_price, 0) ?? 0,
                  ),
                )}đ`
              : `Tổng tiền: ${formatNumber(invoice.paid_amount)}đ`}{" "}
            ✏️
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              setConfirmDelete({
                isOpen: true,
                type: "invoice",
                id: invoice._id,
                name: invoice.store_name,
              });
            }}
            title="Xóa hóa đơn"
            style={{
              color: "#ef4444",
              background: "rgba(239, 68, 68, 0.1)",
              border: "none",
              padding: "6px 8px",
              borderRadius: "6px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = "rgba(239, 68, 68, 0.2)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "rgba(239, 68, 68, 0.1)")
            }
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              <line x1="10" y1="11" x2="10" y2="17"></line>
              <line x1="14" y1="11" x2="14" y2="17"></line>
            </svg>
          </button>
        </div>
      </div>

      {expanded && (
        <div
          className="invoice-details-table-container"
          style={{ marginTop: "16px", animation: "fadeIn 0.3s ease-out" }}
        >
          {orderers === undefined ? (
            <div
              className="text-muted"
              style={{ padding: "1.5rem", textAlign: "center" }}
            >
              Đang tải chi tiết...
            </div>
          ) : orderers.length === 0 ? (
            <div
              className="text-muted"
              style={{ padding: "1.5rem", textAlign: "center" }}
            >
              Chưa có order nào
            </div>
          ) : (
            <table className="invoice-details-table">
              <thead>
                <tr>
                  <th style={{ textAlign: "left", paddingLeft: "1.5rem" }}>
                    Thành viên
                  </th>
                  <th style={{ textAlign: "center" }}>Phần ăn</th>
                  <th style={{ textAlign: "center" }}>Tỉ lệ (%)</th>
                  <th style={{ textAlign: "center" }}>Phải trả</th>
                  <th style={{ textAlign: "center" }}>Trạng thái</th>
                  <th style={{ textAlign: "center" }}>Hành động</th>
                </tr>
              </thead>
              <tbody>
                {orderers.map((order) => (
                  <tr key={order._id}>
                    <td style={{ textAlign: "left", paddingLeft: "1.5rem" }}>
                      <strong
                        style={{ color: "var(--text-main)", fontSize: "1rem" }}
                      >
                        {order.user_name}
                      </strong>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      {formatNumber(order.item_price)}đ
                    </td>
                    <td style={{ textAlign: "center" }}>
                      {order.percentage.toFixed(2)}%
                    </td>
                    <td
                      style={{
                        color: "#f472b6",
                        fontWeight: "600",
                        textAlign: "center",
                      }}
                    >
                      {formatNumber(order.actual_price)}đ
                    </td>
                    <td style={{ textAlign: "center" }}>
                      {order.is_paid ? (
                        <span
                          style={{
                            display: "inline-block",
                            background: "rgba(16, 185, 129, 0.2)",
                            color: "#6ee7b7",
                            padding: "6px 12px",
                            borderRadius: "8px",
                            fontSize: "0.85rem",
                            fontWeight: "500",
                          }}
                        >
                          Đã gửi
                        </span>
                      ) : (
                        <span
                          style={{
                            display: "inline-block",
                            background: "rgba(239, 68, 68, 0.15)",
                            color: "#fca5a5",
                            padding: "6px 12px",
                            borderRadius: "8px",
                            fontSize: "0.85rem",
                            fontWeight: "500",
                          }}
                        >
                          Chưa gửi
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      {!order.is_paid ? (
                        <div
                          style={{
                            display: "flex",
                            gap: "8px",
                            justifyContent: "center",
                          }}
                        >
                          <button
                            onClick={() =>
                              togglePaid({ id: order._id, is_paid: true })
                            }
                            title="Đánh dấu đã trả"
                            style={{
                              background: "var(--accent)",
                              border: "none",
                              color: "white",
                              padding: "8px",
                              borderRadius: "8px",
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              transition: "all 0.2s",
                            }}
                            onMouseEnter={(e) =>
                              (e.currentTarget.style.background =
                                "var(--accent-hover)")
                            }
                            onMouseLeave={(e) =>
                              (e.currentTarget.style.background =
                                "var(--accent)")
                            }
                          >
                            <svg
                              width="20"
                              height="20"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                          </button>

                          <button
                            className="delete-btn"
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Bạn có chắc muốn xóa phần ăn của ${order.user_name} không?`,
                                )
                              ) {
                                deleteOrder({ id: order._id });
                              }
                            }}
                            title="Xóa phần ăn"
                            style={{ color: "#ef4444", padding: "4px" }}
                          >
                            🗑️
                          </button>
                        </div>
                      ) : (
                        <div
                          style={{
                            display: "flex",
                            gap: "8px",
                            justifyContent: "center",
                            alignItems: "center",
                          }}
                        >
                          <span
                            style={{
                              color: "var(--text-muted)",
                              fontSize: "0.9rem",
                            }}
                          >
                            -
                          </span>
                          <button
                            className="delete-btn"
                            onClick={() => {
                              setConfirmDelete({
                                isOpen: true,
                                type: "order",
                                id: order._id,
                                name: order.user_name,
                              });
                            }}
                            title="Xóa phần ăn"
                            style={{ color: "#ef4444", padding: "4px" }}
                          >
                            🗑️
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {confirmDelete.isOpen &&
        createPortal(
          <div
            className="custom-modal-overlay"
            onClick={(e) => {
              e.stopPropagation();
              setConfirmDelete((prev) => ({ ...prev, isOpen: false }));
            }}
          >
            <div className="custom-modal" onClick={(e) => e.stopPropagation()}>
              <h3>Xác nhận xóa</h3>
              <p>
                {confirmDelete.type === "invoice"
                  ? `Bạn có chắc muốn xóa hóa đơn của ${confirmDelete.name} không? Toàn bộ phần ăn bên trong cũng sẽ bị xóa!`
                  : `Bạn có chắc muốn xóa phần ăn của ${confirmDelete.name} không?`}
              </p>
              <div className="custom-modal-actions">
                <button
                  className="cancel-btn"
                  onClick={() =>
                    setConfirmDelete((prev) => ({ ...prev, isOpen: false }))
                  }
                >
                  Hủy
                </button>
                <button
                  className="confirm-btn"
                  onClick={async () => {
                    if (confirmDelete.type === "invoice") {
                      await deleteInvoice({
                        id: confirmDelete.id as Id<"invoices">,
                      });
                    } else {
                      await deleteOrder({
                        id: confirmDelete.id as Id<"orderers">,
                      });
                    }
                    setConfirmDelete((prev) => ({ ...prev, isOpen: false }));
                  }}
                >
                  Xóa
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </li>
  );
}
