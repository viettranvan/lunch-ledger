import { Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { useQuery } from "convex/react";
import type { ReactNode } from "react";
import { api } from "../../convex/_generated/api";
import "../App.css";
import AppLayout from "./components/AppLayout";
import DashboardPage from "./pages/DashboardPage";
import UsersPage from "../features/users/pages/UsersPage";
import TeamsSettingsPage from "../features/teams/pages/TeamsSettingsPage";
import SignInPage from "../features/auth/SignInPage";

function EditorRoute({ children }: { children: ReactNode }) {
  const isEditor = useQuery(api.auth.isEditorQuery);
  if (isEditor === undefined) {
    return <div className="auth-route-loading" role="status">Đang kiểm tra quyền truy cập…</div>;
  }
  return isEditor ? children : <Navigate to="/" replace />;
}

export default function App() {
  return (
    <>
      <Toaster theme="dark" richColors position="top-right" />
      <Routes>
        <Route path="/login" element={<SignInPage />} />
        <Route element={<AppLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/users" element={<EditorRoute><UsersPage /></EditorRoute>} />
          <Route path="/settings/teams" element={<EditorRoute><TeamsSettingsPage /></EditorRoute>} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
