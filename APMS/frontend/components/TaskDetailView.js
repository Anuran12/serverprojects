"use client";

import {
  Fragment,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { api, fetchTaskAttachmentBlob } from "../lib/api";
import { formatDate, formatDateTime } from "../lib/date";

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

function statusLabel(status) {
  return (
    {
      INITIATED: "Initiated",
      ASSIGNED: "Assigned",
      INPROGRESS_DEVELOPMENT: "Development",
      INPROGRESS_UAT: "UAT",
      COMPLETED: "Completed",
    }[status] || status
  );
}

const AUDITOR_TEAM_ORDER = ["IT Audit", "Project Audit", "System Audit", "COE"];
const LIFECYCLE_STEPS = [
  { key: "INITIATED", label: "Initiated", short: "Init" },
  { key: "ASSIGNED", label: "Assigned", short: "Asgn" },
  { key: "INPROGRESS_DEVELOPMENT", label: "Development", short: "Dev" },
  { key: "INPROGRESS_UAT", label: "UAT", short: "UAT" },
  { key: "COMPLETED", label: "Completed", short: "Done" },
];

function stepRank(status) {
  return LIFECYCLE_STEPS.findIndex((s) => s.key === status);
}

function IconArrowLeft() {
  return (
    <svg
      className="task-detail-back-icon"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <path
        d="M15 18l-6-6 6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DetailRows({ rows }) {
  return (
    <dl className="task-detail-dl">
      {rows.map(([label, value]) => (
        <div key={label} className="task-detail-dl-row">
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
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
  onRefresh,
}) {
  const [selectedAuditorIds, setSelectedAuditorIds] = useState([]);
  const [remarks, setRemarks] = useState([]);
  const [remarkText, setRemarkText] = useState("");
  const [savingRemark, setSavingRemark] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const remarksEndRef = useRef(null);
  const remarksScrollBehaviorRef = useRef("auto");
  const [auditorModal, setAuditorModal] = useState(null);
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
    remarksScrollBehaviorRef.current = "auto";
  }, [task?.id]);

  useLayoutEffect(() => {
    remarksEndRef.current?.scrollIntoView({
      behavior: remarksScrollBehaviorRef.current,
      block: "end",
    });
  }, [remarks]);

  useEffect(() => {
    setSelectedAuditorIds((task?.assigneeIds || []).map(String));
  }, [task?.assigneeIds]);

  useEffect(() => {
    if (!auditorModal) return;
    function onKey(e) {
      if (e.key === "Escape") setAuditorModal(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [auditorModal]);

  function toggleAuditorSelection(id) {
    const key = String(id);
    setSelectedAuditorIds((prev) =>
      prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key],
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
  const canStart =
    task.status === "ASSIGNED" && user.id === task.assignedAuditorId;
  const canCompleteDev =
    task.status === "INPROGRESS_DEVELOPMENT" &&
    user.id === task.assignedAuditorId;

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
        token,
      );
      remarksScrollBehaviorRef.current = "smooth";
      setRemarks((prev) => [...prev, row]);
      setRemarkText("");
      await onRefresh();
    } finally {
      setSavingRemark(false);
    }
  }

  return (
    <main className="app-shell task-page task-page-enterprise apms-page task-detail-v2">
      <div className="task-enterprise-shell">
        <section className="enterprise-panel task-page-panel apms-panel task-detail-panel">
          <header className="task-hero apms-task-hero task-detail-hero">
            <div className="task-detail-hero-main">
              <div className="task-detail-kicker-row">
                <button
                  type="button"
                  className="task-detail-back"
                  onClick={onBack}
                >
                  <IconArrowLeft />
                  <span>Workspace</span>
                </button>
                <p className="task-detail-kicker">Task #{task.id}</p>
              </div>
              <h1 className="task-detail-title">{task.title}</h1>
              <p className="task-detail-desc">
                {task.description || "No description provided."}
              </p>
              <div className="task-detail-meta">
                <span className="task-detail-meta-pill">
                  <span className="task-detail-meta-key">Created</span>
                  {formatDateTime(task.createdAt)}
                </span>
                <span className="task-detail-meta-pill task-detail-meta-pill--due">
                  <span className="task-detail-meta-key">Due</span>
                  {formatDate(task.endDate)}
                </span>
              </div>
            </div>
            <div className="task-detail-badges">
              <span
                className={`task-detail-priority ${priorityClass(task.priority)}`}
              >
                {task.priority}
              </span>
              <span className="task-detail-status-chip">
                {statusLabel(task.status)}
              </span>
            </div>
          </header>

          <section className="task-enterprise-grid task-detail-grid task-detail-grid--full">
            <div className="task-main-col">
              <div className="task-grid task-grid-cards task-detail-metrics">
                <div className="task-info-card task-detail-card task-detail-card--sky">
                  <h3 className="task-detail-card-h">Ownership</h3>
                  <DetailRows
                    rows={[
                      ["Initiated by", task.createdByName || "—"],
                      ["Assigned by", task.assignedByName || "—"],
                      [
                        "Assigned auditors",
                        (task.assignees || []).length
                          ? task.assignees.map((a) => a.name).join(", ")
                          : "—",
                      ],
                      ["Managers", task.assignedAuditorManagerName || "—"],
                    ]}
                  />
                </div>

                <div className="task-info-card task-detail-card task-detail-card--indigo">
                  <h3 className="task-detail-card-h">Timeline</h3>
                  <DetailRows
                    rows={[
                      ["Start", formatDate(task.startDate)],
                      ["Due", formatDate(task.endDate)],
                      ["Created", formatDateTime(task.createdAt)],
                      ...(task.completedAt
                        ? [["Completed", formatDateTime(task.completedAt)]]
                        : []),
                    ]}
                  />
                </div>

                <div className="task-info-card task-detail-card task-detail-card--violet">
                  <h3 className="task-detail-card-h">UAT governance</h3>
                  <DetailRows
                    rows={[
                      [
                        "Initiator",
                        task.uatInitiatorApproved ? "Approved" : "Pending",
                      ],
                      ["COE", task.uatCoeApproved ? "Approved" : "Pending"],
                    ]}
                  />
                </div>
              </div>

              {task.remarks ? (
                <section className="task-section card-section task-detail-block">
                  <h3 className="task-detail-block-title">Initiator remarks</h3>
                  <p className="task-notes-text task-detail-remarks-body">
                    {task.remarks}
                  </p>
                </section>
              ) : null}

              <section className="task-section card-section task-detail-block">
                <h3 className="task-detail-block-title">Attachments</h3>
                {task.attachments?.length ? (
                  <ul className="task-attachment-list task-detail-attachments">
                    {task.attachments.map((att) => (
                      <li key={att.id}>
                        <span className="task-detail-att-name">
                          {att.originalName}
                        </span>
                        <button
                          type="button"
                          className="btn-link task-detail-att-btn"
                          disabled={downloadingId === att.id}
                          onClick={() => handleDownload(att)}
                        >
                          {downloadingId === att.id
                            ? "Downloading…"
                            : "Download"}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="task-detail-empty">No files attached</p>
                )}
              </section>
            </div>
          </section>
        </section>

        <aside
          className="task-workflow-rail task-workflow-rail-stack"
          aria-label="Workflow and remarks"
        >
          <div className="task-workflow-stack-workflow">
            <section className="task-section card-section task-action-panel task-action-panel-lower task-workflow-card task-workflow-card--compact">
              <div className="task-workflow-card-head">
                <h3 className="task-workflow-title">Workflow</h3>
                <p className="task-workflow-sub">Phase actions for your role</p>
              </div>
              <div className="task-workflow-card-body">
                {task.isOverdue ? (
                  <div className="workflow-overdue-alert task-detail-overdue">
                    <span className="task-detail-overdue-label">Past due</span>
                    <p
                      title={`Due ${formatDate(task.endDate)} — advance or complete soon.`}
                    >
                      Due {formatDate(task.endDate)} — advance or complete soon.
                    </p>
                  </div>
                ) : null}
                <div
                  className="workflow-progress task-detail-workflow wf-progress-horizontal"
                  role="group"
                  aria-label="Task lifecycle progress"
                >
                  <div className="wf-h-row">
                    {LIFECYCLE_STEPS.map((step, idx) => {
                      const completed =
                        idx < currentRank || task.status === "COMPLETED";
                      const active = idx === currentRank;
                      const isLast = idx === LIFECYCLE_STEPS.length - 1;
                      const segmentDone =
                        idx < currentRank || task.status === "COMPLETED";
                      return (
                        <Fragment key={step.key}>
                          <div
                            className={`wf-h-step ${completed ? "done" : ""} ${active ? "active" : ""}`}
                          >
                            <span className="wf-dot" aria-hidden>
                              {completed ? "✓" : ""}
                            </span>
                            <span
                              className="wf-label wf-label--compact"
                              title={step.label}
                            >
                              {step.short}
                            </span>
                          </div>
                          {!isLast ? (
                            <div
                              className={`wf-h-connector ${segmentDone ? "done" : ""}`}
                              aria-hidden
                            />
                          ) : null}
                        </Fragment>
                      );
                    })}
                  </div>
                  {Number(task.reassignCount || 0) > 0 ? (
                    <div className="wf-reassign-note">
                      Reassigned {task.reassignCount} time
                      {task.reassignCount > 1 ? "s" : ""}
                    </div>
                  ) : null}
                </div>
                <div className="task-actions-inline task-actions-stack task-workflow-actions">
                  {canAssign ? (
                    <button
                      type="button"
                      className="btn-primary task-workflow-open-assign"
                      onClick={() => setAuditorModal("assign")}
                    >
                      {selectedAuditorIds.length > 0
                        ? `Assign task (${selectedAuditorIds.length})`
                        : "Choose auditors"}
                    </button>
                  ) : null}

                  {canStart ? (
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => onStartDevelopment(task.id)}
                    >
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
                      <button
                        type="button"
                        className="btn-secondary task-workflow-open-assign"
                        onClick={() => setAuditorModal("reassign")}
                      >
                        {selectedAuditorIds.length > 0
                          ? `Reassign (${selectedAuditorIds.length})`
                          : "Choose auditors to reassign"}
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
            </section>
          </div>

          <div className="task-workflow-stack-remarks">
            <section className="task-section card-section task-remarks-panel task-detail-remarks-card task-detail-remarks-in-rail">
              <h3 className="task-detail-block-title">Remarks &amp; updates</h3>
              <div className="remarks-list remarks-list-scroll task-detail-remarks-scroll task-detail-remarks-chat">
                {remarks.length === 0 ? (
                  <p className="task-detail-empty">No remarks yet</p>
                ) : null}
                {remarks.map((r) => {
                  const mine =
                    user?.id != null &&
                    r.userId != null &&
                    Number(r.userId) === Number(user.id);
                  return (
                    <article
                      key={r.id}
                      className={`remark-chat-row ${mine ? "remark-chat-row--mine" : ""}`}
                    >
                      <div className="remark-chat-bubble">
                        <div className="remark-chat-meta">
                          <span className="remark-chat-author">
                            {r.authorName}
                          </span>
                          <time
                            className="remark-chat-time"
                            dateTime={r.createdAt}
                          >
                            {formatDateTime(r.createdAt)}
                          </time>
                        </div>
                        <p className="remark-chat-text">{r.body}</p>
                      </div>
                    </article>
                  );
                })}
                <div
                  ref={remarksEndRef}
                  className="remarks-chat-end"
                  aria-hidden
                />
              </div>
              <div className="remark-editor remark-editor-compact task-detail-remark-form">
                <textarea
                  value={remarkText}
                  onChange={(e) => setRemarkText(e.target.value)}
                  placeholder="Share a progress update…"
                />
                <button
                  type="button"
                  className="btn-primary task-detail-save-remark"
                  disabled={savingRemark || !remarkText.trim()}
                  onClick={handleSaveRemark}
                >
                  {savingRemark ? "Saving…" : "Save remark"}
                </button>
              </div>
            </section>
          </div>
        </aside>
      </div>

      {auditorModal ? (
        <div
          className="modal-overlay apms-modal-overlay"
          onClick={() => setAuditorModal(null)}
        >
          <div
            className="modal-content apms-modal task-assign-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="task-assign-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="apms-modal-head view-header--inner">
              <h3 className="apms-modal-title" id="task-assign-modal-title">
                {auditorModal === "reassign"
                  ? "Reassign to development"
                  : "Assign auditors"}
              </h3>
              <button
                type="button"
                className="apms-modal-close"
                onClick={() => setAuditorModal(null)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <p className="task-assign-modal-lead">
              {auditorModal === "reassign"
                ? "Select auditors to send back to development."
                : "Select one or more auditors for this task."}
            </p>
            <div className="task-assign-modal-body auditor-checklist">
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
                ),
              )}
            </div>
            <div className="form-actions apms-modal-actions task-assign-modal-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setAuditorModal(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary apms-modal-submit"
                disabled={selectedAuditorIds.length === 0}
                onClick={() => {
                  const ids = selectedAuditorIds.map(Number);
                  if (auditorModal === "assign") onAssign(task.id, ids);
                  else onReassignUat(task.id, ids);
                  setAuditorModal(null);
                }}
              >
                {auditorModal === "reassign"
                  ? "Reassign to development"
                  : "Assign task"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
