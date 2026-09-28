import DebtOverview from "../../features/debts/components/DebtOverview";
import InvoiceList from "../../features/invoices/components/InvoiceList";

export default function DashboardPage() {
  return (
    <div className="dashboard-grid">
      <div
        className="panel"
        style={{ gridColumn: "1 / -1", marginBottom: "1rem" }}
      >
        <DebtOverview />
      </div>
      <InvoiceList />
    </div>
  );
}
