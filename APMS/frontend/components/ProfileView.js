"use client";

import { useState } from "react";

export default function ProfileView({ user, onChangePassword }) {
  const [showModal, setShowModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function closeModal() {
    setShowModal(false);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setSaving(false);
    setError("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError("All password fields are required.");
      return;
    }
    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New password and confirm password do not match.");
      return;
    }

    setSaving(true);
    try {
      await onChangePassword({ currentPassword, newPassword });
      setSuccess("Password updated successfully.");
      closeModal();
    } catch (err) {
      setError(err.message || "Could not update password.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="app-shell apms-page view-profile">
      <header className="apms-page-header">
        <div>
          <h1 className="apms-page-title">Profile</h1>
          <p className="apms-page-subtitle">View your account details and manage your password.</p>
        </div>
      </header>

      <section className="apms-panel profile-card">
        <div className="profile-row">
          <span>Name</span>
          <strong>{user?.name || "-"}</strong>
        </div>
        <div className="profile-row">
          <span>Email</span>
          <strong>{user?.email || "-"}</strong>
        </div>
        <div className="profile-row">
          <span>Role</span>
          <strong>{user?.role || "-"}</strong>
        </div>
        <div className="profile-row">
          <span>Team</span>
          <strong>{user?.team || "-"}</strong>
        </div>

        <div className="form-actions profile-actions">
          <button type="button" className="btn-primary" onClick={() => setShowModal(true)}>
            Change password
          </button>
        </div>
        {error ? <p className="error-text">{error}</p> : null}
        {success ? <p className="profile-success">{success}</p> : null}
      </section>

      {showModal ? (
        <div className="modal-overlay apms-modal-overlay" onClick={closeModal}>
          <div className="modal-content apms-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="apms-modal-title">Change password</h3>
            <form onSubmit={handleSubmit} className="user-form">
              <div className="form-group">
                <label>Current password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label>New password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </div>
              <div className="form-group">
                <label>Confirm new password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
              {error ? <p className="error-text">{error}</p> : null}
              <div className="form-actions">
                <button type="button" className="btn-ghost" onClick={closeModal}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? "Updating..." : "Update password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </main>
  );
}
