import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import DebtOverview from "./components/DebtOverview";
import ExpandableInvoiceItem from "./components/ExpandableInvoiceItem";
import ActiveInvoiceView from "./components/ActiveInvoiceView";
import "./App.css";

function App() {
  const users = useQuery(api.users.getAll);
  const invoices = useQuery(api.invoices.getWithStatus);

  const [activeInvoiceId, setActiveInvoiceId] = useState<Id<"invoices"> | null>(
    null,
  );
  const [showAll, setShowAll] = useState(false);

  const createInvoice = useMutation(api.invoices.create);
  const createUser = useMutation(api.users.create);

  // Invoice form state
  const [newStoreName, setNewStoreName] = useState("");
  const [newInvoiceAmount, setNewInvoiceAmount] = useState("");
  const [newInvoiceDate, setNewInvoiceDate] = useState(() =>
    new Date().toLocaleDateString("en-CA"),
  );

  // User form state
  const [newUserName, setNewUserName] = useState("");

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStoreName || !newInvoiceAmount || !newInvoiceDate) return;

    await createInvoice({
      store_name: newStoreName,
      paid_amount: Number(newInvoiceAmount) * 1000,
      date: newInvoiceDate,
    });

    setNewStoreName("");
    setNewInvoiceAmount("");
    setNewInvoiceDate(new Date().toLocaleDateString("en-CA"));
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName) return;

    await createUser({
      name: newUserName,
    });

    setNewUserName("");
  };

  if (users === undefined || invoices === undefined) {
    return <div className="loader">Đang tải dữ liệu...</div>;
  }

  // Active Invoice View
  if (activeInvoiceId) {
    const activeInvoice = invoices.find((inv) => inv._id === activeInvoiceId);
    const isAdjustmentInvoice =
      activeInvoice?.store_name.startsWith("Điều chỉnh nợ");
    return (
      <div className="app-container">
        <div className="header">
          <button className="back-btn" onClick={() => setActiveInvoiceId(null)}>
            ← Quay lại
          </button>
          <h1>
            {activeInvoice?.store_name} {isAdjustmentInvoice ? "📝" : "🍔"}
          </h1>
          {!isAdjustmentInvoice && (
            <p>
              Tổng hóa đơn:{" "}
              {activeInvoice?.paid_amount.toLocaleString("vi-VN")}đ
            </p>
          )}
        </div>

        <ActiveInvoiceView invoiceId={activeInvoiceId} users={users} invoice={activeInvoice} />
      </div>
    );
  }

  return (
    <div className="app-container">
      <div className="header">
        <h1>Lunch Ledger 🍔</h1>
      </div>

      <div className="dashboard-grid">
        {/* Full-width Debt Overview */}
        <div
          className="panel"
          style={{ gridColumn: "1 / -1", marginBottom: "1rem" }}
        >
          <DebtOverview />
        </div>

        {/* Right column / Invoices list */}
        <div className="panel">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2>Hóa đơn gần đây</h2>
            <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "0.85rem", color: "var(--text-muted)" }}>
              <input
                type="checkbox"
                checked={showAll}
                onChange={(e) => setShowAll(e.target.checked)}
                style={{ cursor: "pointer" }}
              />
              Hiện tất cả
            </label>
          </div>
          <form className="inline-form" onSubmit={handleCreateInvoice}>
            <input
              type="text"
              className="input-field"
              placeholder="Tên quán (vd: Cơm sườn)"
              value={newStoreName}
              onChange={(e) => setNewStoreName(e.target.value)}
              required
            />
            <input
              type="number"
              className="input-field"
              placeholder="Tổng tiền (đ)"
              value={newInvoiceAmount}
              onChange={(e) => setNewInvoiceAmount(e.target.value)}
              required
            />
            <input
              type="date"
              className="input-field"
              value={newInvoiceDate}
              onChange={(e) => setNewInvoiceDate(e.target.value)}
              required
            />
            <button type="submit" className="submit-btn small-btn">
              Thêm
            </button>
          </form>

          {(() => {
            if (!invoices || invoices.length === 0) {
              return <div className="empty-state">Chưa có hóa đơn nào</div>;
            }

            const filtered = showAll
              ? invoices
              : invoices.filter((inv) => inv.status !== "completed");

            if (filtered.length === 0) {
              return <div className="empty-state">Tất cả hóa đơn đã hoàn tất 🎉</div>;
            }

            return (
              <ul className="list-view">
                {filtered.map((invoice) => (
                  <ExpandableInvoiceItem
                    key={invoice._id}
                    invoice={invoice}
                    invoiceStatus={invoice.status}
                    onClick={() => setActiveInvoiceId(invoice._id)}
                  />
                ))}
              </ul>
            );
          })()}
        </div>

        {/* Left column / Users */}
        <div className="panel">
          <h2>Thành viên</h2>
          <form className="inline-form" onSubmit={handleCreateUser}>
            <input
              type="text"
              className="input-field"
              placeholder="Tên thành viên mới"
              value={newUserName}
              onChange={(e) => setNewUserName(e.target.value)}
              required
            />
            <button type="submit" className="submit-btn small-btn">
              Thêm
            </button>
          </form>

          {users.length === 0 ? (
            <div className="empty-state">Chưa có thành viên nào</div>
          ) : (
            <div className="user-chips">
              {users.map((user) => (
                <div key={user._id} className="user-chip">
                  👤 {user.name}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
