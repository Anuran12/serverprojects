"use client";

import { useMemo, useState } from "react";
import { formatDate } from "../lib/date";

const statusColumns = [
  { key: "NEW", label: "New Task" },
  { key: "IN_PROGRESS", label: "In Progress Task" },
  { key: "COMPLETED", label: "Complete Task" }
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

export default function AuditorsTaskView({ tasks, onStatusChange }) {
  const [pendingCompleteTask, setPendingCompleteTask] = useState(null);
  const columns = useMemo(() => {
    return statusColumns.map((col) => ({
      ...col,
      tasks: tasks.filter(
        (t) =>
          t.status === col.key ||
          (col.key === "IN_PROGRESS" && t.status === "OVERDUE")
      )
    }));
  }, [tasks]);
  const firstNewTask = columns.find((c) => c.key === "NEW")?.tasks?.[0] || null;

  return (
    <main className="app-shell view-auditors-task">
      <section className="view-header">
        <div>
          <h2 className="view-title">Auditors Task</h2>
          <p className="view-desc">
            View and manage tasks by status: New, In Progress, and Complete.
          </p>
        </div>
        <button
          type="button"
          className="btn-primary"
          disabled={!firstNewTask}
          onClick={() => {
            if (firstNewTask) onStatusChange(firstNewTask.id, "IN_PROGRESS");
          }}
        >
          Start
        </button>
      </section>
      <section className="kanban-grid">
        {columns.map((column) => (
          <article
            key={column.key}
            className="kanban-col"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              const taskId = Number(e.dataTransfer.getData("taskId"));
              onStatusChange(taskId, column.key);
            }}
          >
            <header>
              {column.label} <span>{column.tasks.length}</span>
            </header>
            <div className="cards">
              {column.tasks.map((task) => (
                <div
                  key={task.id}
                  draggable={task.status !== "COMPLETED"}
                  onDragStart={(e) =>
                    e.dataTransfer.setData("taskId", String(task.id))
                  }
                  className={`task-card ${task.status === "OVERDUE" ? "overdue" : ""}`}
                >
                  <div className="task-card-top">
                    <div />
                    {(task.status === "IN_PROGRESS" ||
                      task.status === "OVERDUE") && (
                      <button
                        type="button"
                        className="complete-tick-btn"
                        title="Complete task"
                        onClick={() => setPendingCompleteTask(task)}
                      >
                        ✓
                      </button>
                    )}
                  </div>
                  <strong>{task.title}</strong>
                  <p>{task.description}</p>
                  <div className="meta-row">
                    <span className={priorityClass(task.priority)}>
                      {task.priority}
                    </span>
                    <span>Due {formatDate(task.endDate)}</span>
                  </div>
                  <div className="assignees">
                    {task.assignees.map((a) => (
                      <span key={a.id}>{a.name}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </article>
        ))}
      </section>

      {pendingCompleteTask ? (
        <div className="modal-overlay" onClick={() => setPendingCompleteTask(null)}>
          <div
            className="modal-content confirm-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>Are you sure to complete the task?</h3>
            <p className="view-desc">{pendingCompleteTask.title}</p>
            <div className="form-actions">
              <button type="button" onClick={() => setPendingCompleteTask(null)}>
                No
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  onStatusChange(pendingCompleteTask.id, "COMPLETED");
                  setPendingCompleteTask(null);
                }}
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
