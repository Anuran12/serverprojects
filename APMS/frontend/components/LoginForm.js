"use client";

import { useState } from "react";

export default function LoginForm({ onLogin, loading, error }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <div className="login-shell apms-login-shell">
      <div className="login-card apms-login-card">
        <div className="ribbon apms-login-ribbon">Audit project management</div>
        <h1 className="apms-login-title">Welcome back</h1>
        <p className="apms-login-lead">Sign in to the command center.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onLogin(email, password);
          }}
        >
          <label>
            Email
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              required
            />
          </label>
          <label>
            Password
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              required
            />
          </label>
          {error ? <div className="error-text">{error}</div> : null}
          <button type="submit" disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
