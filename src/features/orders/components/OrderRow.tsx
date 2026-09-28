import type { Doc } from "../../../../convex/_generated/dataModel";

export type OrderWithUser = Doc<"orderers"> & { user_name: string };

type OrderRowProps = {
  order: OrderWithUser;
  index: number;
  isAdjustment: boolean;
  canDelete: boolean;
  onTogglePaid: () => void;
  onDelete: () => void;
};

export default function OrderRow({
  order,
  index,
  isAdjustment,
  canDelete,
  onTogglePaid,
  onDelete,
}: OrderRowProps) {
  return (
    <li
      className={`order-item ${order.is_paid ? "paid" : ""}`}
      style={{ animationDelay: `${index * 0.05}s` }}
    >
      <div className="order-info">
        <h3>{order.user_name}</h3>
        <div className="order-price text-muted">
          {isAdjustment
            ? `Trừ nợ: ${Math.abs(order.item_price).toLocaleString("vi-VN")}đ`
            : `Phần ăn: ${order.item_price.toLocaleString("vi-VN")}đ`}
        </div>
      </div>

      <div className="order-actions">
        <div
          className="order-price actual-price"
          style={isAdjustment ? { color: "#fbbf24" } : undefined}
        >
          {isAdjustment
            ? `Đã trừ: ${Math.abs(order.actual_price).toLocaleString("vi-VN")}đ`
            : `Phải trả: ${order.actual_price.toLocaleString("vi-VN")}đ`}
        </div>
        <button
          className={`status-btn ${order.is_paid ? "paid-btn" : "unpaid-btn"}`}
          onClick={onTogglePaid}
        >
          {order.is_paid ? "✅ Đã gửi" : "❌ Chưa gửi"}
        </button>
        {canDelete && (
          <button className="delete-btn" onClick={onDelete}>
            🗑️
          </button>
        )}
      </div>
    </li>
  );
}
