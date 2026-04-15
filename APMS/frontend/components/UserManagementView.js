"use client";

import { useMemo, useState } from "react";

const TEAM_OPTIONS = [
  { value: "IT Audit", label: "IT Audit" },
  { value: "Project Audit", label: "Project Audit" },
  { value: "System Audit", label: "System Audit" },
  { value: "COE", label: "COE Team" }
];

const VALID_ROLES = ["ADMIN", "MANAGER", "AUDITOR"];

function parseCsvLine(line) {
  const cells = [];
  let value = "";
  let quoted = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        value += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (ch === "," && !quoted) {
      cells.push(value.trim());
      value = "";
      continue;
    }
    value += ch;
  }
  cells.push(value.trim());
  return cells;
}

function parseCsvText(text) {
  const lines = String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return { error: "CSV must include header and at least one data row." };
  }

  const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
  const expected = ["name", "email", "password", "team", "role", "manageremail"];
  const missing = expected.filter((field) => !headers.includes(field));
  if (missing.length) {
    return { error: `Missing header(s): ${missing.join(", ")}` };
  }

  const rows = [];
  for (let i = 1; i < lines.length; i += 1) {
    const values = parseCsvLine(lines[i]);
    const row = {};
    for (let j = 0; j < headers.length; j += 1) {
      row[headers[j]] = (values[j] || "").trim();
    }
    rows.push({
      line: i + 1,
      name: row.name || "",
      email: (row.email || "").toLowerCase(),
      password: row.password || "",
      team: row.team || "",
      role: (row.role || "").toUpperCase(),
      managerEmail: (row.manageremail || "").toLowerCase()
    });
  }
  return { rows };
}

