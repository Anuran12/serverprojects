import express from "express";
import fs from "fs";
import path from "path";
import { createReadStream } from "fs";
import { query } from "../lib/db.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { createNotification } from "../services/notificationService.js";
import { taskFileUpload, UPLOAD_DIR, safeUnlink } from "../lib/taskUpload.js";

const router = express.Router();

const STATUS = {
  INITIATED: "INITIATED",
  ASSIGNED: "ASSIGNED",
  INPROGRESS_DEVELOPMENT: "INPROGRESS_DEVELOPMENT",
  INPROGRESS_UAT: "INPROGRESS_UAT",
  COMPLETED: "COMPLETED"
};

const STATUS_LABEL = {
  [STATUS.INITIATED]: "Initiated",
  [STATUS.ASSIGNED]: "Assigned",
  [STATUS.INPROGRESS_DEVELOPMENT]: "Inprogress - Development",
  [STATUS.INPROGRESS_UAT]: "Inprogress - UAT",
  [STATUS.COMPLETED]: "Completed"
};

function isCoeUser(user) {
  return user?.role === "AUDITOR" && user?.team === "COE";
}

function uploadTasksMiddleware(req, res, next) {
  const mw = taskFileUpload.array("attachments", 30);
  mw(req, res, (err) => {
    if (err) {
      return res.status(400).json({ message: err.message || "File upload failed" });
    }
    next();
  });
}

function parseAssigneeIds(body) {
  if (Array.isArray(body?.assigneeIds)) {
    const ids = body.assigneeIds.map(Number).filter(Number.isFinite);
    return [...new Set(ids)];
  }
  const one = Number(body?.assigneeId);
  if (Number.isFinite(one)) return [one];
  return [];
}

async function getAssigneesMap(taskIds) {
  if (!taskIds.length) return {};
  const rows = await query(
    `SELECT ta.task_id AS "taskId", u.id, u.name, u.team,
            u.manager_id AS "managerId", m.name AS "managerName"
     FROM task_assignees ta
     JOIN users u ON u.id = ta.user_id
     LEFT JOIN users m ON m.id = u.manager_id
     WHERE ta.task_id = ANY($1::int[])
     ORDER BY ta.id ASC`,
    [taskIds]
  );

  return rows.rows.reduce((acc, row) => {
    acc[row.taskId] = acc[row.taskId] || [];
    acc[row.taskId].push({
      id: row.id,
      name: row.name,
      team: row.team,
      managerId: row.managerId,
      managerName: row.managerName
    });
    return acc;
  }, {});
}

async function getAttachmentsMap(taskIds) {
  if (!taskIds.length) return {};
  const atts = await query(
    `SELECT id, task_id AS "taskId", original_name AS "originalName",
            mime_type AS "mimeType", size_bytes AS "sizeBytes"
     FROM task_attachments
     WHERE task_id = ANY($1::int[])
     ORDER BY id ASC`,
    [taskIds]
  );

  return atts.rows.reduce((acc, row) => {
    acc[row.taskId] = acc[row.taskId] || [];
    acc[row.taskId].push({
      id: row.id,
      originalName: row.originalName,
      mimeType: row.mimeType,
      sizeBytes: row.sizeBytes
    });
    return acc;
  }, {});
}

function hydrateTaskRow(row, assigneesMap, attachmentsMap) {
  const assignees = assigneesMap[row.id] || [];
  const firstAssignee = assignees[0] || null;
  const managerNames = [...new Set(assignees.map((a) => a.managerName).filter(Boolean))];

  return {
    ...row,
    statusLabel: STATUS_LABEL[row.status] || row.status,
    isOverdue: row.status !== STATUS.COMPLETED && new Date(row.endDate).getTime() < Date.now(),
    assignees,
    assigneeIds: assignees.map((a) => a.id),
    assignedAuditorId: firstAssignee?.id ?? null,
    assignedAuditorName: firstAssignee?.name ?? null,
    assignedAuditorTeam: firstAssignee?.team ?? null,
    assignedAuditorManagerName: managerNames.join(", ") || null,
    attachments: attachmentsMap[row.id] || []
  };
}

