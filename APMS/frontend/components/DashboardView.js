"use client";

import { useMemo } from "react";
import { formatDate } from "../lib/date";

const STATUS_COLUMNS = [
  { key: "INITIATED", label: "Initiated", short: "New", tone: "sky" },
  { key: "ASSIGNED", label: "Assigned", short: "Queue", tone: "indigo" },
  {
    key: "INPROGRESS_DEVELOPMENT",
    label: "In progress · Dev",
    short: "Dev",
    tone: "violet",
  },
  {
    key: "INPROGRESS_UAT",
    label: "In progress · UAT",
    short: "UAT",
    tone: "amber",
  },
  { key: "COMPLETED", label: "Completed", short: "Done", tone: "emerald" },
];

function priorityClass(priority) {
  return (
    {
      LOW: "p-low",
      MEDIUM: "p-medium",
      HIGH: "p-high",
      CRITICAL: "p-critical",
    }[priority] || "p-medium"
  );
}

function IconPlus() {
  return (
    <svg
      className="workspace-btn-icon"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconChevron() {
  return (
    <svg
      className="workspace-col-chevron"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <path
        d="M9 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const STAT_CONFIG = [
  { key: "initiated", label: "Initiated", sub: "Awaiting assignment" },
  { key: "active", label: "In execution", sub: "Active workstreams" },
  { key: "uat", label: "Awaiting UAT", sub: "User acceptance" },
  { key: "completed", label: "Completed", sub: "Closed this view" },
  { key: "total", label: "Total visible", sub: "Across all stages" },
];

export default function DashboardView({
  user,
  tasks,
  onOpenCreateTask,
  onOpenTask,
}) {
  const counts = useMemo(() => {
    return {
      initiated: tasks.filter((t) => t.status === "INITIATED").length,
      active: tasks.filter(
        (t) => !["INITIATED", "COMPLETED"].includes(t.status),
      ).length,
      uat: tasks.filter((t) => t.status === "INPROGRESS_UAT").length,
      completed: tasks.filter((t) => t.status === "COMPLETED").length,
      total: tasks.length,
    };
  }, [tasks]);

  const columns = useMemo(
    () =>
      STATUS_COLUMNS.map((column) => ({
        ...column,
        tasks: tasks.filter((task) => task.status === column.key),
      })),
    [tasks],
  );

  const roleLabel = (user?.role || "USER").replace(/_/g, " ");

  return (
    <main className="app-shell task-workspace">
      <header className="workspace-hero-v2 workspace-hero-v2--compact">
        <div className="workspace-hero-v2-bg" aria-hidden />
        <div className="workspace-hero-v2-inner">
          <div className="workspace-hero-v2-copy">
            <h1 className="workspace-hero-h1">Task lifecycle workspace</h1>
            <div className="workspace-hero-meta">
              <span className="workspace-pill workspace-pill--role">
                <span className="workspace-pill-dot" />
                {roleLabel}
              </span>
              <span className="workspace-pill workspace-pill--muted">
                {tasks.length} task{tasks.length === 1 ? "" : "s"} in scope
              </span>
            </div>
          </div>
          <div className="workspace-hero-actions">
            <button
              type="button"
              className="workspace-btn-primary"
              onClick={onOpenCreateTask}
            >
              <IconPlus />
              Initiate task
            </button>
          </div>
        </div>
      </header>

      <section className="workspace-stats" aria-label="Pipeline summary">
        {STAT_CONFIG.map((row) => {
          const value = row.key === "total" ? counts.total : counts[row.key];
          return (
            <article key={row.key} className="workspace-stat-card">
              <div className="workspace-stat-top">
                <span className="workspace-stat-label">{row.label}</span>
                <span className="workspace-stat-value">{value}</span>
              </div>
              <p className="workspace-stat-sub">{row.sub}</p>
            </article>
          );
        })}
      </section>

      <section className="workspace-board-wrap">
        <div className="workspace-board-head">
          <h2 className="workspace-board-title">Lifecycle board</h2>
        </div>

        <div className="workspace-kanban">
          {columns.map((column) => (
            <article
              key={column.key}
              className={`workspace-col workspace-col--${column.tone}`}
            >
              <header className="workspace-col-head">
                <div className="workspace-col-title-row">
                  <span className="workspace-col-dot" />
                  <div className="workspace-col-titles">
                    <span className="workspace-col-name">{column.label}</span>
                    <span className="workspace-col-short">{column.short}</span>
                  </div>
                </div>
                <div className="workspace-col-actions">
                  <span className="workspace-col-count">
                    {column.tasks.length}
                  </span>
                  <button
                    type="button"
                    className="workspace-see-all"
                    onClick={() => onOpenTask(null, column.key)}
                  >
                    View all
                    <IconChevron />
                  </button>
                </div>
              </header>

              <div className="workspace-col-body">
                {column.tasks.length === 0 ? (
                  <div className="workspace-empty">
                    <span className="workspace-empty-title">No tasks yet</span>
                    <span className="workspace-empty-desc">
                      Items appear here as they enter this stage.
                    </span>
                  </div>
                ) : null}

                {column.tasks.slice(0, 5).map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    className={`workspace-task-card ${task.isOverdue ? "workspace-task-card--overdue" : ""}`}
                    onClick={() => onOpenTask(task.id)}
                  >
                    <div className="workspace-task-card-top">
                      <span
                        className={`workspace-priority ${priorityClass(task.priority)}`}
                      >
                        {task.priority}
                      </span>
                      {task.isOverdue ? (
                        <span className="workspace-overdue-tag">Past due</span>
                      ) : null}
                    </div>
                    <span className="workspace-task-title">{task.title}</span>
                    <div className="workspace-task-footer workspace-task-footer--solo">
                      <span className="workspace-task-due">
                        <span className="workspace-task-due-label">Due</span>
                        {formatDate(task.endDate)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
