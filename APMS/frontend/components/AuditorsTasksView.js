"use client";

const TEAM_COLUMNS = [
  { team: "IT Audit", label: "IT Audit", short: "IT", tone: "sky" },
  { team: "Project Audit", label: "Project Audit", short: "PRJ", tone: "indigo" },
  { team: "System Audit", label: "System Audit", short: "SYS", tone: "violet" },
  { team: "COE", label: "COE", short: "COE", tone: "emerald" }
];

export default function AuditorsTasksView({ users, tasks, onOpenAuditor }) {
  const auditors = users.filter((u) => u.role === "AUDITOR" && u.isActive);

  function taskStats(auditorId) {
    const all = tasks.filter((t) => (t.assigneeIds || []).includes(auditorId));
    const current = all.filter((t) => t.status !== "COMPLETED");
    return { current: current.length, total: all.length };
  }

  return (
    <main className="app-shell apms-page">
      <header className="apms-page-header">
        <div>
          <h1 className="apms-page-title">Auditors & workload</h1>
          <p className="apms-page-subtitle">By team—open an auditor to see their task workspace.</p>
        </div>
      </header>

      <section className="auditors-kanban-grid apms-auditors-board">
        {TEAM_COLUMNS.map((col) => {
          const teamAuditors = auditors.filter((a) => a.team === col.team);
          return (
            <article
              key={col.team}
              className={`auditors-col auditors-col--${col.tone}`}
            >
              <header className="auditors-col-head">
                <div className="auditors-col-title">
                  <span className="auditors-col-dot" />
                  <div>
                    <span className="auditors-col-name">{col.label}</span>
                    <span className="auditors-col-short">{col.short}</span>
                  </div>
                </div>
                <span className="auditors-col-count">{teamAuditors.length}</span>
              </header>
              <div className="auditors-col-list">
                {teamAuditors.length === 0 ? (
                  <p className="empty-column">No auditors</p>
                ) : null}
                {teamAuditors.map((auditor) => {
                  const stats = taskStats(auditor.id);
                  return (
                    <button
                      key={auditor.id}
                      type="button"
                      className="auditor-card"
                      onClick={() => onOpenAuditor(auditor.id)}
                    >
                      <strong>{auditor.name}</strong>
                      <div className="auditor-card-stats">
                        <span>Current: {stats.current}</span>
                        <span>Total: {stats.total}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}