function canViewTaskRow(user, task) {
  if (!task) return false;

  if (isCoeUser(user)) return true;
  if (user.role === "ADMIN") return true;
  if (user.role === "MANAGER") return true;

  if (task.status === STATUS.INITIATED) return false;

  if (user.role === "AUDITOR") {
    if (task.assigneeIds?.includes(user.id)) return true;
    if (
      task.createdBy === user.id &&
      [STATUS.INPROGRESS_UAT, STATUS.COMPLETED].includes(task.status)
    ) {
      return true;
    }
  }

  return false;
}

async function getTaskById(taskId) {
  const result = await query(
    `SELECT
      t.id,
      t.title,
      t.description,
      t.priority,
      t.status,
      t.start_date AS "startDate",
      t.end_date AS "endDate",
      t.parent_task_id AS "parentTaskId",
      t.created_by AS "createdBy",
      creator.name AS "createdByName",
      creator.team AS "createdByTeam",
      t.assigned_by AS "assignedBy",
      assigner.name AS "assignedByName",
      assigner.team AS "assignedByTeam",
      COALESCE(t.remarks, '') AS remarks,
      t.created_at AS "createdAt",
      t.assigned_at AS "assignedAt",
      t.development_started_at AS "developmentStartedAt",
      t.development_completed_at AS "developmentCompletedAt",
      t.uat_started_at AS "uatStartedAt",
      t.uat_initiator_approved AS "uatInitiatorApproved",
      t.uat_initiator_approved_at AS "uatInitiatorApprovedAt",
      t.uat_coe_approved AS "uatCoeApproved",
      t.uat_coe_approved_at AS "uatCoeApprovedAt",
      t.reassign_count AS "reassignCount",
      t.last_reassigned_at AS "lastReassignedAt",
      t.completed_at AS "completedAt"
    FROM tasks t
    LEFT JOIN users creator ON creator.id = t.created_by
    LEFT JOIN users assigner ON assigner.id = t.assigned_by
    WHERE t.id = $1`,
    [taskId]
  );

  if (result.rowCount === 0) return null;

  const assigneesMap = await getAssigneesMap([taskId]);
  const attachmentsMap = await getAttachmentsMap([taskId]);
  return hydrateTaskRow(result.rows[0], assigneesMap, attachmentsMap);
}

async function canAccessTask(user, taskId) {
  const task = await getTaskById(taskId);
  return { ok: canViewTaskRow(user, task), task };
}

async function notifyTaskParticipants(task, { type, message, includeAssignedAuditor = true }) {
  const recipientIds = new Set();

  if (task.createdBy) recipientIds.add(task.createdBy);

  if (includeAssignedAuditor) {
    for (const assignee of task.assignees || []) {
      recipientIds.add(assignee.id);
      if (assignee.managerId) recipientIds.add(assignee.managerId);
    }
  }

  const coeUsers = await query(
    `SELECT id
     FROM users
     WHERE role = 'AUDITOR' AND team = 'COE' AND is_active = true`
  );
  for (const row of coeUsers.rows) recipientIds.add(row.id);

  for (const userId of recipientIds) {
    await createNotification({
      userId,
      taskId: task.id,
      type,
      message,
      dedupeKey: `${task.id}:${userId}:${type}:${Date.now()}`
    });
  }
}

