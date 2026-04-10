# System & User Flow
## Audit Project Management System (APMS)

**Version:** 1.0.0  
**Last Updated:** 2026-03-09

---

## 1. Authentication Flow

```
User visits /login
     │
     ▼
Enter email + password
     │
     ▼
POST /api/auth/login
     │
     ├──[Invalid]──► Show error message → Retry (max 5 attempts)
     │
     └──[Valid]────► Server returns:
                         - accessToken (15 min)
                         - refreshToken (7 days, httpOnly cookie)
                     │
                     ▼
               Decode JWT → read role
                     │
                     ├── role: admin   → redirect /admin/dashboard
                     ├── role: manager → redirect /manager/dashboard
                     └── role: auditor → redirect /auditor/dashboard
```

### Token Refresh Flow
```
API request with expired accessToken
     │
     ▼
Server returns 401 Unauthorized
     │
     ▼
Frontend interceptor fires
     │
     ▼
POST /api/auth/refresh (sends httpOnly cookie)
     │
     ├──[Valid]──► New accessToken issued → retry original request
     └──[Invalid]─► Clear tokens → redirect to /login
```

---

## 2. Admin Flow

```
Admin Dashboard
     │
     ├── User Management
     │       ├── Create User (name, email, role, team)
     │       ├── Edit User (change role/team)
     │       └── Deactivate User
     │
     ├── Team Management
     │       ├── View all teams and members
     │       └── Move user between teams
     │
     ├── System Logs
     │       └── View all activity logs (filtered by user/date/action)
     │
     └── Notification Settings
             ├── Configure reminder thresholds (48hr, 24hr, day-of)
             └── Configure email templates
```

---

## 3. Manager Task Assignment Flow

```
Manager clicks "Assign New Task"
     │
     ▼
Task Creation Form opens
     │
     ├── Fill: Project Title (required)
     ├── Fill: Description (rich text, required)
     ├── Pick: Start Date (required)
     ├── Pick: End Date (required, ≥ Start Date)
     ├── Select: Assign Persons (multi-select, searchable)
     │         └── Can select auditors from ANY team
     ├── Select: Priority (Low / Medium / High / Critical)
     └── Auto-tag: Team(s) based on selected persons
     │
     ▼
Click "Submit"
     │
     ▼
Validation (frontend Zod + backend Zod)
     │
     ├──[Fail]──► Show inline field errors
     │
     └──[Pass]──► POST /api/tasks
                     │
                     ▼
               Task saved to DB
               status = "new"
                     │
                     ▼
               Notification dispatched to each assigned auditor:
                   - In-app notification (WebSocket push)
                   - Email notification (BullMQ job → SMTP)
                     │
                     ▼
               Task appears in each auditor's
               Kanban board → "New Tasks" column
```

---

## 4. Auditor Task Flow

### 4.1 Receiving & Starting a Task
```
Auditor receives notification (bell icon + email)
     │
     ▼
Auditor opens Dashboard → Kanban Board
     │
     ▼
Task visible in "New Tasks" column
     │
     ▼
Auditor clicks task card → Task Detail page
     │
     ▼
Auditor clicks "Start Task" → drags card to "In Progress"
     │
     ▼
PATCH /api/tasks/:id/status { status: "in_progress" }
     │
     ▼
Status updated, timestamp logged
Manager notified (in-app)
```

### 4.2 Completing a Task
```
Auditor is on a task with status "in_progress"
     │
     ▼
Auditor clicks "Mark as Complete"
     │
     ▼
Confirmation modal: "Submit task as complete?"
     │
     ▼
PATCH /api/tasks/:id/status { status: "completed" }
     │
     ▼
System checks: completedAt vs. endDate
     │
     ├──[Before deadline]──► marked "Completed Early" (green badge)
     └──[On/after deadline]─► marked "Completed" (standard)
     │
     ▼
Card moves to "Completed" column
Manager receives notification: "Task [Title] completed by [Auditor Name]"
```

