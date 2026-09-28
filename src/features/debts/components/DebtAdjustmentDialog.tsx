import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import parseAndCalculatePrice from "../../invoices/lib/price";
import Modal from "../../../shared/components/Modal";

type Props = {
  userId: Id<"users">;
  userName: string;
  currentDebt: number;
  onClose: () => void;
};

export default function DebtAdjustmentDialog({
  userId,
  userName,
  currentDebt,
  onClose,
}: Props) {
  const createAdjustment = useMutation(
    api.features.debts.mutations.createDebtAdjustment,
  );
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const deduction = parseAndCalculatePrice(amount);
  const remaining = currentDebt - deduction;

  const submit = async () => {
    if (deduction <= 0) {
      alert("Vui lòng nhập số tiền lớn hơn 0.");
      return;
    }
    if (!reason.trim()) {
      alert("Vui lòng nhập lý do trừ nợ.");
      return;
    }
    await createAdjustment({ user_id: userId, amount: deduction, reason: reason.trim() });
    onClose();
  };

  return (
    <Modal onClose={onClose}>
        <h3 style={{ marginBottom: "16px" }}>Trừ nợ cho {userName}</h3>
        <p style={{ marginBottom: "16px", color: "#f472b6", fontWeight: 600 }}>
          Nợ hiện tại: {currentDebt.toLocaleString("vi-VN")}đ
        </p>
        <label className="field-label">Lý do trừ nợ:</label>
        <input
          type="text"
          className="input-field"
          placeholder="VD: Đặt cơm từ bạn A"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          style={{ width: "100%", marginBottom: "12px" }}
        />
        <label className="field-label">Số tiền trừ (nghìn đồng):</label>
        <input
          type="text"
          className="input-field"
          placeholder="VD: 40 (= 40,000đ)"
          value={amount}
          onChange={(event) =>
            setAmount(event.target.value.replace(/[^0-9+\-*/.]/g, ""))
          }
          autoFocus
          style={{ width: "100%" }}
        />
        {deduction > 0 && (
          <div className="debt-adjustment-preview">
            <p className="debt-adjustment-preview__deduction">
              Sẽ trừ: {deduction.toLocaleString("vi-VN")}đ
            </p>
            <p
              className="debt-adjustment-preview__remaining"
              style={{
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
          <button className="cancel-btn" onClick={onClose}>
            Hủy
          </button>
          <button
            className="confirm-btn"
            onClick={submit}
            style={{ background: "rgba(245, 158, 11, 0.8)" }}
          >
            Tạo điều chỉnh
          </button>
        </div>
    </Modal>
  );
}