router.get("/tasks", requireAuth, async (req, res) => {
  const role = req.user.role;
  const coe = isCoeUser(req.user);

  let sql = `
    SELECT
      t.id,
      t.title,
      t.description,
      t.priority,
      t.status,
      t.start_date AS "startDate",
      t.end_date AS "endDate",
      t.parent_task_id AS "parentTaskId",
      t.created_by AS "createdBy",
      creator.name AS "createdByName",
      creator.team AS "createdByTeam",
      t.assigned_by AS "assignedBy",
      assigner.name AS "assignedByName",
      assigner.team AS "assignedByTeam",
      COALESCE(t.remarks, '') AS remarks,
      t.created_at AS "createdAt",
      t.assigned_at AS "assignedAt",
      t.development_started_at AS "developmentStartedAt",
      t.development_completed_at AS "developmentCompletedAt",
      t.uat_started_at AS "uatStartedAt",
      t.uat_initiator_approved AS "uatInitiatorApproved",
      t.uat_initiator_approved_at AS "uatInitiatorApprovedAt",
      t.uat_coe_approved AS "uatCoeApproved",
      t.uat_coe_approved_at AS "uatCoeApprovedAt",
      t.reassign_count AS "reassignCount",
      t.last_reassigned_at AS "lastReassignedAt",
      t.completed_at AS "completedAt"
    FROM tasks t
    LEFT JOIN users creator ON creator.id = t.created_by
    LEFT JOIN users assigner ON assigner.id = t.assigned_by
  `;

  const values = [];

  if (coe || role === "MANAGER" || role === "ADMIN") {
    // Full visibility including initiated.
  } else if (role === "AUDITOR") {
    values.push(req.user.id);
    sql += `
      WHERE (
        EXISTS (
          SELECT 1
          FROM task_assignees ta
          WHERE ta.task_id = t.id AND ta.user_id = $1
        )
        OR (
          t.created_by = $1
          AND t.status IN ('${STATUS.INPROGRESS_UAT}', '${STATUS.COMPLETED}')
        )
      )
      AND t.status <> '${STATUS.INITIATED}'
    `;
  }

  sql += " ORDER BY t.created_at DESC";

  const result = await query(sql, values);
  const taskIds = result.rows.map((t) => t.id);

  const [assigneesMap, attachmentsMap] = await Promise.all([
    getAssigneesMap(taskIds),
    getAttachmentsMap(taskIds)
  ]);

  const tasks = result.rows.map((row) => hydrateTaskRow(row, assigneesMap, attachmentsMap));
  return res.json(tasks);
});

router.get("/tasks/:id", requireAuth, async (req, res) => {
  const taskId = Number(req.params.id);
  if (!Number.isFinite(taskId)) return res.status(400).json({ message: "Invalid task id" });

  const access = await canAccessTask(req.user, taskId);
  if (!access.ok) return res.status(403).json({ message: "Forbidden" });
  return res.json(access.task);
});

router.post("/tasks", requireAuth, uploadTasksMiddleware, async (req, res) => {
  const files = req.files || [];
  const title = (req.body.title || "").trim();
  const description = (req.body.description || "").trim() || "(No description)";
  const priority = req.body.priority || "MEDIUM";
  const startDate = req.body.startDate;
  const endDate = req.body.endDate;
  const remarks = (req.body.remarks || "").trim();
  const parentTaskId =
    req.body.parentTaskId && String(req.body.parentTaskId).trim() !== ""
      ? Number(req.body.parentTaskId)
      : null;

  if (!title || !startDate || !endDate) {
    for (const f of files) safeUnlink(f.filename);
    return res.status(400).json({ message: "Missing required fields" });
  }

  if (new Date(endDate).getTime() < new Date(startDate).getTime()) {
    for (const f of files) safeUnlink(f.filename);
    return res.status(400).json({ message: "End date must be after start date" });
  }

  let task;
  try {
    const taskInsert = await query(
      `INSERT INTO tasks (title, description, priority, status, start_date, end_date, created_by, parent_task_id, remarks)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [
        title,
        description,
        priority,
        STATUS.INITIATED,
        startDate,
        endDate,
        req.user.id,
        parentTaskId,
        remarks
      ]
    );

    task = taskInsert.rows[0];

    for (const f of files) {
      await query(
        `INSERT INTO task_attachments (task_id, stored_name, original_name, mime_type, size_bytes)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          task.id,
          f.filename,
          f.originalname || f.filename,
          f.mimetype || "application/octet-stream",
          f.size || 0
        ]
      );
    }

    const coeUsers = await query(
      "SELECT id FROM users WHERE role = 'AUDITOR' AND team = 'COE' AND is_active = true"
    );

    for (const row of coeUsers.rows) {
      await createNotification({
        userId: row.id,
        taskId: task.id,
        type: "TASK_INITIATED",
        message: `New task initiated: ${title}`,
        dedupeKey: `${task.id}:${row.id}:TASK_INITIATED:${Date.now()}`
      });
    }
  } catch (e) {
    for (const f of files) safeUnlink(f.filename);
    console.error(e);
    return res.status(500).json({ message: "Could not create task" });
  }

  const freshTask = await getTaskById(task.id);
  return res.status(201).json(freshTask);
});

