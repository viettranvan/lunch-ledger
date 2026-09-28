import { Navigate, Route, Routes } from "react-router-dom";
import "../App.css";
import AppLayout from "./components/AppLayout";
import DashboardPage from "./pages/DashboardPage";
import InvoiceDetailPage from "../features/invoices/pages/InvoiceDetailPage";
import UsersPage from "../features/users/pages/UsersPage";
import TeamsSettingsPage from "../features/teams/pages/TeamsSettingsPage";

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/users" element={<UsersPage />} />
        <Route path="/settings/teams" element={<TeamsSettingsPage />} />
        <Route path="/invoices/:invoiceId" element={<InvoiceDetailPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
