"use client";

import { useMemo, useState } from "react";
import { formatDate } from "../lib/date";

const statusColumns = [
  { key: "NEW", label: "New Tasks" },
  { key: "IN_PROGRESS", label: "In Progress" },
  { key: "COMPLETED", label: "Completed" }
];

function priorityClass(priority) {
  return {
    LOW: "p-low",
    MEDIUM: "p-medium",
    HIGH: "p-high",
    CRITICAL: "p-critical"
  }[priority] || "p-medium";
}

export default function Dashboard({ user, users, tasks, onStatusChange, onCreateTask }) {
  const [form, setForm] = useState({
    title: "",
    description: "",
    priority: "MEDIUM",
    startDate: "",
    endDate: "",
    assigneeIds: []
  });

  const counts = useMemo(() => {
    const active = tasks.filter((t) => t.status !== "COMPLETED").length;
    const overdue = tasks.filter((t) => t.status === "OVERDUE").length;
    const dueSoon = tasks.filter((t) => {
      const d = new Date(t.endDate).getTime() - Date.now();
      return d > 0 && d < 1000 * 60 * 60 * 48;
    }).length;
    const doneWeek = tasks.filter((t) => t.status === "COMPLETED").length;
    return { active, overdue, dueSoon, doneWeek };
  }, [tasks]);

  return (
    <main className="app-shell">
      <section className="summary-grid">
        <article><h3>{counts.active}</h3><span>Total Active Tasks</span></article>
        <article><h3>{counts.overdue}</h3><span>Overdue Tasks</span></article>
        <article><h3>{counts.dueSoon}</h3><span>Due Soon (48h)</span></article>
        <article><h3>{counts.doneWeek}</h3><span>Completed</span></article>
      </section>

      {(user.role === "MANAGER" || user.role === "ADMIN") && (
        <section className="create-panel">
          <h2>Create Task</h2>
          <div className="form-grid">
            <input placeholder="Project title" value={form.title} onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))} />
            <select value={form.priority} onChange={(e) => setForm((s) => ({ ...s, priority: e.target.value }))}>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </select>
            <input type="date" value={form.startDate} onChange={(e) => setForm((s) => ({ ...s, startDate: e.target.value }))} />
            <input type="date" value={form.endDate} onChange={(e) => setForm((s) => ({ ...s, endDate: e.target.value }))} />
            <textarea placeholder="Task description" value={form.description} onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))} />
            <select
              multiple
              value={form.assigneeIds.map(String)}
              onChange={(e) => {
                const selected = Array.from(e.target.selectedOptions).map((o) => Number(o.value));
                setForm((s) => ({ ...s, assigneeIds: selected }));
              }}
            >
              {users
                .filter((u) => u.role === "AUDITOR")
                .map((u) => (
                  <option key={u.id} value={u.id}>{u.name} ({u.team})</option>
                ))}
            </select>
          </div>
          <button
            onClick={() => {
              onCreateTask(form);
              setForm({ title: "", description: "", priority: "MEDIUM", startDate: "", endDate: "", assigneeIds: [] });
            }}
          >
            Assign Task
          </button>
        </section>
      )}

      <section className="kanban-grid">
        {statusColumns.map((column) => {
          const columnTasks = tasks.filter((t) => t.status === column.key || (column.key === "IN_PROGRESS" && t.status === "OVERDUE"));
          return (
            <article
              key={column.key}
              className="kanban-col"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                const taskId = Number(e.dataTransfer.getData("taskId"));
                onStatusChange(taskId, column.key);
              }}
            >
              <header>{column.label} <span>{columnTasks.length}</span></header>
              <div className="cards">
                {columnTasks.map((task) => (
                  <div
                    key={task.id}
                    draggable={task.status !== "COMPLETED"}
                    onDragStart={(e) => e.dataTransfer.setData("taskId", String(task.id))}
                    className={`task-card ${task.status === "OVERDUE" ? "overdue" : ""}`}
                  >
                    <strong>{task.title}</strong>
                    <p>{task.description}</p>
                    <div className="meta-row">
                      <span className={priorityClass(task.priority)}>{task.priority}</span>
                      <span>Due {formatDate(task.endDate)}</span>
                    </div>
                    <div className="assignees">
                      {task.assignees.map((a) => (
                        <span key={a.id}>{a.name}</span>
                      ))}
                    </div>
                    {task.status !== "COMPLETED" ? (
                      <div className="actions">
                        {task.status === "NEW" && <button onClick={() => onStatusChange(task.id, "IN_PROGRESS")}>Start</button>}
                        {(task.status === "IN_PROGRESS" || task.status === "OVERDUE") && (
                          <button onClick={() => onStatusChange(task.id, "COMPLETED")}>Complete</button>
                        )}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}