router.patch("/tasks/:id/assign", requireAuth, async (req, res) => {
  const taskId = Number(req.params.id);
  const assigneeIds = parseAssigneeIds(req.body);

  if (!Number.isFinite(taskId) || assigneeIds.length === 0) {
    return res.status(400).json({ message: "Invalid task id or assignees" });
  }

  if (!isCoeUser(req.user)) {
    return res.status(403).json({ message: "Only COE team can assign tasks" });
  }

  const task = await getTaskById(taskId);
  if (!task) return res.status(404).json({ message: "Task not found" });

  if (![STATUS.INITIATED, STATUS.INPROGRESS_UAT].includes(task.status)) {
    return res.status(400).json({ message: "Task cannot be assigned in current status" });
  }

  const assignees = await query(
    `SELECT id, name, role, team, is_active AS "isActive"
     FROM users
     WHERE id = ANY($1::int[])`,
    [assigneeIds]
  );

  if (assignees.rowCount !== assigneeIds.length) {
    return res.status(404).json({ message: "One or more assignees not found" });
  }

  for (const assigneeRow of assignees.rows) {
    if (
      assigneeRow.role !== "AUDITOR" ||
      !assigneeRow.isActive
    ) {
      return res.status(400).json({ message: "Task can only be assigned to active auditors" });
    }
  }

  await query("DELETE FROM task_assignees WHERE task_id = $1", [taskId]);
  for (const userId of assigneeIds) {
    await query(
      `INSERT INTO task_assignees (task_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT (task_id, user_id) DO NOTHING`,
      [taskId, userId]
    );
  }

  await query(
    `UPDATE tasks
     SET status = $1,
         assigned_by = $2,
         assigned_at = now(),
         development_started_at = NULL,
         development_completed_at = NULL,
         uat_started_at = NULL,
         uat_initiator_approved = false,
         uat_initiator_approved_at = NULL,
         uat_coe_approved = false,
         uat_coe_approved_at = NULL,
         reassign_count = CASE WHEN $4 THEN COALESCE(reassign_count, 0) + 1 ELSE COALESCE(reassign_count, 0) END,
         last_reassigned_at = CASE WHEN $4 THEN now() ELSE last_reassigned_at END,
         completed_at = NULL
     WHERE id = $3`,
    [STATUS.ASSIGNED, req.user.id, taskId, task.status === STATUS.INPROGRESS_UAT]
  );

  const updated = await getTaskById(taskId);

  for (const assignee of updated.assignees) {
    await createNotification({
      userId: assignee.id,
      taskId,
      type: "TASK_ASSIGNED",
      message: `Task assigned to you: ${updated.title}`,
      dedupeKey: `${taskId}:${assignee.id}:TASK_ASSIGNED:${Date.now()}`
    });
  }

  if (updated.createdBy && !updated.assigneeIds.includes(updated.createdBy)) {
    await createNotification({
      userId: updated.createdBy,
      taskId,
      type: "TASK_ASSIGNED",
      message: `Your initiated task was assigned to ${updated.assignees.map((a) => a.name).join(", ")}`,
      dedupeKey: `${taskId}:${updated.createdBy}:TASK_ASSIGNED:${Date.now()}`
    });
  }

  return res.json(updated);
});

