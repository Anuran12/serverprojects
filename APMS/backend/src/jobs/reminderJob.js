import { query } from "../lib/db.js";
import { createNotification } from "../services/notificationService.js";

function hoursDiff(date) {
  return (new Date(date).getTime() - Date.now()) / 3600000;
}

async function notifyForTask(task, type, message, suffix) {
  const recipients = new Set();

  const assignees = await query(
    `SELECT ta.user_id AS "userId", u.manager_id AS "managerId"
     FROM task_assignees ta
     JOIN users u ON u.id = ta.user_id
     WHERE ta.task_id = $1`,
    [task.id]
  );

  for (const row of assignees.rows) {
    recipients.add(row.userId);
    if (row.managerId) recipients.add(row.managerId);
  }

  if (type === "OVERDUE_ALERT" && task.createdBy) {
    recipients.add(task.createdBy);
  }

  await Promise.all(
    [...recipients].map((userId) =>
      createNotification({
        userId,
        taskId: task.id,
        type,
        message,
        dedupeKey: `${task.id}:${userId}:${suffix}`
      })
    )
  );
}

export function startReminderScheduler() {
  setInterval(async () => {
    const tasks = await query(
      `SELECT id, title, end_date AS "endDate", status, created_by AS "createdBy"
       FROM tasks
       WHERE status != 'COMPLETED'`
    );

    for (const task of tasks.rows) {
      const hours = hoursDiff(task.endDate);
      const dueDate = new Date(task.endDate).toLocaleDateString();

      if (hours <= 48 && hours > 47) {
        await notifyForTask(task, "DEADLINE_REMINDER", `Task \"${task.title}\" is due in 48 hours (${dueDate}).`, "48h");
      }

      if (hours <= 24 && hours > 23) {
        await notifyForTask(task, "DEADLINE_REMINDER", `Task \"${task.title}\" is due in 24 hours (${dueDate}).`, "24h");
      }

      if (hours <= 0 && hours > -1) {
        await notifyForTask(task, "DEADLINE_REMINDER", `Task \"${task.title}\" is due today.`, "today");
      }

      if (hours < 0) {
        const dayKey = new Date().toISOString().slice(0, 10);
        await notifyForTask(task, "OVERDUE_ALERT", `Task \"${task.title}\" is overdue.`, `overdue:${dayKey}`);
      }
    }
  }, 60000);
}
