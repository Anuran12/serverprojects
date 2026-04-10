"use client";

export const TAB = {
  DASHBOARD: "dashboard",
  AUDITORS_TASKS: "auditors-tasks",
  NOTIFICATIONS: "notifications",
  USER_MANAGEMENT: "user-management"
};

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
    { id: TAB.DASHBOARD, label: "Task Workspace" },
    ...(isManager ? [{ id: TAB.AUDITORS_TASKS, label: "Auditors Tasks" }] : []),
    {
      id: TAB.NOTIFICATIONS,
      label: "Notifications",
      badge: unreadNotificationCount > 0 ? unreadNotificationCount : null
    },
    ...(isAdmin ? [{ id: TAB.USER_MANAGEMENT, label: "User Management" }] : [])
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h1>APMS</h1>
        <p>{user?.name}</p>
      </div>
      <nav className="sidebar-nav">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`sidebar-tab ${activeTab === tab.id ? "active" : ""}`}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.label}
            {tab.badge != null ? (
              <span className="sidebar-notif-badge">{tab.badge}</span>
            ) : null}
          </button>
        ))}
      </nav>
      <div className="sidebar-footer">
        <button type="button" className="sidebar-logout" onClick={onLogout}>
          Logout
        </button>
      </div>
    </aside>
  );
}