router.patch("/tasks/:id/start-development", requireAuth, async (req, res) => {
  const taskId = Number(req.params.id);
  if (!Number.isFinite(taskId)) return res.status(400).json({ message: "Invalid task id" });

  const task = await getTaskById(taskId);
  if (!task) return res.status(404).json({ message: "Task not found" });

  if (task.status !== STATUS.ASSIGNED) {
    return res.status(400).json({ message: "Task is not in assigned state" });
  }

  const isAssigned = task.assigneeIds.includes(req.user.id);
  if (!isAssigned) {
    return res.status(403).json({ message: "Only assigned auditors can start development" });
  }

  await query(
    `UPDATE tasks
     SET status = $1,
         development_started_at = now()
     WHERE id = $2`,
    [STATUS.INPROGRESS_DEVELOPMENT, taskId]
  );

  return res.json(await getTaskById(taskId));
});

router.patch("/tasks/:id/development-complete", requireAuth, async (req, res) => {
  const taskId = Number(req.params.id);
  if (!Number.isFinite(taskId)) return res.status(400).json({ message: "Invalid task id" });

  const task = await getTaskById(taskId);
  if (!task) return res.status(404).json({ message: "Task not found" });

  if (task.status !== STATUS.INPROGRESS_DEVELOPMENT) {
    return res.status(400).json({ message: "Task is not in development phase" });
  }

  const isAssigned = task.assigneeIds.includes(req.user.id);
  if (!isAssigned) {
    return res.status(403).json({ message: "Only assigned auditors can complete development" });
  }

  await query(
    `UPDATE tasks
     SET status = $1,
         development_completed_at = now(),
         uat_started_at = now(),
         uat_initiator_approved = false,
         uat_initiator_approved_at = NULL,
         uat_coe_approved = false,
         uat_coe_approved_at = NULL
     WHERE id = $2`,
    [STATUS.INPROGRESS_UAT, taskId]
  );

  const updated = await getTaskById(taskId);
  await notifyTaskParticipants(updated, {
    type: "TASK_UAT_STARTED",
    message: `Development completed for ${updated.title}. UAT approval is pending.`
  });

  return res.json(updated);
});

router.patch("/tasks/:id/uat-approve", requireAuth, async (req, res) => {
  const taskId = Number(req.params.id);
  if (!Number.isFinite(taskId)) return res.status(400).json({ message: "Invalid task id" });

  const task = await getTaskById(taskId);
  if (!task) return res.status(404).json({ message: "Task not found" });

  if (task.status !== STATUS.INPROGRESS_UAT) {
    return res.status(400).json({ message: "Task is not in UAT phase" });
  }

  const isInitiator = req.user.id === task.createdBy;
  const isCoe = isCoeUser(req.user);

  if (!isInitiator && !isCoe) {
    return res.status(403).json({ message: "Only task initiator or COE team can approve UAT" });
  }

  if (isInitiator) {
    await query(
      `UPDATE tasks
       SET uat_initiator_approved = true,
           uat_initiator_approved_at = COALESCE(uat_initiator_approved_at, now())
       WHERE id = $1`,
      [taskId]
    );
  }

  if (isCoe) {
    await query(
      `UPDATE tasks
       SET uat_coe_approved = true,
           uat_coe_approved_at = COALESCE(uat_coe_approved_at, now())
       WHERE id = $1`,
      [taskId]
    );
  }

  const afterApproval = await getTaskById(taskId);

  if (afterApproval.uatInitiatorApproved && afterApproval.uatCoeApproved) {
    await query(
      `UPDATE tasks
       SET status = $1,
           completed_at = now()
       WHERE id = $2`,
      [STATUS.COMPLETED, taskId]
    );

    const completedTask = await getTaskById(taskId);
    await notifyTaskParticipants(completedTask, {
      type: "TASK_COMPLETED",
      message: `Task completed: ${completedTask.title}`
    });

    return res.json(completedTask);
  }

  await notifyTaskParticipants(afterApproval, {
    type: "TASK_UAT_APPROVAL",
    message: `UAT approval updated for ${afterApproval.title}`
  });

  return res.json(afterApproval);
});