### 4.3 Auditor-to-Auditor Task Assignment
```
Auditor is in Task Detail view
     │
     ▼
Clicks "Assign to Team Member"
     │
     ▼
Sub-task form opens:
     ├── Title (pre-filled from parent, editable)
     ├── Description
     ├── Start Date
     ├── End Date (defaults to parent end date)
     └── Assign Persons (multi-select, ANY team)
     │
     ▼
Submit → POST /api/tasks (with parentTaskId reference)
     │
     ▼
Selected auditors notified (in-app + email)
Sub-task appears in their Kanban board "New Tasks"
Parent task linked to sub-task (visible in Task Detail)
```

---

## 5. Notification Flow

```
Trigger Event Occurs
(e.g., task assigned / deadline approaching / task overdue)
     │
     ▼
Notification Service called
     │
     ├── Create Notification record in DB
     │       └── { userId, type, message, taskId, read: false }
     │
     ├── WebSocket emit to target user(s) via Socket.io
     │       └── User's bell icon updates (badge count +1)
     │
     └── Email Job pushed to BullMQ queue
               │
               ▼
         Worker processes job
               │
               ▼
         Nodemailer sends email via SMTP
```

### Reminder Scheduler Flow (Cron-based)
```
BullMQ Repeatable Job runs every hour
     │
     ▼
Query DB: tasks WHERE status != 'completed'
          AND endDate BETWEEN now AND now+48hrs
     │
     ▼
For each task found:
     ├── Has reminder already been sent for this window? (Redis check)
     │       ├──[Yes]──► Skip
     │       └──[No]───► Send reminder notification + mark in Redis
     │
     └── Auditors receive:
             - In-app: "⚠ Task [Title] due in 48 hours"
             - Email: Deadline reminder email

─────────────────────────────────────

Separate Cron: Daily overdue check
     │
     ▼
Query DB: tasks WHERE status != 'completed'
          AND endDate < now (yesterday)
     │
     ▼
For each overdue task:
     ├── Mark task card as "Overdue" (if not already)
     ├── Send daily reminder to assigned auditor(s)
     └── Send overdue alert to manager
```

---

## 6. Manager Oversight Flow

```
Manager Dashboard
     │
     ├── Summary Cards (real-time)
     │       ├── Total Active Tasks
     │       ├── Overdue Tasks (clickable → filtered list)
     │       ├── Completed This Week
     │       └── In Progress
     │
     ├── Team View
     │       ├── Filter: All Teams | IT Audit | Project Audit | System Audit | COE
     │       └── Kanban or List view per team
     │
     └── Individual Auditor View
             ├── Select auditor from dropdown
             ├── See their Kanban board (read-only)
             ├── Completion rate (%)
             ├── Overdue count
             └── Task history timeline
```

---

## 7. Complete End-to-End Flow Diagram

```
[Admin]
  └─ Creates Users, Assigns Roles & Teams
         │
         ▼
[Manager]
  └─ Creates Task → Assigns to Auditor(s)
         │
         ▼
[Notification Engine]
  └─ Notifies assigned Auditor(s) via WebSocket + Email
         │
         ▼
[Auditor]
  └─ Views task in Kanban "New Tasks"
  └─ Starts task → moves to "In Progress"
  └─ (Optional) Assigns sub-task to other Auditor(s)
         │
         ├──[Completes before deadline]──► Marks Complete (Early)
         │                                  └─ Manager notified
         │
         ├──[Completes on time]──────────► Marks Complete
         │                                  └─ Manager notified
         │
         └──[Misses deadline]────────────► Overdue flag set
                                           └─ Daily reminders sent
                                           └─ Manager overdue alert

[Manager]
  └─ Monitors team and individual dashboards in real-time
  └─ Receives notifications on completions and overdue tasks
```

---

## 8. Role-Based Route Access

| Route | Admin | Manager | Auditor |
|-------|-------|---------|---------|
| `/admin/*` | ✅ | ❌ | ❌ |
| `/manager/dashboard` | ✅ | ✅ | ❌ |
| `/manager/tasks/new` | ❌ | ✅ | ❌ |
| `/manager/team-view` | ✅ | ✅ | ❌ |
| `/auditor/dashboard` | ❌ | ❌ | ✅ |
| `/auditor/tasks/:id` | ❌ | ✅ (read) | ✅ |
| `/notifications` | ✅ | ✅ | ✅ |
| `/profile` | ✅ | ✅ | ✅ |
