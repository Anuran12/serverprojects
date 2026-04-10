"use client";

const TEAM_COLUMNS = [
  { team: "IT Audit", label: "IT AUDIT" },
  { team: "Project Audit", label: "PROJECT AUDIT" },
  { team: "System Audit", label: "SYSTEM AUDIT" },
  { team: "COE", label: "COE TEAM" }
];

export default function AuditorsTasksView({ users, tasks, onOpenAuditor }) {
  const auditors = users.filter((u) => u.role === "AUDITOR" && u.isActive);

  function taskStats(auditorId) {
    const all = tasks.filter((t) => (t.assigneeIds || []).includes(auditorId));
    const current = all.filter((t) => t.status !== "COMPLETED");
    return { current: current.length, total: all.length };
  }

  return (
    <main className="app-shell">
      <section className="view-header">
        <div>
          <h2>Auditors Tasks</h2>
          <p className="view-desc">
            Monitor workload by audit team and open each auditor workspace.
          </p>
        </div>
      </section>

      <section className="auditors-kanban-grid">
        {TEAM_COLUMNS.map((col) => {
          const teamAuditors = auditors.filter((a) => a.team === col.team);
          return (
            <article key={col.team} className="auditors-col">
              <header>
                <span>{col.label}</span>
                <strong>{teamAuditors.length}</strong>
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