router.patch("/tasks/:id/uat-reassign", requireAuth, async (req, res) => {
  const taskId = Number(req.params.id);
  const assigneeIds = parseAssigneeIds(req.body);

  if (!Number.isFinite(taskId) || assigneeIds.length === 0) {
    return res.status(400).json({ message: "Invalid task id or assignees" });
  }

  const task = await getTaskById(taskId);
  if (!task) return res.status(404).json({ message: "Task not found" });

  if (task.status !== STATUS.INPROGRESS_UAT) {
    return res.status(400).json({ message: "Task is not in UAT phase" });
  }

  const isInitiator = req.user.id === task.createdBy;
  const isCoe = isCoeUser(req.user);

  if (!isInitiator && !isCoe) {
    return res.status(403).json({ message: "Only task initiator or COE team can reassign from UAT" });
  }

  const assignees = await query(
    `SELECT id, name, role, team, is_active AS "isActive"
     FROM users
     WHERE id = ANY($1::int[])`,
    [assigneeIds]
  );

  if (assignees.rowCount !== assigneeIds.length) {
    return res.status(404).json({ message: "One or more assignees not found" });
  }

  for (const assigneeRow of assignees.rows) {
    if (
      assigneeRow.role !== "AUDITOR" ||
      !assigneeRow.isActive
    ) {
      return res.status(400).json({ message: "Task can only be assigned to active auditors" });
    }
  }

  await query("DELETE FROM task_assignees WHERE task_id = $1", [taskId]);
  for (const userId of assigneeIds) {
    await query(
      `INSERT INTO task_assignees (task_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT (task_id, user_id) DO NOTHING`,
      [taskId, userId]
    );
  }

  await query(
    `UPDATE tasks
     SET status = $1,
         assigned_by = $2,
         assigned_at = now(),
         development_started_at = NULL,
         development_completed_at = NULL,
         uat_started_at = NULL,
         uat_initiator_approved = false,
         uat_initiator_approved_at = NULL,
         uat_coe_approved = false,
         uat_coe_approved_at = NULL,
         reassign_count = COALESCE(reassign_count, 0) + 1,
         last_reassigned_at = now(),
         completed_at = NULL
     WHERE id = $3`,
    [STATUS.ASSIGNED, req.user.id, taskId]
  );

  const updated = await getTaskById(taskId);

  await notifyTaskParticipants(updated, {
    type: "TASK_REASSIGNED",
    message: `Task reassigned for development: ${updated.title}`
  });

  for (const assignee of updated.assignees) {
    await createNotification({
      userId: assignee.id,
      taskId,
      type: "TASK_ASSIGNED",
      message: `Task assigned to you for development rework: ${updated.title}`,
      dedupeKey: `${taskId}:${assignee.id}:TASK_ASSIGNED_REWORK:${Date.now()}`
    });
  }

  return res.json(updated);
});