export default function UserManagementView({
  users,
  onAddUser,
  onUpdateUser,
  onToggleActive,
  onBulkAddUsers
}) {
  const [showForm, setShowForm] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkResult, setBulkResult] = useState(null);
  const [bulkError, setBulkError] = useState("");
  const [bulkPreviewRows, setBulkPreviewRows] = useState([]);
  const [bulkSourceName, setBulkSourceName] = useState("");
  const [duplicatesIgnored, setDuplicatesIgnored] = useState(0);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    team: "",
    role: "AUDITOR",
    managerId: ""
  });

  const managers = users.filter((u) => u.role === "MANAGER");

  const previewSummary = useMemo(() => {
    const ready = bulkPreviewRows.filter((r) => r.status === "ready").length;
    const failed = bulkPreviewRows.length - ready;
    return { ready, failed };
  }, [bulkPreviewRows]);

  function openAdd() {
    setEditingUser(null);
    setForm({
      name: "",
      email: "",
      password: "",
      team: TEAM_OPTIONS[0].value,
      role: "AUDITOR",
      managerId: managers[0]?.id ?? ""
    });
    setShowForm(true);
  }

  function openEdit(user) {
    setEditingUser(user);
    setForm({
      name: user.name,
      email: user.email,
      password: "",
      team: user.team,
      role: user.role,
      managerId: user.managerId ?? ""
    });
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingUser(null);
  }

  function openBulkModal() {
    setBulkResult(null);
    setBulkError("");
    setBulkPreviewRows([]);
    setBulkSourceName("");
    setDuplicatesIgnored(0);
    setShowBulkModal(true);
  }

  function closeBulkModal() {
    setShowBulkModal(false);
    setBulkUploading(false);
    setBulkResult(null);
    setBulkError("");
    setBulkPreviewRows([]);
    setBulkSourceName("");
    setDuplicatesIgnored(0);
  }

  function handleDownloadSample() {
    const sample = [
      "name,email,password,team,role,managerEmail",
      "John Auditor,john.auditor@example.com,Welcome@123,IT Audit,AUDITOR,manager@itc.in"
    ].join("\n");
    const blob = new Blob([sample], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "apms_bulk_users_sample.csv";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  async function handleBulkFileChange(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setBulkError("");
    setBulkResult(null);
    setBulkPreviewRows([]);
    setBulkSourceName(file.name);
    setDuplicatesIgnored(0);

    const parsed = parseCsvText(await file.text());
    if (parsed.error) {
      setBulkError(parsed.error);
      return;
    }

    const existingByEmail = new Map(users.map((u) => [String(u.email || "").toLowerCase(), u]));
    const seen = new Set();
    let duplicateCount = 0;
    const uniqueRows = [];

    for (const row of parsed.rows) {
      if (seen.has(row.email)) {
        duplicateCount += 1;
        continue;
      }
      seen.add(row.email);
      uniqueRows.push(row);
    }

    const preview = uniqueRows.map((row) => {
      if (!row.name || !row.email || !row.password || !row.team || !row.role) {
        return { ...row, status: "failed", reason: "Missing required value(s)" };
      }
      if (!VALID_ROLES.includes(row.role)) {
        return { ...row, status: "failed", reason: "Invalid role" };
      }
      if (!TEAM_OPTIONS.some((team) => team.value === row.team)) {
        return { ...row, status: "failed", reason: "Invalid team" };
      }
      if (existingByEmail.has(row.email)) {
        return { ...row, status: "failed", reason: "Email already exists" };
      }
      if (row.role === "AUDITOR") {
        if (!row.managerEmail) {
          return { ...row, status: "failed", reason: "managerEmail is required for AUDITOR" };
        }
        const manager = existingByEmail.get(row.managerEmail);
        if (!manager || manager.role !== "MANAGER" || !manager.isActive) {
          return { ...row, status: "failed", reason: "managerEmail does not exist as active MANAGER" };
        }
      }
      return { ...row, status: "ready", reason: "Ready to upload" };
    });

    setDuplicatesIgnored(duplicateCount);
    setBulkPreviewRows(preview);
  }

  async function handleUploadPreviewedUsers() {
    const validUsers = bulkPreviewRows
      .filter((row) => row.status === "ready")
      .map((row) => ({
        line: row.line,
        name: row.name,
        email: row.email,
        password: row.password,
        team: row.team,
        role: row.role,
        managerEmail: row.managerEmail
      }));

    if (!validUsers.length) {
      setBulkError("No valid users to upload.");
      return;
    }

    setBulkUploading(true);
    setBulkError("");
    setBulkResult(null);
    try {
      const result = await onBulkAddUsers(validUsers);
      setBulkResult(result);
      setBulkPreviewRows([]);
      setDuplicatesIgnored(0);
    } catch (err) {
      setBulkError(err.message || "Bulk upload failed");
    } finally {
      setBulkUploading(false);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (editingUser) {
      const payload = {
        name: form.name,
        email: form.email,
        team: form.team,
        role: form.role,
        managerId:
          form.role === "AUDITOR" ? (form.managerId ? Number(form.managerId) : null) : null
      };
      if (form.password) payload.password = form.password;
      onUpdateUser(editingUser.id, payload);
    } else {
      onAddUser({
        name: form.name,
        email: form.email,
        password: form.password,
        team: form.team,
        role: form.role,
        managerId: form.role === "AUDITOR" ? Number(form.managerId) : null
      });
    }
    closeForm();
  }

  return (
    <main className="app-shell apms-page view-user-management">
      <header className="apms-page-header">
        <div>
          <h1 className="apms-page-title">User management</h1>
          <p className="apms-page-subtitle">Provision users, teams, and access roles.</p>
        </div>
        <div className="user-actions">
          <button type="button" className="btn-secondary apms-header-btn" onClick={openBulkModal}>
            Bulk Add Users
          </button>
          <button type="button" className="btn-primary apms-header-btn" onClick={openAdd}>
            Add user
          </button>
        </div>
      </header>

      <section className="apms-panel user-list-wrap">
        <table className="user-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Team</th>
              <th>Role</th>
              <th>Manager</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className={!u.isActive ? "inactive" : ""}>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td>{u.team}</td>
                <td>{u.role}</td>
                <td>{u.managerName ?? "-"}</td>
                <td>
                  <span
                    className={`status-badge ${u.isActive ? "active" : "inactive"}`}
                  >
                    {u.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td>
                  <button
                    type="button"
                    className="btn-sm btn-secondary"
                    onClick={() => openEdit(u)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn-sm btn-ghost"
                    onClick={() => onToggleActive(u.id, !u.isActive)}
                  >
                    {u.isActive ? "Deactivate" : "Activate"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {showForm && (
        <div className="modal-overlay apms-modal-overlay" onClick={closeForm}>
          <div
            className="modal-content apms-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="apms-modal-title">{editingUser ? "Edit user" : "Add user"}</h3>
            <form onSubmit={handleSubmit} className="user-form">
              <div className="form-group">
                <label>Username</label>
                <input
                  value={form.name}
                  onChange={(e) =>
                    setForm((s) => ({ ...s, name: e.target.value }))}
                  required
                  placeholder="Display name"
                />
              </div>
              <div className="form-group">
                <label>Mail ID</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) =>
                    setForm((s) => ({ ...s, email: e.target.value }))}
                  required
                  placeholder="email@example.com"
                  readOnly={!!editingUser}
                />
              </div>
              <div className="form-group">
                <label>Password {editingUser && "(leave blank to keep)"}</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) =>
                    setForm((s) => ({ ...s, password: e.target.value }))}
                  required={!editingUser}
                  placeholder={editingUser ? "********" : ""}
                />
              </div>
              <div className="form-group">
                <label>Team</label>
                <select
                  value={form.team}
                  onChange={(e) =>
                    setForm((s) => ({ ...s, team: e.target.value }))}
                  required
                >
                  {TEAM_OPTIONS.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Role</label>
                <select
                  value={form.role}
                  onChange={(e) =>
                    setForm((s) => ({
                      ...s,
                      role: e.target.value,
                      managerId:
                        e.target.value === "AUDITOR"
                          ? managers[0]?.id ?? ""
                          : ""
                    }))}
                >
                  <option value="ADMIN">Admin</option>
                  <option value="MANAGER">Manager</option>
                  <option value="AUDITOR">Auditor</option>
                </select>
              </div>
              {form.role === "AUDITOR" && (
                <div className="form-group">
                  <label>Manager (reports to)</label>
                  <select
                    value={form.managerId}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, managerId: e.target.value }))}
                    required={form.role === "AUDITOR"}
                  >
                    <option value="">Select manager</option>
                    {managers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.team})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="form-actions">
                <button type="button" className="btn-ghost" onClick={closeForm}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {editingUser ? "Update" : "Create"} User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showBulkModal && (
        <div className="modal-overlay apms-modal-overlay" onClick={closeBulkModal}>
          <div
            className="modal-content apms-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="apms-modal-title">Bulk Add Users</h3>
            <p className="view-desc">
              1) Download sample 2) Upload CSV 3) Review unique users 4) Upload ready users.
            </p>
            <div className="form-actions">
              <button type="button" className="btn-ghost" onClick={handleDownloadSample}>
                Download Sample CSV
              </button>
              <label className="btn-primary bulk-upload-btn">
                Upload CSV
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleBulkFileChange}
                  disabled={bulkUploading}
                />
              </label>
            </div>

            {bulkSourceName ? (
              <p className="view-desc bulk-file-name">Previewing: {bulkSourceName}</p>
            ) : null}

            {duplicatesIgnored > 0 ? (
              <p className="view-desc">Ignored duplicate emails in CSV: {duplicatesIgnored}</p>
            ) : null}

            {bulkPreviewRows.length > 0 ? (
              <div className="bulk-preview-wrap">
                <p className="bulk-preview-summary">
                  Ready: <strong>{previewSummary.ready}</strong> | Failed: <strong>{previewSummary.failed}</strong>
                </p>
                <div className="bulk-preview-list">
                  {bulkPreviewRows.map((row) => (
                    <div key={`${row.email}-${row.line}`} className="bulk-preview-row">
                      <div>
                        <strong>{row.name}</strong>
                        <p>{row.email}</p>
                      </div>
                      <div>
                        <span>{row.role}</span>
                        <span>{row.team}</span>
                      </div>
                      <div>
                        <span className={`status-badge ${row.status === "ready" ? "active" : "inactive"}`}>
                          {row.status === "ready" ? "Ready" : "Failed"}
                        </span>
                        {row.status !== "ready" ? <small>{row.reason}</small> : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {bulkError ? <p className="error-text">{bulkError}</p> : null}
            {bulkResult ? (
              <div className="bulk-result">
                <p>
                  Created: <strong>{bulkResult.summary?.created ?? 0}</strong> | Failed: <strong>{bulkResult.summary?.failed ?? 0}</strong>
                </p>
              </div>
            ) : null}
            <div className="form-actions">
              <button
                type="button"
                className="btn-primary"
                onClick={handleUploadPreviewedUsers}
                disabled={bulkUploading || previewSummary.ready === 0}
              >
                {bulkUploading ? "Uploading..." : "Upload Ready Users"}
              </button>
              <button type="button" className="btn-ghost" onClick={closeBulkModal}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
