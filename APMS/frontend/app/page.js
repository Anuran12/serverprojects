"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { io } from "socket.io-client";
import Sidebar, { TAB } from "../components/Sidebar";
import DashboardView from "../components/DashboardView";
import AuditorsTasksView from "../components/AuditorsTasksView";
import CreateTaskView from "../components/CreateTaskView";
import NotificationsView from "../components/NotificationsView";
import UserManagementView from "../components/UserManagementView";
import LoginForm from "../components/LoginForm";
import { api, apiForm } from "../lib/api";

const SOCKET_BASE =
  process.env.NEXT_PUBLIC_SOCKET_BASE || "http://localhost:4001";
const SOCKET_PATH = process.env.NEXT_PUBLIC_SOCKET_PATH || "/socket.io";

export default function HomePage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [user, setUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState(TAB.DASHBOARD);
  const [createTaskOpen, setCreateTaskOpen] = useState(false);

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

  async function refreshTasks() {
    if (!token) return;
    setTasks(await api("/tasks", {}, token));
  }

  async function refreshUsers() {
    if (!token) return;
    setUsers(await api("/users", {}, token));
  }

  async function handleInitiateTask(form) {
    if (!token) throw new Error("Not signed in");
    const { files = [], ...fields } = form;
    const fd = new FormData();
    fd.append("title", fields.title || "");
    fd.append("description", fields.description || "");
    fd.append("priority", fields.priority || "MEDIUM");
    fd.append("startDate", fields.startDate || "");
    fd.append("endDate", fields.endDate || "");
    fd.append("remarks", fields.remarks || "");
    for (const file of files) fd.append("attachments", file);
    await apiForm("/tasks", { method: "POST", body: fd }, token);
    await refreshTasks();
    setCreateTaskOpen(false);
    setActiveTab(TAB.DASHBOARD);
  }

  async function handleMarkAll() {
    if (!token) return;
    await api("/notifications/read-all", { method: "PATCH" }, token);
    setNotifications(await api("/notifications", {}, token));
  }

  async function handleAddUser(payload) {
    if (!token) return;
    await api(
      "/users",
      {
        method: "POST",
        body: JSON.stringify({
          name: payload.name,
          email: payload.email,
          password: payload.password,
          team: payload.team,
          role: payload.role,
          managerId: payload.managerId ?? null
        })
      },
      token
    );
    await refreshUsers();
  }

  async function handleUpdateUser(userId, payload) {
    if (!token) return;
    await api(`/users/${userId}`, { method: "PATCH", body: JSON.stringify(payload) }, token);
    await refreshUsers();
  }

  async function handleToggleActive(userId, isActive) {
    if (!token) return;
    await api(`/users/${userId}`, { method: "PATCH", body: JSON.stringify({ isActive }) }, token);
    await refreshUsers();
  }

  useEffect(() => {
    const stored = localStorage.getItem("apms_token");
    if (!stored) return;
    setToken(stored);
    loadAll(stored).catch(() => {
      localStorage.removeItem("apms_token");
      setToken("");
    });
  }, []);

  useEffect(() => {
    if (!token) return;
    const socket = io(SOCKET_BASE, {
      auth: { token },
      path: SOCKET_PATH,
      transports: ["websocket"]
    });
    socket.on("notification:new", (payload) => {
      setNotifications((prev) => [payload, ...prev]);
    });
    return () => socket.disconnect();
  }, [token]);

  useEffect(() => {
    const syncTabFromUrl = () => {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get("tab");
      if (
        tab === TAB.NOTIFICATIONS ||
        tab === TAB.USER_MANAGEMENT ||
        tab === TAB.AUDITORS_TASKS
      ) {
        setActiveTab(tab);
        return;
      }
      setActiveTab(TAB.DASHBOARD);
    };

    syncTabFromUrl();
    window.addEventListener("popstate", syncTabFromUrl);
    return () => window.removeEventListener("popstate", syncTabFromUrl);
  }, []);

  function handleLogout() {
    setToken("");
    setUser(null);
    localStorage.removeItem("apms_token");
  }

  function renderContent() {
    switch (activeTab) {
      case TAB.DASHBOARD:
        return (
          <DashboardView
            user={user}
            tasks={tasks}
            onOpenTask={(id, statusKey) => {
              if (statusKey) {
                router.push(`/tasks/status/${statusKey}`);
                return;
              }
              if (id != null) router.push(`/tasks/${id}`);
            }}
            onOpenCreateTask={() => setCreateTaskOpen(true)}
          />
        );
      case TAB.AUDITORS_TASKS:
        if (user?.role !== "MANAGER") {
          return (
            <DashboardView
              user={user}
              tasks={tasks}
              onOpenTask={(id, statusKey) => {
                if (statusKey) {
                  router.push(`/tasks/status/${statusKey}`);
                  return;
                }
                if (id != null) router.push(`/tasks/${id}`);
              }}
              onOpenCreateTask={() => setCreateTaskOpen(true)}
            />
          );
        }
        return (
          <AuditorsTasksView
            users={users}
            tasks={tasks}
            onOpenAuditor={(id) => router.push(`/auditors/${id}`)}
          />
        );
      case TAB.NOTIFICATIONS:
        return <NotificationsView notifications={notifications} onMarkAll={handleMarkAll} />;
      case TAB.USER_MANAGEMENT:
        return (
          <UserManagementView
            users={users}
            onAddUser={handleAddUser}
            onUpdateUser={handleUpdateUser}
            onToggleActive={handleToggleActive}
          />
        );
      default:
        return (
          <DashboardView
            user={user}
            tasks={tasks}
            onOpenTask={(id, statusKey) => {
              if (statusKey) {
                router.push(`/tasks/status/${statusKey}`);
                return;
              }
              if (id != null) router.push(`/tasks/${id}`);
            }}
            onOpenCreateTask={() => setCreateTaskOpen(true)}
          />
        );
    }
  }

  return !token || !user ? (
    <LoginForm onLogin={handleLogin} loading={loading} error={error} />
  ) : (
    <div className="app-layout">
      <div className="main-with-sidebar">
        <Sidebar
          activeTab={activeTab}
          onTabChange={(tab) => {
            setCreateTaskOpen(false);
            setActiveTab(tab);
            router.push(tab === TAB.DASHBOARD ? "/" : `/?tab=${tab}`);
          }}
          user={user}
          unreadNotificationCount={notifications.filter((n) => !n.isRead).length}
          onLogout={handleLogout}
        />
        <div className="content-area">{renderContent()}</div>
        {createTaskOpen ? (
          <div className="modal-overlay apms-modal-overlay" onClick={() => setCreateTaskOpen(false)}>
            <div
              className="modal-content apms-modal create-task-modal-shell"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="create-task-dialog-title"
            >
              <CreateTaskView
                embedded
                onClose={() => setCreateTaskOpen(false)}
                onCreateTask={handleInitiateTask}
              />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