router.get("/tasks/:id/remarks", requireAuth, async (req, res) => {
  const taskId = Number(req.params.id);
  if (!Number.isFinite(taskId)) return res.status(400).json({ message: "Invalid task id" });

  const access = await canAccessTask(req.user, taskId);
  if (!access.ok) return res.status(403).json({ message: "Forbidden" });

  const rows = await query(
    `SELECT r.id, r.body, r.created_at AS "createdAt",
            r.user_id AS "userId", u.name AS "authorName"
     FROM task_remarks r
     JOIN users u ON u.id = r.user_id
     WHERE r.task_id = $1
     ORDER BY r.created_at ASC`,
    [taskId]
  );

  return res.json(rows.rows);
});

router.post("/tasks/:id/remarks", requireAuth, async (req, res) => {
  const taskId = Number(req.params.id);
  if (!Number.isFinite(taskId)) return res.status(400).json({ message: "Invalid task id" });

  const text = typeof req.body.body === "string" ? req.body.body.trim() : "";
  if (!text) return res.status(400).json({ message: "Remark text is required" });

  const access = await canAccessTask(req.user, taskId);
  if (!access.ok) return res.status(403).json({ message: "Forbidden" });

  const ins = await query(
    `INSERT INTO task_remarks (task_id, user_id, body)
     VALUES ($1, $2, $3)
     RETURNING id, body, created_at AS "createdAt", user_id AS "userId"`,
    [taskId, req.user.id, text]
  );

  const nameRow = await query("SELECT name FROM users WHERE id = $1", [req.user.id]);

  return res.status(201).json({
    ...ins.rows[0],
    authorName: nameRow.rows[0]?.name || "User"
  });
});

router.patch("/tasks/:id", requireAuth, async (req, res) => {
  const taskId = Number(req.params.id);
  if (!Number.isFinite(taskId)) return res.status(400).json({ message: "Invalid task id" });

  const access = await canAccessTask(req.user, taskId);
  if (!access.ok) return res.status(403).json({ message: "Forbidden" });

  const { remarks } = req.body;
  if (remarks === undefined) return res.status(400).json({ message: "Nothing to update" });

  const text = typeof remarks === "string" ? remarks : String(remarks ?? "");
  await query(`UPDATE tasks SET remarks = $1 WHERE id = $2`, [text, taskId]);

  return res.json({ success: true, remarks: text });
});

router.get("/tasks/:taskId/attachments/:attachmentId/file", requireAuth, async (req, res) => {
  const taskId = Number(req.params.taskId);
  const attachmentId = Number(req.params.attachmentId);
  if (!Number.isFinite(taskId) || !Number.isFinite(attachmentId)) {
    return res.status(400).json({ message: "Invalid id" });
  }

  const access = await canAccessTask(req.user, taskId);
  if (!access.ok) return res.status(403).json({ message: "Forbidden" });

  const row = await query(
    `SELECT stored_name AS "storedName", original_name AS "originalName", mime_type AS "mimeType"
     FROM task_attachments WHERE id = $1 AND task_id = $2`,
    [attachmentId, taskId]
  );

  if (row.rowCount === 0) return res.status(404).json({ message: "Not found" });

  const { storedName, originalName, mimeType } = row.rows[0];
  const fullPath = path.join(UPLOAD_DIR, storedName);

  if (!fullPath.startsWith(path.resolve(UPLOAD_DIR))) {
    return res.status(400).json({ message: "Invalid path" });
  }

  try {
    await fs.promises.access(fullPath);
  } catch {
    return res.status(404).json({ message: "File missing" });
  }

  res.setHeader("Content-Type", mimeType || "application/octet-stream");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename*=UTF-8''${encodeURIComponent(originalName || "file")}`
  );
  createReadStream(fullPath).pipe(res);
});

router.patch("/tasks/:id/status", requireAuth, async (_req, res) => {
  return res.status(410).json({
    message:
      "Legacy status endpoint retired. Use /assign, /start-development, /development-complete, /uat-approve, /uat-reassign."
  });
});

router.post("/tasks/seed-demo", requireAuth, async (_req, res) => {
  return res.status(410).json({ message: "Demo seeding is disabled in enterprise workflow mode." });
});

export default router;
