"use client";

import { useEffect, useMemo, useState } from "react";
import { api, fetchTaskAttachmentBlob } from "../lib/api";
import { formatDate, formatDateTime } from "../lib/date";

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

function statusLabel(status) {
  return (
    {
      INITIATED: "Initiated",
      ASSIGNED: "Assigned",
      INPROGRESS_DEVELOPMENT: "Inprogress - Development",
      INPROGRESS_UAT: "Inprogress - UAT",
      COMPLETED: "Completed"
    }[status] || status
  );
}

const AUDITOR_TEAM_ORDER = ["IT Audit", "Project Audit", "System Audit", "COE"];
const LIFECYCLE_STEPS = [
  { key: "INITIATED", label: "Initiated" },
  { key: "ASSIGNED", label: "Assigned" },
  { key: "INPROGRESS_DEVELOPMENT", label: "Inprogress - Development" },
  { key: "INPROGRESS_UAT", label: "Inprogress - UAT" },
  { key: "COMPLETED", label: "Completed" }
];

function stepRank(status) {
  return LIFECYCLE_STEPS.findIndex((s) => s.key === status);
}

export default function TaskDetailView({
  user,
  token,
  task,
  auditors,
  onBack,
  onAssign,
  onStartDevelopment,
  onCompleteDevelopment,
  onApproveUat,
  onReassignUat,
  onRefresh
}) {
  const [selectedAuditorIds, setSelectedAuditorIds] = useState([]);
  const [remarks, setRemarks] = useState([]);
  const [remarkText, setRemarkText] = useState("");
  const [savingRemark, setSavingRemark] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const isCoe = user.role === "AUDITOR" && user.team === "COE";

  useEffect(() => {
    if (!task?.id || !token) return;
    let cancelled = false;
    (async () => {
      try {
        const rows = await api(`/tasks/${task.id}/remarks`, {}, token);
        if (!cancelled) setRemarks(Array.isArray(rows) ? rows : []);
      } catch {
        if (!cancelled) setRemarks([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [task?.id, token]);

  useEffect(() => {
    setSelectedAuditorIds((task?.assigneeIds || []).map(String));
  }, [task?.assigneeIds]);

  function toggleAuditorSelection(id) {
    const key = String(id);
    setSelectedAuditorIds((prev) =>
      prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key]
    );
  }

  const auditorsByTeam = useMemo(() => {
    const groups = {};
    for (const team of AUDITOR_TEAM_ORDER) groups[team] = [];
    for (const a of auditors) {
      if (!groups[a.team]) groups[a.team] = [];
      groups[a.team].push(a);
    }
    return groups;
  }, [auditors]);

  const canAssign = isCoe && task.status === "INITIATED";
  const canStart = task.status === "ASSIGNED" && user.id === task.assignedAuditorId;
  const canCompleteDev =
    task.status === "INPROGRESS_DEVELOPMENT" && user.id === task.assignedAuditorId;

  const isInitiator = user.id === task.createdBy;
  const canUatAct = task.status === "INPROGRESS_UAT" && (isInitiator || isCoe);

  const myApprovalDone = useMemo(() => {
    // If user is initiator (even if also COE), initiator approval controls this button.
    if (isInitiator) return Boolean(task.uatInitiatorApproved);
    if (isCoe) return Boolean(task.uatCoeApproved);
    return false;
  }, [isInitiator, isCoe, task.uatCoeApproved, task.uatInitiatorApproved]);

  const currentRank = stepRank(task.status);

  async function handleDownload(att) {
    if (!token || !task?.id) return;
    setDownloadingId(att.id);
    try {
      const blob = await fetchTaskAttachmentBlob(task.id, att.id, token);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = att.originalName || "attachment";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } finally {
      setDownloadingId(null);
    }
  }

  async function handleSaveRemark() {
    const body = remarkText.trim();
    if (!body) return;
    setSavingRemark(true);
    try {
      const row = await api(
        `/tasks/${task.id}/remarks`,
        { method: "POST", body: JSON.stringify({ body }) },
        token
      );
      setRemarks((prev) => [...prev, row]);
      setRemarkText("");
      await onRefresh();
    } finally {
      setSavingRemark(false);
    }
  }

  return (
    <main className="app-shell task-page task-page-enterprise">
      <div className="task-enterprise-shell">
        <section className="enterprise-panel task-page-panel">
          <header className="task-hero">
            <div className="task-hero-main">
              <button type="button" className="btn-ghost" onClick={onBack}>
                Back to workspace
              </button>
              <h2 className="task-page-title">{task.title}</h2>
              <p className="task-page-desc">{task.description || "No description provided."}</p>
              <div className="task-hero-meta">
                <span>Task #{task.id}</span>
                <span>Created {formatDateTime(task.createdAt)}</span>
                <span>Due {formatDate(task.endDate)}</span>
              </div>
            </div>
            <div className="task-page-status-row">
              <span className={priorityClass(task.priority)}>{task.priority}</span>
              <span className="status-chip">{statusLabel(task.status)}</span>
            </div>
          </header>

          <section className="task-enterprise-grid">
            <div className="task-main-col">
              <div className="task-grid task-grid-cards">
                <div className="task-info-card">
                  <h3>Ownership</h3>
                  <p><strong>Initiated by:</strong> {task.createdByName || "-"}</p>
                  <p><strong>Assigned by:</strong> {task.assignedByName || "-"}</p>
                  <p><strong>Assigned auditors:</strong> {(task.assignees || []).length ? task.assignees.map((a) => a.name).join(", ") : "-"}</p>
                  <p><strong>Managers:</strong> {task.assignedAuditorManagerName || "-"}</p>
                </div>

                <div className="task-info-card">
                  <h3>Timeline</h3>
                  <p><strong>Start:</strong> {formatDate(task.startDate)}</p>
                  <p><strong>Due:</strong> {formatDate(task.endDate)}</p>
                  <p><strong>Created:</strong> {formatDateTime(task.createdAt)}</p>
                  {task.completedAt ? (
                    <p><strong>Completed:</strong> {formatDateTime(task.completedAt)}</p>
                  ) : null}
                </div>

                <div className="task-info-card">
                  <h3>UAT Governance</h3>
                  <p><strong>Initiator:</strong> {task.uatInitiatorApproved ? "Approved" : "Pending"}</p>
                  <p><strong>COE:</strong> {task.uatCoeApproved ? "Approved" : "Pending"}</p>
                </div>
              </div>

              {task.remarks ? (
                <section className="task-section card-section">
                  <h3>Initiator Remarks</h3>
                  <p className="task-notes-text">{task.remarks}</p>
                </section>
              ) : null}

              <section className="task-section card-section">
                <h3>Attachments</h3>
                {task.attachments?.length ? (
                  <ul className="task-attachment-list">
                    {task.attachments.map((att) => (
                      <li key={att.id}>
                        <span>{att.originalName}</span>
                        <button
                          type="button"
                          className="btn-link"
                          disabled={downloadingId === att.id}
                          onClick={() => handleDownload(att)}
                        >
                          {downloadingId === att.id ? "Downloading..." : "Download"}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="view-desc">No attachments</p>
                )}
              </section>
            </div>

            <aside className="task-action-col">
              <section className="task-section card-section task-remarks-panel">
                <h3>Remarks & Updates</h3>
                <div className="remarks-list remarks-list-scroll">
                  {remarks.length === 0 ? <p className="view-desc">No remarks yet</p> : null}
                  {remarks.map((r) => (
                    <article key={r.id} className="remark-item">
                      <div className="remark-item-head">
                        <strong>{r.authorName}</strong>
                        <small>{formatDateTime(r.createdAt)}</small>
                      </div>
                      <p>{r.body}</p>
                    </article>
                  ))}
                </div>
                <div className="remark-editor remark-editor-compact">
                  <textarea
                    value={remarkText}
                    onChange={(e) => setRemarkText(e.target.value)}
                    placeholder="Write a progress update for this task"
                  />
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={savingRemark || !remarkText.trim()}
                    onClick={handleSaveRemark}
                  >
                    {savingRemark ? "Saving..." : "Save Remark"}
                  </button>
                </div>
              </section>
            </aside>
          </section>
        </section>

        <aside className="task-workflow-rail" aria-label="Workflow actions">
            <section className="task-section card-section task-action-panel task-action-panel-lower">
              <h3>Workflow Actions</h3>
              {task.isOverdue ? (
                <div className="workflow-overdue-alert">
                  <strong>Overdue alert:</strong> Due date ({formatDate(task.endDate)}) has passed.
                  Please complete this task immediately.
                </div>
              ) : null}
              <div className="workflow-progress">
                {LIFECYCLE_STEPS.map((step, idx) => {
                  const completed = idx < currentRank || task.status === "COMPLETED";
                  const active = idx === currentRank;
                  return (
                    <div key={step.key} className={`wf-step ${completed ? "done" : ""} ${active ? "active" : ""}`}>
                      <span className="wf-dot" aria-hidden>{completed ? "v" : ""}</span>
                      <span className="wf-label">{step.label}</span>
                    </div>
                  );
                })}
                {Number(task.reassignCount || 0) > 0 ? (
                  <div className="wf-reassign-note">
                    Reassigned {task.reassignCount} time{task.reassignCount > 1 ? "s" : ""}
                  </div>
                ) : null}
              </div>
              <div className="task-actions-inline task-actions-stack">
                {canAssign ? (
                  <>
                    <div className="auditor-checklist">
                      {Object.entries(auditorsByTeam).map(([team, list]) =>
                        list.length === 0 ? null : (
                          <div key={team} className="auditor-checklist-group">
                            <div className="auditor-checklist-title">{team}</div>
                            {list.map((a) => (
                              <label key={a.id} className="auditor-checklist-row">
                                <input
                                  type="checkbox"
                                  checked={selectedAuditorIds.includes(String(a.id))}
                                  onChange={() => toggleAuditorSelection(a.id)}
                                />
                                <span>{a.name}</span>
                              </label>
                            ))}
                          </div>
                        )
                      )}
                    </div>
                    <button
                      type="button"
                      className="btn-primary"
                    disabled={selectedAuditorIds.length === 0}
                    onClick={() => onAssign(task.id, selectedAuditorIds.map(Number))}
                  >
                    Assign Task
                  </button>
                </>
              ) : null}

              {canStart ? (
                <button type="button" className="btn-primary" onClick={() => onStartDevelopment(task.id)}>
                  Start Development
                </button>
              ) : null}

              {canCompleteDev ? (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => onCompleteDevelopment(task.id)}
                >
                  Development Complete
                </button>
              ) : null}

                {canUatAct ? (
                  <>
                    <button
                    type="button"
                    className="btn-primary"
                    disabled={myApprovalDone}
                    onClick={() => onApproveUat(task.id)}
                  >
                      {myApprovalDone ? "Approved" : "Approve UAT"}
                    </button>
                    <div className="auditor-checklist">
                      {Object.entries(auditorsByTeam).map(([team, list]) =>
                        list.length === 0 ? null : (
                          <div key={team} className="auditor-checklist-group">
                            <div className="auditor-checklist-title">{team}</div>
                            {list.map((a) => (
                              <label key={a.id} className="auditor-checklist-row">
                                <input
                                  type="checkbox"
                                  checked={selectedAuditorIds.includes(String(a.id))}
                                  onChange={() => toggleAuditorSelection(a.id)}
                                />
                                <span>{a.name}</span>
                              </label>
                            ))}
                          </div>
                        )
                      )}
                    </div>
                    <button
                      type="button"
                      className="btn-secondary"
                    disabled={selectedAuditorIds.length === 0}
                    onClick={() => onReassignUat(task.id, selectedAuditorIds.map(Number))}
                  >
                    Reassign to Development
                  </button>
                </>
              ) : null}

              {!canAssign && !canStart && !canCompleteDev && !canUatAct ? (
                <p className="view-desc">No actions available for your role in this phase.</p>
              ) : null}
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}

