import { Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import "../App.css";
import AppLayout from "./components/AppLayout";
import DashboardPage from "./pages/DashboardPage";
import UsersPage from "../features/users/pages/UsersPage";
import TeamsSettingsPage from "../features/teams/pages/TeamsSettingsPage";

export default function App() {
  return (
    <>
      <Toaster theme="dark" richColors position="top-right" />
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/settings/teams" element={<TeamsSettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
