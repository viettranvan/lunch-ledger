import { useQuery } from "convex/react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import OrdersEditor from "../../orders/components/OrdersEditor";

export default function InvoiceDetailPage() {
  const { invoiceId } = useParams();
  const id = invoiceId as Id<"invoices">;
  const invoice = useQuery(api.features.invoices.queries.getById, { id });
  const users = useQuery(api.features.users.queries.getActive);

  if (invoice === undefined || users === undefined) {
    return <div className="loader">Đang tải dữ liệu...</div>;
  }

  if (!invoice) {
    return (
      <div className="panel">
        <h2>Không tìm thấy hóa đơn</h2>
        <Link className="back-btn" to="/">
          ← Quay lại
        </Link>
      </div>
    );
  }

  const isAdjustmentInvoice = invoice.store_name.startsWith("Điều chỉnh nợ");

  return (
    <main>
      <div className="header invoice-page-header">
        <Link className="back-btn" to="/">
          ← Quay lại
        </Link>
        <h1>
          {invoice.store_name} {isAdjustmentInvoice ? "📝" : "🍔"}
        </h1>
        {!isAdjustmentInvoice && (
          <p> Tổng hóa đơn: {invoice.paid_amount.toLocaleString("vi-VN")}đ</p>
        )}
      </div>

      <OrdersEditor invoiceId={id} users={users} invoice={invoice} />
    </main>
  );
}
