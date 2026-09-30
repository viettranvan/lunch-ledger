import { useState } from "react";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Doc, Id } from "../../../../convex/_generated/dataModel";
import ConfirmDialog from "../../../shared/components/ConfirmDialog";
import Modal from "../../../shared/components/Modal";
import { toast } from "../../../shared/lib/toast";
import InvoiceForm from "./InvoiceForm";
import InvoiceItem from "./InvoiceItem";

export default function InvoiceList() {
  const [showAll, setShowAll] = useState(false);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [editingInvoiceId, setEditingInvoiceId] = useState<Id<"invoices"> | null>(null);
  const [isEditingOpen, setIsEditingOpen] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<Doc<"invoices"> | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const { results: invoices, status, loadMore } = usePaginatedQuery(
    api.features.invoices.queries.listPaginated,
    { includeCompleted: showAll },
    { initialNumItems: 20 },
  );
  const editingInvoice = useQuery(
    api.features.invoices.queries.getById,
    editingInvoiceId ? { id: editingInvoiceId } : "skip",
  );
  const editingOrders = useQuery(
    api.features.orders.queries.getByInvoice,
    editingInvoiceId ? { invoice_id: editingInvoiceId } : "skip",
  );
  const deleteInvoice = useMutation(api.features.invoices.mutations.deleteInvoice);

  const openEditor = (invoice: Doc<"invoices">) => {
    setIsComposerOpen(false);
    setEditingInvoiceId(invoice._id);
    setIsEditingOpen(true);
  };

  const closeEditor = () => setIsEditingOpen(false);

  const handleDelete = async () => {
    if (!invoiceToDelete) return;
    setIsDeleting(true);
    try {
      await deleteInvoice({ id: invoiceToDelete._id });
      toast.success(`Đã xóa hóa đơn ${invoiceToDelete.store_name}.`);
      setInvoiceToDelete(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể xóa hóa đơn.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="panel">
      <div className="invoice-list-heading">
        <h2>Hóa đơn gần đây</h2>
        <div className="invoice-list-actions">
          <label className="invoice-show-all">
            <input
              type="checkbox"
              checked={showAll}
              onChange={(event) => setShowAll(event.target.checked)}
            />
            Hiện tất cả
          </label>
          <button
            type="button"
            className="invoice-create-toggle"
            onClick={() => {
              setIsEditingOpen(false);
              setIsComposerOpen(true);
            }}
          >
            + Tạo hóa đơn
          </button>
        </div>
      </div>

      {isEditingOpen && editingInvoiceId ? (
        <Modal
          className="invoice-modal"
          ariaLabelledBy="invoice-form-title"
          onClose={closeEditor}
        >
          {editingInvoice === undefined || editingOrders === undefined ? (
            <div className="loader">Đang tải dữ liệu hóa đơn...</div>
          ) : editingInvoice ? (
            <InvoiceForm
              key={editingInvoiceId}
              initialInvoice={editingInvoice}
              initialOrders={editingOrders}
              onCancel={closeEditor}
              onSaved={closeEditor}
            />
          ) : (
            <div className="empty-state">Không tìm thấy hóa đơn này.</div>
          )}
        </Modal>
      ) : null}

      {isComposerOpen ? (
        <Modal
          className="invoice-modal"
          ariaLabelledBy="invoice-form-title"
          onClose={() => setIsComposerOpen(false)}
        >
          <InvoiceForm
            onCancel={() => setIsComposerOpen(false)}
            onSaved={() => setIsComposerOpen(false)}
          />
        </Modal>
      ) : null}

      {status === "LoadingFirstPage" ? (
        <div className="loader" role="status" aria-live="polite">
          Đang tải dữ liệu...
        </div>
      ) : invoices.length === 0 ? (
        <div className="empty-state">
          {showAll ? "Chưa có hóa đơn nào" : "Tất cả hóa đơn đã hoàn tất 🎉"}
        </div>
      ) : (
        <>
          <ul className="list-view">
            {invoices.map((invoice) => (
              <InvoiceItem
                key={invoice._id}
                invoice={invoice}
                invoiceStatus={invoice.status ?? "empty"}
                onEdit={() => openEditor(invoice)}
                onDelete={() => setInvoiceToDelete(invoice)}
              />
            ))}
          </ul>
          {status === "CanLoadMore" && (
            <button
              type="button"
              className="submit-btn"
              onClick={() => loadMore(20)}
              style={{ width: "100%", marginTop: "1rem" }}
            >
              Tải thêm
            </button>
          )}
        </>
      )}

      {invoiceToDelete ? (
        <ConfirmDialog
          title="Xóa hóa đơn chưa hoàn tất?"
          message={
            invoiceToDelete.status === "partial"
              ? `Hóa đơn “${invoiceToDelete.store_name}” đã có một phần thu/trả. Xóa sẽ xóa cả hóa đơn, các phần ăn và trạng thái thanh toán đã ghi nhận. Thao tác này không thể hoàn tác.`
              : `Bạn có chắc muốn xóa hóa đơn “${invoiceToDelete.store_name}” cùng toàn bộ phần ăn bên trong? Thao tác này không thể hoàn tác.`
          }
          confirmLabel="Xóa hóa đơn"
          isLoading={isDeleting}
          onCancel={() => setInvoiceToDelete(null)}
          onConfirm={handleDelete}
        />
      ) : null}
    </div>
  );
}
