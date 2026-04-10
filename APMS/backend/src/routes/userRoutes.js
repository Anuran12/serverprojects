import express from "express";
import bcrypt from "bcryptjs";
import { query } from "../lib/db.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireRole } from "../middleware/requireRole.js";

const router = express.Router();

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
  if (!["ADMIN", "MANAGER", "AUDITOR"].includes(role)) {
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
    if (!["ADMIN", "MANAGER", "AUDITOR"].includes(role)) {
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
