import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";

const navigationItems = [
  { label: "Dashboard", to: "/", icon: "◫", section: "overview" },
  { label: "Thành viên", to: "/users", icon: "♙", section: "users" },
  { label: "Configuration", to: "/settings/teams", icon: "⚙", section: "teams" },
] as const;

type Section = (typeof navigationItems)[number]["section"];

const pageMetaBySection: Record<Section, { title: string; description: string }> = {
  overview: {
    title: "Theo dõi bữa trưa",
    description: "Tổng hợp hóa đơn và khoản nợ của cả nhóm.",
  },
  users: {
    title: "Quản lý thành viên",
    description: "Theo dõi thành viên và thông tin liên hệ trong workspace.",
  },
  teams: {
    title: "Cấu hình kênh Teams",
    description: "Chọn channel nhận thông báo nhắc nợ từ Power Automate.",
  },
};

function getActiveSection(pathname: string): Section {
  if (pathname === "/users" || pathname.startsWith("/users/")) {
    return "users";
  }
  if (pathname === "/settings/teams") {
    return "teams";
  }
  return "overview";
}

export default function AppLayout() {
  const { pathname } = useLocation();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const activeSection = getActiveSection(pathname);
  const pageMeta = pageMetaBySection[activeSection];

  return (
    <div className={`app-shell${isSidebarCollapsed ? " is-collapsed" : ""}`}>
      <aside className="app-sidebar">
        <div className="app-sidebar-header">
          <NavLink className="app-brand" to="/" aria-label="Lunch Ledger, về tổng quan">
            <span className="app-brand-mark" aria-hidden="true">L</span>
            <span className="app-brand-copy">
              <strong>Lunch Ledger</strong>
              <small>Quản lý bữa trưa</small>
            </span>
          </NavLink>
          <button
            type="button"
            className="app-sidebar-toggle"
            onClick={() => setIsSidebarCollapsed((collapsed) => !collapsed)}
            aria-label={isSidebarCollapsed ? "Mở rộng thanh điều hướng" : "Thu gọn thanh điều hướng"}
            aria-expanded={!isSidebarCollapsed}
            title={isSidebarCollapsed ? "Mở rộng thanh điều hướng" : "Thu gọn thanh điều hướng"}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="3.5" y="4" width="17" height="16" rx="2.5" />
              <path d="M9 4v16" />
              {isSidebarCollapsed
                ? <path d="m12 9 3 3-3 3" />
                : <path d="m15 9-3 3 3 3" />}
            </svg>
          </button>
        </div>

        <div className="app-sidebar-label">Không gian làm việc</div>
        <nav className="app-nav" aria-label="Điều hướng chính">
          {navigationItems.map((item) => {
            const active = activeSection === item.section;

            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={`app-nav-link${active ? " active" : ""}`}
                aria-current={active ? "page" : undefined}
              >
                <span className="app-nav-icon" aria-hidden="true">{item.icon}</span>
                <span className="app-nav-label">{item.label}</span>
                {active && <span className="app-nav-indicator" aria-hidden="true" />}
              </NavLink>
            );
          })}
        </nav>

        <div className="app-sidebar-footer">
          <span className="app-status-dot" aria-hidden="true" />
          <span>Không gian cá nhân</span>
        </div>
      </aside>

      <div className="app-main">
        <header className="app-topbar">
          <div className="app-topbar-copy">
            <h1 className="app-topbar-title">{pageMeta.title}</h1>
            <p className="app-topbar-subtitle">{pageMeta.description}</p>
          </div>
        </header>
        <main className="app-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
