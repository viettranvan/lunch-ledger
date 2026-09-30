import type { CSSProperties, ReactNode } from "react";
import Modal from "./Modal";

type ConfirmDialogProps = {
  title: string;
  message: ReactNode;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
  confirmStyle?: CSSProperties;
  isLoading?: boolean;
};

export default function ConfirmDialog({
  title,
  message,
  confirmLabel,
  onCancel,
  onConfirm,
  confirmStyle,
  isLoading = false,
}: ConfirmDialogProps) {
  return (
    <Modal onClose={onCancel}>
      <h3>{title}</h3>
      <p>{message}</p>
      <div className="custom-modal-actions">
        <button className="cancel-btn" onClick={onCancel} disabled={isLoading}>
          Hủy
        </button>
        <button
          className="confirm-btn"
          onClick={() => void onConfirm()}
          style={confirmStyle}
          disabled={isLoading}
        >
          {isLoading ? "Đang xử lý..." : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
