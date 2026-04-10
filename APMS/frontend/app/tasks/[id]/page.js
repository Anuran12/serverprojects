"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar, { TAB } from "../../../components/Sidebar";
import LoginForm from "../../../components/LoginForm";
import TaskDetailView from "../../../components/TaskDetailView";
import { api } from "../../../lib/api";

export default function TaskPage({ params }) {
  const router = useRouter();
  const taskId = Number(params?.id);

  const [token, setToken] = useState("");
  const [user, setUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [task, setTask] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const auditors = useMemo(
    () => users.filter((u) => u.role === "AUDITOR" && u.isActive),
    [users]
  );

  async function loadTaskPage(activeToken) {
    if (!Number.isFinite(taskId)) throw new Error("Invalid task id");
    const [me, userList, taskRow, notifList] = await Promise.all([
      api("/me", {}, activeToken),
      api("/users", {}, activeToken),
      api(`/tasks/${taskId}`, {}, activeToken),
      api("/notifications", {}, activeToken)
    ]);
    setUser(me);
    setUsers(userList);
    setTask(taskRow);
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
      await loadTaskPage(data.token);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function refreshTask() {
    if (!token || !Number.isFinite(taskId)) return;
    setTask(await api(`/tasks/${taskId}`, {}, token));
  }

  async function runAction(path, body) {
    if (!token || !Number.isFinite(taskId)) return;
    await api(path, body ? { method: "PATCH", body: JSON.stringify(body) } : { method: "PATCH" }, token);
    await refreshTask();
  }

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
    router.push(`/?tab=${tab}`);
  }

  useEffect(() => {
    const stored = localStorage.getItem("apms_token");
    if (!stored) return;
    setToken(stored);
    loadTaskPage(stored).catch((e) => setError(e.message || "Could not load task"));
  }, [taskId]);

  if (!token || !user) {
    return <LoginForm onLogin={handleLogin} loading={loading} error={error} />;
  }

  if (!task) {
    return (
      <main className="app-shell">
        <section className="enterprise-panel">
          <p className="view-desc">{error || "Loading task..."}</p>
          <button type="button" className="btn-ghost" onClick={() => router.push("/")}>
            Back to workspace
          </button>
        </section>
      </main>
    );
  }

  return (
    <div className="app-layout">
      <div className="main-with-sidebar">
        <Sidebar
          activeTab={TAB.DASHBOARD}
          onTabChange={handleSidebarTabChange}
          user={user}
          unreadNotificationCount={notifications.filter((n) => !n.isRead).length}
          onLogout={handleLogout}
        />
        <div className="content-area">
          <TaskDetailView
            user={user}
            token={token}
            task={task}
            auditors={auditors}
            onBack={() => router.push("/")}
      onAssign={(id, assigneeIds) => runAction(`/tasks/${id}/assign`, { assigneeIds })}
            onStartDevelopment={(id) => runAction(`/tasks/${id}/start-development`)}
            onCompleteDevelopment={(id) => runAction(`/tasks/${id}/development-complete`)}
            onApproveUat={(id) => runAction(`/tasks/${id}/uat-approve`)}
      onReassignUat={(id, assigneeIds) => runAction(`/tasks/${id}/uat-reassign`, { assigneeIds })}
            onRefresh={refreshTask}
          />
        </div>
      </div>
    </div>
  );
}
