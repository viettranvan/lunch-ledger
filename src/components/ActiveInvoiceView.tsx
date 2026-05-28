import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id, Doc } from "../../convex/_generated/dataModel";
import parseAndCalculatePrice from "../utils/parseAndCalculatePrice";

export default function ActiveInvoiceView({
  invoiceId,
  users,
  invoice,
}: {
  invoiceId: Id<"invoices">;
  users: Doc<"users">[];
  invoice?: Doc<"invoices">;
}) {
  const orderers = useQuery(api.orderers.getByInvoice, {
    invoice_id: invoiceId,
  });
  const createOrder = useMutation(api.orderers.create);
  const updateOrder = useMutation(api.orderers.update);
  const togglePaid = useMutation(api.orderers.togglePaid);
  const deleteOrder = useMutation(api.orderers.deleteOrder);

  const [confirmDelete, setConfirmDelete] = useState<{
    isOpen: boolean;
    id: Id<"orderers">;
    name: string;
  }>({ isOpen: false, id: "" as Id<"orderers">, name: "" });

  const [selectedUsers, setSelectedUsers] = useState<
    { userId: Id<"users">; price: string }[]
  >([]);

  const [isAdding, setIsAdding] = useState(true);

  // Restore the correct view state when entering an invoice
  useEffect(() => {
    if (orderers !== undefined) {
      if (orderers.length > 0) {
        // If the invoice already has orders, hide the editing form by default
        setIsAdding(false);
        setSelectedUsers([]);
      } else {
        // If it's a completely new invoice with no orders, show the form
        setIsAdding(true);
        setSelectedUsers([]);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderers === undefined, invoiceId]);

  const toggleUserSelection = (userId: Id<"users">) => {
    setSelectedUsers((prev) => {
      const exists = prev.find((u) => u.userId === userId);
      if (exists) {
        return prev.filter((u) => u.userId !== userId);
      } else {
        return [...prev, { userId, price: "" }];
      }
    });
  };

  const updateUserPrice = (userId: Id<"users">, price: string) => {
    // Only allow numbers, basic math operators, and decimals
    const sanitizedInput = price.replace(/[^0-9+\-*/.]/g, "");
    setSelectedUsers((prev) =>
      prev.map((u) =>
        u.userId === userId ? { ...u, price: sanitizedInput } : u,
      ),
    );
  };

  const handleAddOrder = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check if at least one user is selected and all selected users have a valid price
    if (selectedUsers.length === 0) return;

    // Parse all prices
    const parsedUsers = selectedUsers.map((u) => ({
      userId: u.userId,
      parsedPrice: parseAndCalculatePrice(u.price),
    }));

    const hasInvalidPrice = parsedUsers.some((u) => u.parsedPrice <= 0);

    if (hasInvalidPrice) {
      alert(
        "Vui lòng nhập giá lớn hơn 0 (hoặc phép tính hợp lệ) cho tất cả thành viên đã chọn.",
      );
      return;
    }

    // Create or update an order for each selected user
    const orderPromises = parsedUsers.map((u) => {
      // Find if this user already has an order for this invoice
      const existingOrder = orderers
        ? orderers.find((o) => o.user_id === u.userId)
        : undefined;

      if (existingOrder) {
        // Update existing order
        return updateOrder({
          id: existingOrder._id,
          item_price: u.parsedPrice,
        });
      } else {
        // Create new order
        return createOrder({
          invoice_id: invoiceId,
          user_id: u.userId,
          item_price: u.parsedPrice,
        });
      }
    });

    // Delete any existing orders that are no longer selected
    const selectedUserIds = parsedUsers.map((u) => u.userId);
    const toDelete = orderers
      ? orderers.filter((o) => !selectedUserIds.includes(o.user_id))
      : [];

    toDelete.forEach((o) => {
      orderPromises.push(deleteOrder({ id: o._id }));
    });

    await Promise.all(orderPromises);

    setSelectedUsers([]);
    setIsAdding(false);
  };

  if (orderers === undefined)
    return <div className="loader">Đang tải chi tiết...</div>;

  const totalOrdered = orderers.reduce(
    (sum, order) => sum + order.item_price,
    0,
  );

  const isAdjustment = invoice?.store_name.startsWith("Điều chỉnh nợ");
  const hasPaidUser = orderers.some((o) => o.is_paid);

  const liveTotalNewOrder = selectedUsers.reduce((sum, u) => {
    return sum + parseAndCalculatePrice(u.price);
  }, 0);

  return (
    <div className="invoice-details">
      <div
        className="summary-box"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          {isAdjustment ? (
            <>
              <strong>Số tiền trừ nợ: </strong>
              <span
                style={{
                  fontSize: "1.4rem",
                  color: "#fbbf24",
                }}
              >
                {Math.abs(totalOrdered).toLocaleString("vi-VN")}đ
              </span>
            </>
          ) : (
            <>
              <strong>
                {isAdding ? "Tổng hóa đơn sẽ là: " : "Tổng tiền đã đặt: "}
              </strong>{" "}
              <span
                style={{
                  fontSize: "1.4rem",
                  color:
                    isAdding && liveTotalNewOrder > 0 ? "#f472b6" : "inherit",
                  transition: "color 0.3s ease",
                }}
              >
                {isAdding
                  ? liveTotalNewOrder.toLocaleString("vi-VN")
                  : totalOrdered.toLocaleString("vi-VN")}
                đ
              </span>
            </>
          )}
        </div>

        {!isAdding && !hasPaidUser && !isAdjustment && (
          <button
            className="submit-btn small-btn"
            onClick={() => {
              if (orderers) {
                const existingSelected = orderers.map((o) => ({
                  userId: o.user_id,
                  price: (o.item_price / 1000).toString(),
                }));
                setSelectedUsers(existingSelected);
              }
              setIsAdding(true);
            }}
            style={{
              padding: "8px 16px",
              fontSize: "1rem",
              background: "linear-gradient(135deg, #10b981 0%, #3b82f6 100%)",
            }}
          >
            ✏️ Thêm / Cập nhật
          </button>
        )}
      </div>

      {hasPaidUser && (
        <div
          style={{
            padding: "10px",
            backgroundColor: "rgba(245, 158, 11, 0.1)",
            color: "#f59e0b",
            border: "1px solid rgba(245, 158, 11, 0.3)",
            borderRadius: "8px",
            margin: "16px 0",
            fontSize: "0.9rem",
            textAlign: "center",
          }}
        >
          🔒 Hóa đơn đã có người thanh toán (gửi tiền) nên không thể thay đổi
          phần ăn.
        </div>
      )}

      {isAdding && !hasPaidUser && !isAdjustment && (
        <form className="order-form" onSubmit={handleAddOrder}>
          <div className="form-row">
            <div className="form-column">
              <div className="users-checkbox-grid">
                {users.map((user) => {
                  const selectedData = selectedUsers.find(
                    (u) => u.userId === user._id,
                  );
                  const isSelected = !!selectedData;

                  return (
                    <div
                      key={user._id}
                      className={`user-select-row ${isSelected ? "selected" : ""}`}
                    >
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleUserSelection(user._id)}
                        />
                        {user.name}
                      </label>

                      {isSelected && (
                        <input
                          type="text"
                          className="price-input-small"
                          placeholder="Giá (vd: 35, 15+20)"
                          value={selectedData.price}
                          onChange={(e) =>
                            updateUserPrice(user._id, e.target.value)
                          }
                          required
                          autoFocus
                        />
                      )}
                    </div>
                  );
                })}
              </div>

              <div
                style={{
                  display: "flex",
                  gap: "12px",
                  marginTop: "12px",
                  width: "100%",
                  alignItems: "center",
                }}
              >
                <button
                  type="submit"
                  className="submit-btn"
                  disabled={selectedUsers.length === 0}
                  style={{ flex: 1 }}
                >
                  ✨ Gửi phần ăn ({selectedUsers.length} người)
                </button>
                {liveTotalNewOrder > 0 && (
                  <button
                    type="button"
                    className="submit-btn"
                    onClick={() => setIsAdding(false)}
                    style={{
                      background: "transparent",
                      color: "var(--text-muted)",
                      border: "1px solid var(--glass-border)",
                      padding: "12px",
                      flex: "0 0 auto",
                      boxShadow: "none",
                    }}
                  >
                    Hủy
                  </button>
                )}
              </div>
            </div>
          </div>
        </form>
      )}

      <ul className="orders-list">
        {orderers.length === 0 ? (
          <div className="empty-state">Chưa có ai đặt món</div>
        ) : (
          orderers.map((order, index) => (
            <li
              key={order._id}
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
                  onClick={() =>
                    togglePaid({ id: order._id, is_paid: !order.is_paid })
                  }
                >
                  {order.is_paid ? "✅ Đã gửi" : "❌ Chưa gửi"}
                </button>
                {!hasPaidUser && (
                  <button
                    className="delete-btn"
                    onClick={() =>
                      setConfirmDelete({
                        isOpen: true,
                        id: order._id,
                        name: order.user_name,
                      })
                    }
                  >
                    🗑️
                  </button>
                )}
              </div>
            </li>
          ))
        )}
      </ul>

      {confirmDelete.isOpen &&
        createPortal(
          <div
            className="custom-modal-overlay"
            onClick={() =>
              setConfirmDelete((prev) => ({ ...prev, isOpen: false }))
            }
          >
            <div className="custom-modal" onClick={(e) => e.stopPropagation()}>
              <h3>Xác nhận xóa</h3>
              <p>
                Bạn có chắc muốn xóa phần ăn của {confirmDelete.name} không?
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
                    await deleteOrder({ id: confirmDelete.id });
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
    </div>
  );
}
