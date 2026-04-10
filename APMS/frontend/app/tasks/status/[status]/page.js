"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Sidebar, { TAB } from "../../../../components/Sidebar";
import LoginForm from "../../../../components/LoginForm";
import { api } from "../../../../lib/api";
import { formatDate } from "../../../../lib/date";

const PAGE_SIZE = 10;

const STATUS_MAP = {
  INITIATED: "Initiated",
  ASSIGNED: "Assigned",
  INPROGRESS_DEVELOPMENT: "Inprogress - Development",
  INPROGRESS_UAT: "Inprogress - UAT",
  COMPLETED: "Completed"
};

function priorityClass(priority) {
  return (
    {
      LOW: "p-low",
      MEDIUM: "p-medium",
      HIGH: "p-high",
      CRITICAL: "p-critical"
    }[priority] || "p-medium"
  );
}

function actorLabel(task) {
  if (task.status === "INITIATED") {
    return `Initiated by ${task.createdByName || "Unknown"}`;
  }
  if (task.assignees?.length) {
    return `Assigned to ${task.assignees.map((a) => a.name).join(", ")}`;
  }
  return "Pending assignment";
}

function normalizeStatus(value) {
  const raw = String(value || "").trim().toUpperCase();
  if (!raw) return "";
  if (raw === "NEW") return "INITIATED";
  if (raw === "IN_PROGRESS" || raw === "OVERDUE") return "INPROGRESS_DEVELOPMENT";
  return raw;
}

export default function StatusTasksPage() {
  const router = useRouter();
  const routeParams = useParams();
  const statusKey = normalizeStatus(routeParams?.status);

  const [token, setToken] = useState("");
  const [user, setUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [auditorFilterId, setAuditorFilterId] = useState(null);
  const [page, setPage] = useState(1);

  const statusLabel = STATUS_MAP[statusKey] || statusKey || "Unknown";

  async function loadAll(activeToken) {
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
    loadAll(stored).catch((e) => setError(e.message || "Could not load tasks"));
  }, [statusKey]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const rawAuditorId = params.get("auditorId");
    const aid = rawAuditorId == null || rawAuditorId === "" ? NaN : Number(rawAuditorId);
    setAuditorFilterId(Number.isFinite(aid) ? aid : null);
    setPage(1);
  }, [statusKey]);

  const filtered = useMemo(() => {
    let rows = tasks.filter((t) => normalizeStatus(t.status) === statusKey);
    if (auditorFilterId != null) {
      rows = rows.filter((t) => (t.assigneeIds || []).includes(auditorFilterId));
    }
    return rows;
  }, [tasks, statusKey, auditorFilterId]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);

  const pagedTasks = useMemo(() => {
    const from = (currentPage - 1) * PAGE_SIZE;
    return filtered.slice(from, from + PAGE_SIZE);
  }, [filtered, currentPage]);

  const auditor = auditorFilterId != null ? users.find((u) => u.id === auditorFilterId) : null;

  function handleLogout() {
    setToken("");
    setUser(null);
    localStorage.removeItem("apms_token");
    router.push("/");
  }

  function handleSidebarTabChange(tab) {
    if (tab === TAB.DASHBOARD) {
      router.push("/");
      return;
    }
    if (tab === TAB.AUDITORS_TASKS) {
      router.push("/?tab=auditors-tasks");
      return;
    }
    router.push(`/?tab=${tab}`);
  }

  function goBack() {
    if (auditorFilterId != null) {
      router.push(`/auditors/${auditorFilterId}`);
      return;
    }
    router.push("/");
  }

  if (!token || !user) {
    return <LoginForm onLogin={handleLogin} loading={loading} error={error} />;
  }

  return (
    <div className="app-layout">
      <div className="main-with-sidebar">
        <Sidebar
          activeTab={auditorFilterId != null ? TAB.AUDITORS_TASKS : TAB.DASHBOARD}
          onTabChange={handleSidebarTabChange}
          user={user}
          unreadNotificationCount={notifications.filter((n) => !n.isRead).length}
          onLogout={handleLogout}
        />

        <div className="content-area">
          <main className="app-shell">
            <section className="view-header">
              <div>
                <h2>{statusLabel} Tasks</h2>
                <p className="view-desc">
                  {auditor ? `${auditor.name} (${auditor.team}) · ` : ""}
                  {filtered.length} task(s)
                </p>
              </div>
              <button type="button" className="btn-ghost" onClick={goBack}>Back</button>
            </section>

            <section className="enterprise-panel">
              <div className="status-task-list">
                {pagedTasks.length === 0 ? (
                  <p className="view-desc">No tasks in this status.</p>
                ) : (
                  <div className="status-task-grid">
                    {pagedTasks.map((task) => (
                      <button
                        key={task.id}
                        type="button"
                        className={`task-card task-card-clickable status-task-card ${task.isOverdue ? "overdue" : ""}`}
                        onClick={() => router.push(`/tasks/${task.id}`)}
                      >
                        <div className="status-task-head">
                          <strong>{task.title}</strong>
                          {task.isOverdue ? (
                            <span className="overdue-flag-chip" title="Task overdue">
                              FLAG
                            </span>
                          ) : null}
                        </div>
                        <p>{task.description}</p>
                        <div className="meta-row">
                          <span className={priorityClass(task.priority)}>{task.priority}</span>
                          <span>Due {formatDate(task.endDate)}</span>
                        </div>
                        <div className="task-sub-meta">
                          <span>{actorLabel(task)}</span>
                          {task.assignedByName ? (
                            <span>Assigned by {task.assignedByName}</span>
                          ) : null}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="status-pager">
                <button
                  type="button"
                  className="btn-ghost"
                  disabled={currentPage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </button>
                <span>Page {currentPage} of {totalPages}</span>
                <button
                  type="button"
                  className="btn-ghost"
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </button>
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}
