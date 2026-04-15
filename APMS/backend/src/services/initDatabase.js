import bcrypt from "bcryptjs";
import { query } from "../lib/db.js";

const TASK_STATUSES = [
  "INITIATED",
  "ASSIGNED",
  "INPROGRESS_DEVELOPMENT",
  "INPROGRESS_UAT",
  "COMPLETED"
];

export async function initDatabase() {
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('ADMIN', 'MANAGER', 'AUDITOR')),
      team TEXT NOT NULL,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      priority TEXT NOT NULL CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
      status TEXT NOT NULL DEFAULT 'INITIATED',
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      created_by INTEGER REFERENCES users(id),
      parent_task_id INTEGER REFERENCES tasks(id),
      assigned_by INTEGER REFERENCES users(id),
      assigned_at TIMESTAMPTZ,
      development_started_at TIMESTAMPTZ,
      development_completed_at TIMESTAMPTZ,
      uat_started_at TIMESTAMPTZ,
      uat_initiator_approved BOOLEAN NOT NULL DEFAULT false,
      uat_initiator_approved_at TIMESTAMPTZ,
      uat_coe_approved BOOLEAN NOT NULL DEFAULT false,
      uat_coe_approved_at TIMESTAMPTZ,
      reassign_count INTEGER NOT NULL DEFAULT 0,
      last_reassigned_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT now(),
      completed_at TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS task_assignees (
      id SERIAL PRIMARY KEY,
      task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id),
      UNIQUE (task_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      message TEXT NOT NULL,
      dedupe_key TEXT,
      is_read BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT now(),
      UNIQUE (user_id, dedupe_key)
    );
  `);

  await query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS manager_id INTEGER REFERENCES users(id);
  `);

  await query(`
    ALTER TABLE tasks ADD COLUMN IF NOT EXISTS remarks TEXT DEFAULT '';
    ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assigned_by INTEGER REFERENCES users(id);
    ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ;
    ALTER TABLE tasks ADD COLUMN IF NOT EXISTS development_started_at TIMESTAMPTZ;
    ALTER TABLE tasks ADD COLUMN IF NOT EXISTS development_completed_at TIMESTAMPTZ;
    ALTER TABLE tasks ADD COLUMN IF NOT EXISTS uat_started_at TIMESTAMPTZ;
    ALTER TABLE tasks ADD COLUMN IF NOT EXISTS uat_initiator_approved BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE tasks ADD COLUMN IF NOT EXISTS uat_initiator_approved_at TIMESTAMPTZ;
    ALTER TABLE tasks ADD COLUMN IF NOT EXISTS uat_coe_approved BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE tasks ADD COLUMN IF NOT EXISTS uat_coe_approved_at TIMESTAMPTZ;
    ALTER TABLE tasks ADD COLUMN IF NOT EXISTS reassign_count INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE tasks ADD COLUMN IF NOT EXISTS last_reassigned_at TIMESTAMPTZ;
  `);

  await query(`
    ALTER TABLE tasks ALTER COLUMN end_date DROP NOT NULL;
  `);

  // Drop any legacy status check before migrating old values, otherwise
  // existing constraints (NEW/IN_PROGRESS/OVERDUE) reject INITIATED updates.
  await query(`
    DO $$
    DECLARE c RECORD;
    BEGIN
      FOR c IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'tasks'::regclass
          AND contype = 'c'
          AND pg_get_constraintdef(oid) ILIKE '%status%'
      LOOP
        EXECUTE format('ALTER TABLE tasks DROP CONSTRAINT IF EXISTS %I', c.conname);
      END LOOP;
    END$$;
  `);

  await query(`
    UPDATE tasks
    SET status = CASE status
      WHEN 'NEW' THEN 'INITIATED'
      WHEN 'IN_PROGRESS' THEN 'INPROGRESS_DEVELOPMENT'
      WHEN 'OVERDUE' THEN 'INPROGRESS_DEVELOPMENT'
      ELSE status
    END
    WHERE status IN ('NEW', 'IN_PROGRESS', 'OVERDUE');
  `);

  await query(`
    UPDATE tasks
    SET status = 'INITIATED'
    WHERE status NOT IN ('INITIATED', 'ASSIGNED', 'INPROGRESS_DEVELOPMENT', 'INPROGRESS_UAT', 'COMPLETED');
  `);

  await query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'tasks_status_check'
          AND conrelid = 'tasks'::regclass
      ) THEN
        ALTER TABLE tasks
        ADD CONSTRAINT tasks_status_check
        CHECK (status IN ('INITIATED', 'ASSIGNED', 'INPROGRESS_DEVELOPMENT', 'INPROGRESS_UAT', 'COMPLETED'));
      END IF;
    END$$;
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS task_attachments (
      id SERIAL PRIMARY KEY,
      task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      stored_name TEXT NOT NULL,
      original_name TEXT NOT NULL,
      mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
      size_bytes INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS task_remarks (
      id SERIAL PRIMARY KEY,
      task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id),
      body TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_task_remarks_task_id ON task_remarks(task_id);
  `);

  const adminPassword = await bcrypt.hash("Admin1234", 12);
  const managerPassword = await bcrypt.hash("Manager1234", 12);
  const auditorPassword = await bcrypt.hash("Auditor1234", 12);

  await query(
    `INSERT INTO users (name, email, password_hash, role, team)
     VALUES ($1, $2, $3, 'ADMIN', $4)
     ON CONFLICT (email) DO UPDATE
     SET name = EXCLUDED.name,
         password_hash = EXCLUDED.password_hash,
         role = EXCLUDED.role,
         team = EXCLUDED.team,
         is_active = true`,
    ["System Admin", "admin@itc.in", adminPassword, "Platform Ops"]
  );

  await query(
    `INSERT INTO users (name, email, password_hash, role, team)
     VALUES ($1, $2, $3, 'AUDITOR', $4)
     ON CONFLICT (email) DO UPDATE
     SET name = EXCLUDED.name,
         password_hash = EXCLUDED.password_hash,
         role = EXCLUDED.role,
         team = EXCLUDED.team,
         manager_id = NULL,
         is_active = true`,
    ["COE Auditor", "coe@itc.in", auditorPassword, "COE"]
  );

  await query(
    `INSERT INTO users (name, email, password_hash, role, team)
     VALUES ($1, $2, $3, 'MANAGER', $4)
     ON CONFLICT (email) DO UPDATE
     SET name = EXCLUDED.name,
         password_hash = EXCLUDED.password_hash,
         role = EXCLUDED.role,
         team = EXCLUDED.team,
         is_active = true`,
    ["Audit Manager", "manager@itc.in", managerPassword, "IT Audit"]
  );

  await query(
    `INSERT INTO users (name, email, password_hash, role, team)
     VALUES ($1, $2, $3, 'AUDITOR', $4)
     ON CONFLICT (email) DO UPDATE
     SET name = EXCLUDED.name,
         password_hash = EXCLUDED.password_hash,
         role = EXCLUDED.role,
         team = EXCLUDED.team,
         is_active = true`,
    ["Audit Auditor", "auditor@itc.in", auditorPassword, "Project Audit"]
  );

  const managerRow = await query("SELECT id FROM users WHERE email = 'manager@itc.in'");
  if (managerRow.rows[0]) {
    await query(
      "UPDATE users SET manager_id = $1 WHERE email = 'auditor@itc.in'",
      [managerRow.rows[0].id]
    );
  }

  const tasksCount = await query("SELECT count(*)::int AS count FROM tasks");
  if (tasksCount.rows[0].count === 0) {
    const manager = await query("SELECT id FROM users WHERE email = 'manager@itc.in'");

    await query(
      `INSERT INTO tasks (
        title,
        description,
        priority,
        status,
        start_date,
        end_date,
        created_by,
        remarks
      )
      VALUES ($1, $2, $3, $4, CURRENT_DATE, CURRENT_DATE + INTERVAL '5 day', $5, $6)`,
      [
        "Quarterly IT Controls Review",
        "Review control evidence for Q1.",
        "HIGH",
        TASK_STATUSES[0],
        manager.rows[0].id,
        "Seed task in initiated state"
      ]
    );
  }
}
