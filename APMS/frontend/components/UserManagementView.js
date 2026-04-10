"use client";

import { useState } from "react";

export default function UserManagementView({
  users,
  onAddUser,
  onUpdateUser,
  onToggleActive
}) {
  const TEAM_OPTIONS = [
    { value: "IT Audit", label: "IT Audit" },
    { value: "Project Audit", label: "Project Audit" },
    { value: "System Audit", label: "System Audit" },
    { value: "COE", label: "COE Team" }
  ];

  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    team: "",
    role: "AUDITOR",
    managerId: ""
  });

  const managers = users.filter((u) => u.role === "MANAGER");

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
    <main className="app-shell view-user-management">
      <div className="view-header">
        <h2>User Management</h2>
        <button type="button" className="btn-primary" onClick={openAdd}>
          Add New User
        </button>
      </div>

      <section className="user-list-wrap">
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
                <td>{u.managerName ?? "—"}</td>
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
                    className="btn-sm"
                    onClick={() => openEdit(u)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn-sm"
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
        <div className="modal-overlay" onClick={closeForm}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>{editingUser ? "Edit User" : "Add New User"}</h3>
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
                  placeholder={editingUser ? "••••••••" : ""}
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
                <button type="button" onClick={closeForm}>
                  Cancel
                </button>
                <button type="submit">
                  {editingUser ? "Update" : "Create"} User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
