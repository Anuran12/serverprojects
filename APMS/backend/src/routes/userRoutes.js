import express from "express";
import bcrypt from "bcryptjs";
import { query } from "../lib/db.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireRole } from "../middleware/requireRole.js";

const router = express.Router();
const VALID_ROLES = ["ADMIN", "MANAGER", "AUDITOR"];
const TEAM_OPTIONS = ["IT Audit", "Project Audit", "System Audit", "COE"];

function parseCsvLine(line) {
  const cells = [];
  let value = "";
  let quoted = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === "\"") {
      if (quoted && line[i + 1] === "\"") {
        value += "\"";
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

function normalizeRows(csvText) {
  const lines = String(csvText || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return { error: "CSV must include header and at least one data row" };
  }

  const headers = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const expected = ["name", "email", "password", "team", "role", "manageremail"];
  const missing = expected.filter((h) => !headers.includes(h));
  if (missing.length > 0) {
    return { error: `Missing required headers: ${missing.join(", ")}` };
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

function normalizeUsersPayload(users) {
  if (!Array.isArray(users) || users.length === 0) {
    return { error: "users must be a non-empty array" };
  }
  const rows = users.map((row, index) => ({
    line: Number(row?.line) || index + 1,
    name: String(row?.name || "").trim(),
    email: String(row?.email || "").trim().toLowerCase(),
    password: String(row?.password || "").trim(),
    team: String(row?.team || "").trim(),
    role: String(row?.role || "").trim().toUpperCase(),
    managerEmail: String(row?.managerEmail || "").trim().toLowerCase()
  }));
  return { rows };
}

router.get("/me", requireAuth, async (req, res) => {
  const result = await query(
    `SELECT id, name, email, role, team, manager_id AS "managerId"
     FROM users
     WHERE id = $1`,
    [req.user.id]
  );
  return res.json(result.rows[0]);
});

router.get("/users", requireAuth, async (req, res) => {
  const result = await query(
    `SELECT u.id, u.name, u.email, u.role, u.team, u.is_active AS "isActive",
            u.manager_id AS "managerId", m.name AS "managerName"
     FROM users u
     LEFT JOIN users m ON m.id = u.manager_id
     ORDER BY u.id`
  );
  return res.json(result.rows);
});

router.post("/users", requireAuth, requireRole("ADMIN"), async (req, res) => {
  const { name, email, password, team, role, managerId } = req.body;
  if (!name || !email || !password || !team || !role) {
    return res.status(400).json({ message: "Missing required fields: name, email, password, team, role" });
  }
  if (!VALID_ROLES.includes(role)) {
    return res.status(400).json({ message: "Invalid role" });
  }
  if (role === "AUDITOR" && managerId == null) {
    return res.status(400).json({ message: "Auditors must have a manager" });
  }
  const hash = await bcrypt.hash(password, 12);
  await query(
    `INSERT INTO users (name, email, password_hash, role, team, manager_id)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      name,
      email,
      hash,
      role,
      team,
      role === "AUDITOR" ? managerId : null
    ]
  );
  const row = await query(
    `SELECT id, name, email, role, team, is_active AS "isActive", manager_id AS "managerId"
     FROM users WHERE email = $1`,
    [email]
  );
  return res.status(201).json(row.rows[0]);
});

router.post("/users/bulk", requireAuth, requireRole("ADMIN"), async (req, res) => {
  const { csvText, users } = req.body || {};
  const parsed = Array.isArray(users) ? normalizeUsersPayload(users) : normalizeRows(csvText);
  if (parsed.error) {
    return res.status(400).json({ message: parsed.error });
  }

  const rows = parsed.rows;
  if (!rows.length) {
    return res.status(400).json({ message: "No data rows found in CSV" });
  }

  const results = [];
  const created = [];
  const seen = new Set();

  for (const row of rows) {
    const key = row.email.toLowerCase();
    if (seen.has(key)) {
      results.push({
        line: row.line,
        email: row.email,
        status: "failed",
        reason: "Duplicate email in CSV"
      });
      continue;
    }
    seen.add(key);

    if (!row.name || !row.email || !row.password || !row.team || !row.role) {
      results.push({
        line: row.line,
        email: row.email || "",
        status: "failed",
        reason: "Missing required value(s)"
      });
      continue;
    }

    if (!VALID_ROLES.includes(row.role)) {
      results.push({
        line: row.line,
        email: row.email,
        status: "failed",
        reason: "Invalid role"
      });
      continue;
    }

    if (!TEAM_OPTIONS.includes(row.team)) {
      results.push({
        line: row.line,
        email: row.email,
        status: "failed",
        reason: "Invalid team"
      });
      continue;
    }

    if (row.role === "AUDITOR" && !row.managerEmail) {
      results.push({
        line: row.line,
        email: row.email,
        status: "failed",
        reason: "Auditor must include managerEmail"
      });
      continue;
    }

    const exists = await query("SELECT 1 FROM users WHERE lower(email) = $1", [row.email]);
    if (exists.rowCount > 0) {
      results.push({
        line: row.line,
        email: row.email,
        status: "failed",
        reason: "Email already exists"
      });
      continue;
    }

    let managerId = null;
    if (row.role === "AUDITOR") {
      const managerRow = await query(
        `SELECT id, role FROM users WHERE lower(email) = $1 AND is_active = true`,
        [row.managerEmail]
      );
      if (managerRow.rowCount === 0) {
        results.push({
          line: row.line,
          email: row.email,
          status: "failed",
          reason: "Manager email not found"
        });
        continue;
      }
      if (managerRow.rows[0].role !== "MANAGER") {
        results.push({
          line: row.line,
          email: row.email,
          status: "failed",
          reason: "managerEmail must belong to a MANAGER user"
        });
        continue;
      }
      managerId = managerRow.rows[0].id;
    }

    const hash = await bcrypt.hash(row.password, 12);
    await query(
      `INSERT INTO users (name, email, password_hash, role, team, manager_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [row.name, row.email, hash, row.role, row.team, managerId]
    );

    const inserted = await query(
      `SELECT id, name, email, role, team, is_active AS "isActive", manager_id AS "managerId"
       FROM users WHERE lower(email) = $1`,
      [row.email]
    );
    created.push(inserted.rows[0]);
    results.push({ line: row.line, email: row.email, status: "created" });
  }

  const failed = results.filter((r) => r.status === "failed");
  return res.status(201).json({
    message: `Bulk upload complete. Created ${created.length}, failed ${failed.length}.`,
    summary: {
      totalRows: rows.length,
      created: created.length,
      failed: failed.length
    },
    createdUsers: created,
    results
  });
});

router.patch("/users/:id", requireAuth, requireRole("ADMIN"), async (req, res) => {
  const id = Number(req.params.id);
  const { name, email, team, role, managerId, isActive, password } = req.body;
  const existingUser = await query(
    `SELECT role, team, manager_id AS "managerId" FROM users WHERE id = $1`,
    [id]
  );
  if (existingUser.rowCount === 0) {
    return res.status(404).json({ message: "User not found" });
  }

  const current = existingUser.rows[0];
  const nextRole = role ?? current.role;
  const nextTeam = team ?? current.team;
  const nextManagerId =
    managerId !== undefined ? managerId ?? null : current.managerId ?? null;

  if (nextRole === "AUDITOR" && nextManagerId == null) {
    return res.status(400).json({ message: "Auditors must have a manager" });
  }

  const updates = [];
  const values = [];
  let i = 1;
  if (name != null) { updates.push(`name = $${i++}`); values.push(name); }
  if (email != null) { updates.push(`email = $${i++}`); values.push(email); }
  if (team != null) { updates.push(`team = $${i++}`); values.push(team); }
  if (role != null) {
    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }
    updates.push(`role = $${i++}`);
    values.push(role);
  }
  if (managerId !== undefined) {
    updates.push(`manager_id = $${i++}`);
    values.push(managerId ?? null);
  }
  if (typeof isActive === "boolean") {
    updates.push(`is_active = $${i++}`);
    values.push(isActive);
  }
  if (password != null && password !== "") {
    const hash = await bcrypt.hash(password, 12);
    updates.push(`password_hash = $${i++}`);
    values.push(hash);
  }
  if (updates.length === 0) {
    return res.status(400).json({ message: "No fields to update" });
  }
  values.push(id);
  await query(
    `UPDATE users SET ${updates.join(", ")} WHERE id = $${i}`,
    values
  );
  const row = await query(
    `SELECT id, name, email, role, team, is_active AS "isActive", manager_id AS "managerId"
     FROM users WHERE id = $1`,
    [id]
  );
  if (row.rows.length === 0) return res.status(404).json({ message: "User not found" });
  return res.json(row.rows[0]);
});

export default router;
