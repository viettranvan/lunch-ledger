import { useState } from "react";
import { usePaginatedQuery } from "convex/react";
import { useNavigate } from "react-router-dom";
import { api } from "../../../../convex/_generated/api";
import InvoiceForm from "./InvoiceForm";
import InvoiceItem from "./InvoiceItem";

export default function InvoiceList() {
  const [showAll, setShowAll] = useState(false);
  const navigate = useNavigate();
  const { results: invoices, status, loadMore } = usePaginatedQuery(
    api.features.invoices.queries.listPaginated,
    { includeCompleted: showAll },
    { initialNumItems: 20 },
  );

  if (status === "LoadingFirstPage") {
    return <div className="loader">Đang tải dữ liệu...</div>;
  }

  return (
    <div className="panel">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h2>Hóa đơn gần đây</h2>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            cursor: "pointer",
            fontSize: "0.85rem",
            color: "var(--text-muted)",
          }}
        >
          <input
            type="checkbox"
            checked={showAll}
            onChange={(event) => setShowAll(event.target.checked)}
            style={{ cursor: "pointer" }}
          />
          Hiện tất cả
        </label>
      </div>

      <InvoiceForm />

      {invoices.length === 0 ? (
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
                onClick={() => navigate(`/invoices/${invoice._id}`)}
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
    </div>
  );
}
