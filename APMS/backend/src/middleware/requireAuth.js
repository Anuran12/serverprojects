import { verifyToken } from "../lib/auth.js";
import { query } from "../lib/db.js";

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Missing token" });
  }

  try {
    const token = header.split(" ")[1];
    const payload = verifyToken(token);
    const freshUser = await query(
      `SELECT id, name, email, role, team, is_active AS "isActive"
       FROM users
       WHERE id = $1`,
      [payload.id]
    );

    if (freshUser.rowCount === 0) {
      return res.status(401).json({ message: "Invalid token user" });
    }

    const user = freshUser.rows[0];
    if (!user.isActive) {
      return res.status(403).json({ message: "User deactivated" });
    }

    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      team: user.team
    };
    return next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
}
