"use client";

export const TAB = {
  DASHBOARD: "dashboard",
  AUDITORS_TASKS: "auditors-tasks",
  NOTIFICATIONS: "notifications",
  USER_MANAGEMENT: "user-management"
};

function IconNav({ name }) {
  const cls = "sidebar-tab-icon";
  switch (name) {
    case "workspace":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden>
          <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      );
    case "auditors":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "bell":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M18 8A6 6 0 106 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "users":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M4 20a8 8 0 0116 0"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      );
    default:
      return null;
  }
}

export default function Sidebar({
  activeTab,
  onTabChange,
  user,
  unreadNotificationCount = 0,
  onLogout
}) {
  const role = user?.role || "";
  const isAdmin = role === "ADMIN";
  const isManager = role === "MANAGER";

  const tabs = [
    { id: TAB.DASHBOARD, label: "Task Workspace", icon: "workspace" },
    ...(isManager
      ? [{ id: TAB.AUDITORS_TASKS, label: "Auditors Tasks", icon: "auditors" }]
      : []),
    {
      id: TAB.NOTIFICATIONS,
      label: "Notifications",
      icon: "bell",
      badge: unreadNotificationCount > 0 ? unreadNotificationCount : null
    },
    ...(isAdmin
      ? [{ id: TAB.USER_MANAGEMENT, label: "User Management", icon: "users" }]
      : [])
  ];

  return (
    <aside className="sidebar apms-sidebar">
      <div className="sidebar-header">
        <div className="sidebar-brand-row">
          <div className="sidebar-brand-mark" aria-hidden>
            <span>AP</span>
          </div>
          <div className="sidebar-brand-text">
            <h1>APMS</h1>
            <p className="sidebar-user">{user?.name}</p>
          </div>
        </div>
        <span className="sidebar-role-pill">{role || "USER"}</span>
      </div>
      <nav className="sidebar-nav" aria-label="Main">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`sidebar-tab ${activeTab === tab.id ? "active" : ""}`}
            onClick={() => onTabChange(tab.id)}
          >
            <span className="sidebar-tab-main">
              <IconNav name={tab.icon} />
              <span className="sidebar-tab-label">{tab.label}</span>
            </span>
            {tab.badge != null ? (
              <span className="sidebar-notif-badge">{tab.badge}</span>
            ) : null}
          </button>
        ))}
      </nav>
      <div className="sidebar-footer">
        <button type="button" className="sidebar-logout" onClick={onLogout}>
          <svg className="sidebar-logout-icon" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Logout
        </button>
      </div>
    </aside>
  );
}
