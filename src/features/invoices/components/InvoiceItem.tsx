import { useId, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Doc } from "../../../../convex/_generated/dataModel";
import { toast } from "../../../shared/lib/toast";

type InvoiceStatus = "completed" | "empty" | "unpaid" | "partial";

const invoiceStatusConfig: Record<
  InvoiceStatus,
  {
    label: string;
    bg: string;
    color: string;
    border: string;
    borderColor: string;
  }
> = {
  completed: {
    label: "Hoàn tất",
    bg: "rgba(16, 185, 129, 0.2)",
    color: "#6ee7b7",
    border: "rgba(16, 185, 129, 0.3)",
    borderColor: "rgba(16, 185, 129, 0.4)",
  },
  empty: {
    label: "Mới tạo",
    bg: "rgba(107, 114, 128, 0.2)",
    color: "#9ca3af",
    border: "rgba(107, 114, 128, 0.3)",
    borderColor: "rgba(107, 114, 128, 0.3)",
  },
  unpaid: {
    label: "Chưa hoàn tất",
    bg: "rgba(239, 68, 68, 0.2)",
    color: "#fca5a5",
    border: "rgba(239, 68, 68, 0.3)",
    borderColor: "rgba(239, 68, 68, 0.4)",
  },
  partial: {
    label: "Thanh toán một phần",
    bg: "rgba(245, 158, 11, 0.2)",
    color: "#fbbf24",
    border: "rgba(245, 158, 11, 0.3)",
    borderColor: "rgba(245, 158, 11, 0.4)",
  },
};

function formatInvoiceAmount(amount: number) {
  return amount.toLocaleString("vi-VN", { maximumFractionDigits: 2 });
}

export default function ExpandableInvoiceItem({
  invoice,
  invoiceStatus,
  onEdit,
  onDelete,
}: {
  invoice: Doc<"invoices">;
  invoiceStatus: InvoiceStatus;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const detailsId = useId();

  const isPayable = invoice.invoice_type === "payable";

  const orderers = useQuery(
    api.features.orders.queries.getByInvoice,
    expanded ? { invoice_id: invoice._id } : "skip",
  );
  const togglePaid = useMutation(api.features.orders.mutations.togglePaid);

  const statusStyle = invoiceStatusConfig[invoiceStatus];

  const handleTogglePaid = async (order: NonNullable<typeof orderers>[number]) => {
    try {
      await togglePaid({ id: order._id, is_paid: true });
      toast.success(
        `${isPayable ? "Đã đánh dấu đã trả" : "Đã đánh dấu đã thu"} của ${order.user_name}.`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể cập nhật trạng thái thanh toán.");
    }
  };

  const canModify = invoiceStatus !== "completed" && invoiceStatus !== "partial";

  return (
    <li
      className="list-item invoice-item"
      style={{
        flexDirection: "column",
        alignItems: "stretch",
        cursor: "default",
        padding: expanded ? "1rem" : "0.8rem 1.2rem",
        borderLeft: `3px solid ${statusStyle.borderColor}`,
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
        <button
          type="button"
          className="invoice-expand-trigger"
          aria-expanded={expanded}
          aria-controls={detailsId}
          onClick={() => setExpanded((value) => !value)}
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
            <span
              style={{
                background: isPayable
                  ? "rgba(245, 158, 11, 0.16)"
                  : "rgba(139, 92, 246, 0.16)",
                color: isPayable ? "#fbbf24" : "#c4a2ff",
                padding: "2px 8px",
                borderRadius: "12px",
                fontSize: "0.75rem",
                fontWeight: "600",
                border: `1px solid ${isPayable ? "rgba(245, 158, 11, 0.3)" : "rgba(139, 92, 246, 0.3)"}`,
              }}
            >
              {isPayable ? "Phải trả" : "Phải thu"}
            </span>
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
            <span className="invoice-card-date">
              {invoice.date
                ? invoice.date.split("-").reverse().join("/")
                : new Date(invoice._creationTime).toLocaleDateString("vi-VN")}
            </span>
          </div>
        </button>

        <div className="invoice-card-actions">
          <strong className={`invoice-card-total${isPayable ? " payable" : ""}`}>
            {isPayable
              ? `Bạn phải trả: ${formatInvoiceAmount(invoice.paid_amount)}đ`
              : `Tổng tiền: ${formatInvoiceAmount(invoice.paid_amount)}đ`}
          </strong>
          {canModify ? (
            <button type="button" className="invoice-edit-icon-button" onClick={onEdit} aria-label={`Chỉnh sửa hóa đơn ${invoice.store_name}`} title="Chỉnh sửa hóa đơn">
              <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m12.8 3.2 4 4M3 17l3.8-.8L16 7a2.1 2.1 0 0 0-3-3L3.8 13.2 3 17Z" /></svg>
            </button>
          ) : null}
          {canModify ? (
            <button
              type="button"
              className="invoice-delete-button"
              onClick={onDelete}
              aria-label={`Xóa hóa đơn ${invoice.store_name}`}
              title="Xóa hóa đơn chưa hoàn tất"
            >
              <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 5.5h14M7.5 5.5V3h5v2.5m-7.5 0 .8 11h8.4l.8-11M8 8.5v5m4-5v5" /></svg>
            </button>
          ) : null}
        </div>
      </div>

      {expanded && (
        <div
          id={detailsId}
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
                    {isPayable ? "Chủ nợ" : "Thành viên"}
                  </th>
                  <th style={{ textAlign: "center" }}>
                    {isPayable ? "Khoản phải trả" : "Phần ăn"}
                  </th>
                  <th style={{ textAlign: "center" }}>
                    {isPayable ? "Số tiền trả" : "Số tiền phải thu"}
                  </th>
                  <th style={{ textAlign: "center" }}>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {orderers.map((order) => (
                  <tr key={order._id}>
                    <td
                      data-label={isPayable ? "Chủ nợ" : "Thành viên"}
                      style={{ textAlign: "left", paddingLeft: "1.5rem" }}
                    >
                      <strong
                        style={{ color: "var(--text-main)", fontSize: "1rem" }}
                      >
                        {order.user_name}
                      </strong>
                    </td>
                    <td
                      className="invoice-breakdown-cell"
                      data-label={isPayable ? "Khoản phải trả" : "Phần ăn"}
                    >
                      {isPayable
                        ? "—"
                        : `${formatInvoiceAmount(order.item_price)}đ`}
                    </td>
                    <td
                      className="invoice-breakdown-cell"
                      data-label={isPayable ? "Số tiền trả" : "Số tiền phải thu"}
                    >
                      <strong>{formatInvoiceAmount(order.actual_price)}đ</strong>
                    </td>
                    <td data-label="Trạng thái" style={{ textAlign: "center" }}>
                      {order.is_paid ? (
                        <span className="invoice-payment-status paid">
                          <span aria-hidden="true">✓</span>
                          {isPayable ? "Đã trả" : "Đã thu"}
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="invoice-payment-action invoice-payment-icon-action"
                          onClick={() => void handleTogglePaid(order)}
                          aria-label={`Đánh dấu đã ${isPayable ? "trả" : "thu"} cho ${order.user_name}`}
                          title={`Đánh dấu đã ${isPayable ? "trả" : "thu"}`}
                        >
                          <svg viewBox="0 0 20 20" aria-hidden="true">
                            <path d="m4 10 4 4 8-8" />
                          </svg>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

    </li>
  );
}
