import { createPortal } from "react-dom";
import type { ReactNode } from "react";

type ModalProps = {
  children: ReactNode;
  onClose: () => void;
  className?: string;
};

export default function Modal({ children, onClose, className = "" }: ModalProps) {
  return createPortal(
    <div className="custom-modal-overlay" onClick={onClose}>
      <div
        className={`custom-modal ${className}`.trim()}
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
