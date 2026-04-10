import { query } from "../lib/db.js";
import { emitToUser } from "./socket.js";

export async function createNotification({ userId, taskId, type, message, dedupeKey = null }) {
  const existing = await query(
    "SELECT id FROM notifications WHERE user_id = $1 AND dedupe_key = $2",
    [userId, dedupeKey]
  );

  if (dedupeKey && existing.rowCount > 0) {
    return null;
  }

  const result = await query(
    `INSERT INTO notifications (user_id, task_id, type, message, dedupe_key)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, user_id AS "userId", task_id AS "taskId", type, message, is_read AS "isRead", created_at AS "createdAt"`,
    [userId, taskId, type, message, dedupeKey]
  );

  const notification = result.rows[0];
  emitToUser(userId, "notification:new", notification);
  return notification;
}

export async function getNotifications(userId) {
  const result = await query(
    `SELECT id, user_id AS "userId", task_id AS "taskId", type, message, is_read AS "isRead", created_at AS "createdAt"
     FROM notifications
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 100`,
    [userId]
  );
  return result.rows;
}

export async function markAllRead(userId) {
  await query("UPDATE notifications SET is_read = true WHERE user_id = $1", [userId]);
}