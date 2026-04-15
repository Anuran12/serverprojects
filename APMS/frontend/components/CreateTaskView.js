"use client";

import { useRef, useState } from "react";

const ATTACHMENT_ACCEPT =
  ".pdf,.doc,.docx,.xls,.xlsx,.csv,.ppt,.pptx,.rtf,.txt,.png,.jpg,.jpeg,.gif,.webp,.bmp,.svg,.zip,.7z,image/*";

export default function CreateTaskView({ onCreateTask, embedded = false, onClose }) {
  const fileInputRef = useRef(null);
  const [attachmentFiles, setAttachmentFiles] = useState([]);
  const [form, setForm] = useState({
    title: "",
    description: "",
    priority: "MEDIUM",
    startDate: "",
    endDate: "",
    remarks: ""
  });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await onCreateTask({ ...form, files: attachmentFiles });
      setForm({
        title: "",
        description: "",
        priority: "MEDIUM",
        startDate: "",
        endDate: "",
        remarks: ""
      });
      setAttachmentFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } finally {
      setSaving(false);
    }
  }

  const content = (
    <>
      <div className="view-header view-header--inner apms-modal-head">
        <div>
          <h2 className="apms-inline-title" id="create-task-dialog-title">
            Initiate task
          </h2>
          <p className="view-desc apms-inline-desc">
            COE reviews and assigns every new lifecycle record.
          </p>
        </div>
        {embedded ? (
          <button type="button" className="apms-modal-close" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden>
              <path
                d="M18 6L6 18M6 6l12 12"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        ) : null}
      </div>

      <form className="form-grid form-create-task apms-modal-form" onSubmit={handleSubmit}>
          <div className="form-group full-width">
            <label>Task title</label>
            <input
              placeholder="Enter task title"
              value={form.title}
              onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))}
              required
            />
          </div>

          <div className="form-group">
            <label>Priority</label>
            <select
              value={form.priority}
              onChange={(e) => setForm((s) => ({ ...s, priority: e.target.value }))}
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </select>
          </div>

          <div className="form-group">
            <label>Start date</label>
            <input
              type="date"
              value={form.startDate}
              onChange={(e) => setForm((s) => ({ ...s, startDate: e.target.value }))}
              required
            />
          </div>

          <div className="form-group">
            <label>End date</label>
            <input
              type="date"
              value={form.endDate}
              onChange={(e) => setForm((s) => ({ ...s, endDate: e.target.value }))}
              required
            />
          </div>

          <div className="form-group full-width">
            <label>Description</label>
            <textarea
              placeholder="Describe scope, expected output, and constraints"
              value={form.description}
              onChange={(e) =>
                setForm((s) => ({ ...s, description: e.target.value }))
              }
            />
          </div>

          <div className="form-group full-width">
            <label>Initiator remarks</label>
            <textarea
              placeholder="Any business context for COE and assigned auditor"
              value={form.remarks}
              onChange={(e) => setForm((s) => ({ ...s, remarks: e.target.value }))}
            />
          </div>

          <div className="form-group full-width">
            <label>Attachments</label>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={ATTACHMENT_ACCEPT}
              className="file-input"
              onChange={(e) => setAttachmentFiles(Array.from(e.target.files || []))}
            />
            {attachmentFiles.length > 0 ? (
              <ul className="attachment-pick-list">
                {attachmentFiles.map((f) => (
                  <li key={`${f.name}-${f.size}`}>{f.name}</li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="form-group full-width form-actions apms-modal-actions">
            <button type="submit" className="btn-primary apms-modal-submit" disabled={saving}>
              {saving ? "Submitting…" : "Initiate task"}
            </button>
          </div>
      </form>
    </>
  );

  if (embedded) {
    return <section className="apms-create-task-embed">{content}</section>;
  }

  return (
    <main className="app-shell apms-page">
      <section className="enterprise-panel apms-panel">{content}</section>
    </main>
  );
}
