"use client";

import { useMemo } from "react";
import { formatDate } from "../lib/date";

const STATUS_COLUMNS = [
  { key: "INITIATED", label: "Initiated" },
  { key: "ASSIGNED", label: "Assigned" },
  { key: "INPROGRESS_DEVELOPMENT", label: "Inprogress - Development" },
  { key: "INPROGRESS_UAT", label: "Inprogress - UAT" },
  { key: "COMPLETED", label: "Completed" }
];

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

export default function DashboardView({ user, tasks, onOpenTask, onOpenCreateTask }) {
  const isCoeUser = user?.role === "AUDITOR" && user?.team === "COE";
  const counts = useMemo(() => {
    return {
      initiated: tasks.filter((t) => t.status === "INITIATED").length,
      active: tasks.filter(
        (t) => !["INITIATED", "COMPLETED"].includes(t.status)
      ).length,
      uat: tasks.filter((t) => t.status === "INPROGRESS_UAT").length,
      completed: tasks.filter((t) => t.status === "COMPLETED").length
    };
  }, [tasks]);

  const columns = useMemo(
    () =>
      STATUS_COLUMNS.map((column) => ({
        ...column,
        tasks: tasks.filter((task) => task.status === column.key)
      })),
    [tasks]
  );

  return (
    <main className="app-shell">
      <section className="summary-grid summary-grid-5">
        <article>
          <h3>{counts.initiated}</h3>
          <span>Initiated</span>
        </article>
        <article>
          <h3>{counts.active}</h3>
          <span>In Execution</span>
        </article>
        <article>
          <h3>{counts.uat}</h3>
          <span>Awaiting UAT</span>
        </article>
        <article>
          <h3>{counts.completed}</h3>
          <span>Completed</span>
        </article>
        <article>
          <h3>{tasks.length}</h3>
          <span>Total Visible</span>
        </article>
      </section>

      <section className="view-header">
        <div>
          <h2>Task Lifecycle Board</h2>
          <p className="view-desc">
            {isCoeUser
              ? "COE controls assignment and UAT governance."
              : "Track lifecycle progress and open a task page for actions."}
          </p>
        </div>
        <button type="button" className="btn-primary" onClick={onOpenCreateTask}>
          Initiate Task
        </button>
      </section>

      <section className="kanban-grid kanban-grid-5">
        {columns.map((column) => (
                <article key={column.key} className="kanban-col">
            <header className="kanban-head">
              <span className="kanban-head-left">{column.label} <strong>{column.tasks.length}</strong></span>
              <button
                type="button"
                className="see-all-btn"
                onClick={() => onOpenTask(null, column.key)}
              >
                See all
              </button>
            </header>
            <div className="cards">
              {column.tasks.length === 0 ? (
                <p className="empty-column">No tasks</p>
              ) : null}
              {column.tasks.slice(0, 5).map((task) => (
                <button
                  key={task.id}
                  type="button"
                  className={`task-card task-card-clickable ${task.isOverdue ? "overdue" : ""}`}
                  onClick={() => onOpenTask(task.id)}
                >
                  <strong>{task.title}</strong>
                  <p>{task.description}</p>
                  <div className="meta-row">
                    <span className={priorityClass(task.priority)}>{task.priority}</span>
                    <span>Due {formatDate(task.endDate)}</span>
                  </div>
                  <div className="task-sub-meta">
                    <span>{actorLabel(task)}</span>
                    {task.assignedByName ? <span>Assigned by {task.assignedByName}</span> : null}
                  </div>
                </button>
              ))}
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
