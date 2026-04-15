import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "super-secret-change-me";

export function signToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      team: user.team,
      name: user.name
    },
    JWT_SECRET
  );
}

export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}
