import express from "express";
import bcrypt from "bcryptjs";
import { query } from "../lib/db.js";
import { signToken } from "../lib/auth.js";

const router = express.Router();

router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  const result = await query(
    `SELECT id, name, email, role, team, password_hash AS "passwordHash", is_active AS "isActive"
     FROM users
     WHERE email = $1`,
    [email]
  );

  if (result.rowCount === 0) return res.status(401).json({ message: "Invalid credentials" });

  const user = result.rows[0];
  if (!user.isActive) return res.status(403).json({ message: "User deactivated" });

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return res.status(401).json({ message: "Invalid credentials" });

  const token = signToken(user);
  return res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      team: user.team
    }
  });
});

export default router;