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
      <div className="view-header">
        <div>
          <h2>Initiate New Task</h2>
          <p className="view-desc">
            All initiated tasks are reviewed and assigned by COE.
          </p>
        </div>
        {embedded ? (
          <button type="button" className="btn-ghost" onClick={onClose}>
            Close
          </button>
        ) : null}
      </div>

      <form className="form-grid form-create-task" onSubmit={handleSubmit}>
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

          <div className="form-group full-width form-actions">
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Submitting..." : "Initiate Task"}
            </button>
          </div>
      </form>
    </>
  );

  if (embedded) {
    return <section className="enterprise-panel">{content}</section>;
  }

  return (
    <main className="app-shell">
      <section className="enterprise-panel">{content}</section>
    </main>
  );
}
