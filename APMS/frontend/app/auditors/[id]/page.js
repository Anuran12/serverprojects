"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar, { TAB } from "../../../components/Sidebar";
import LoginForm from "../../../components/LoginForm";
import { api } from "../../../lib/api";
import { formatDate } from "../../../lib/date";

const STATUS_COLUMNS = [
  { key: "INITIATED", label: "Initiated" },
  { key: "ASSIGNED", label: "Assigned" },
  { key: "INPROGRESS_DEVELOPMENT", label: "Inprogress - Development" },
  { key: "INPROGRESS_UAT", label: "Inprogress - UAT" },
  { key: "COMPLETED", label: "Completed" }
];

export default function AuditorPage({ params }) {
  const router = useRouter();
  const auditorId = Number(params?.id);

  const [token, setToken] = useState("");
  const [user, setUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const auditor = useMemo(() => users.find((u) => u.id === auditorId) || null, [users, auditorId]);
  const auditorTasks = useMemo(
    () => tasks.filter((t) => (t.assigneeIds || []).includes(auditorId)),
    [tasks, auditorId]
  );

  async function loadAll(activeToken) {
    if (!Number.isFinite(auditorId)) throw new Error("Invalid auditor id");
    const [me, userList, taskList, notifList] = await Promise.all([
      api("/me", {}, activeToken),
      api("/users", {}, activeToken),
      api("/tasks", {}, activeToken),
      api("/notifications", {}, activeToken)
    ]);
    setUser(me);
    setUsers(userList);
    setTasks(taskList);
    setNotifications(notifList);
  }

  async function handleLogin(email, password) {
    setLoading(true);
    setError("");
    try {
      const data = await api("/login", {
        method: "POST",
        body: JSON.stringify({ email, password })
      });
      setToken(data.token);
      localStorage.setItem("apms_token", data.token);
      await loadAll(data.token);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const stored = localStorage.getItem("apms_token");
    if (!stored) return;
    setToken(stored);
    loadAll(stored).catch((e) => setError(e.message || "Could not load auditor dashboard"));
  }, [auditorId]);

  function handleLogout() {
    setToken("");
    setUser(null);
    localStorage.removeItem("apms_token");
    router.push("/");
  }

  function handleSidebarTabChange(tab) {
    if (tab === TAB.AUDITORS_TASKS) {
      router.push("/?tab=auditors-tasks");
      return;
    }
    router.push(tab === TAB.DASHBOARD ? "/" : `/?tab=${tab}`);
  }

  if (!token || !user) {
    return <LoginForm onLogin={handleLogin} loading={loading} error={error} />;
  }

  if (user.role !== "MANAGER") {
    return (
      <main className="app-shell">
        <section className="enterprise-panel">
          <p className="view-desc">Only managers can access this page.</p>
          <button type="button" className="btn-ghost" onClick={() => router.push("/")}>Back</button>
        </section>
      </main>
    );
  }

  return (
    <div className="app-layout">
      <div className="main-with-sidebar">
        <Sidebar
          activeTab={TAB.AUDITORS_TASKS}
          onTabChange={handleSidebarTabChange}
          user={user}
          unreadNotificationCount={notifications.filter((n) => !n.isRead).length}
          onLogout={handleLogout}
        />
        <div className="content-area">
          <main className="app-shell">
            <section className="view-header">
              <div>
                <h2>{auditor ? `${auditor.name} - Task Dashboard` : "Auditor Task Dashboard"}</h2>
                <p className="view-desc">
                  {auditor ? `${auditor.team} team · Current ${auditorTasks.filter((t) => t.status !== "COMPLETED").length} · Total ${auditorTasks.length}` : "Loading auditor details..."}
                </p>
              </div>
              <button type="button" className="btn-ghost" onClick={() => router.push("/?tab=auditors-tasks")}>Back to Auditors Tasks</button>
            </section>

            <section className="kanban-grid kanban-grid-5">
              {STATUS_COLUMNS.map((column) => {
                const columnTasks = auditorTasks.filter((t) => t.status === column.key);
                return (
                  <article key={column.key} className="kanban-col">
                    <header className="kanban-head">
                      <span className="kanban-head-left">{column.label} <strong>{columnTasks.length}</strong></span>
                      <button
                        type="button"
                        className="see-all-btn"
                        onClick={() => router.push(`/tasks/status/${column.key}?auditorId=${auditorId}`)}
                      >
                        See all
                      </button>
                    </header>
                    <div className="cards">
                      {columnTasks.length === 0 ? <p className="empty-column">No tasks</p> : null}
                      {columnTasks.slice(0, 5).map((task) => (
                        <button
                          key={task.id}
                          type="button"
                          className={`task-card task-card-clickable ${task.isOverdue ? "overdue" : ""}`}
                          onClick={() => router.push(`/tasks/${task.id}`)}
                        >
                          <strong>{task.title}</strong>
                          <p>{task.description}</p>
                          <div className="task-sub-meta">
                            <span>Due {formatDate(task.endDate)}</span>
                            <span>Initiated by {task.createdByName || "-"}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </article>
                );
              })}
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}

