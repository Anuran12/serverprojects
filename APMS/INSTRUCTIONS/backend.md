# Backend Architecture & API Documentation
## Audit Project Management System (APMS)

**Version:** 1.0.0  
**Last Updated:** 2026-03-09  
**Runtime:** Node.js 20 LTS | Framework: Express.js + TypeScript

---

## 1. Architecture Overview

The backend follows a **Layered Architecture** pattern:

```
HTTP Request
     │
     ▼
┌─────────────────┐
│   Middleware     │  (auth, rate-limit, validation, logging)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│    Router       │  (route definitions, versioned under /api/v1)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Controller    │  (parse request, call service, return response)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│    Service      │  (business logic, orchestration)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Repository    │  (Prisma DB queries, data access)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  PostgreSQL DB  │
└─────────────────┘
```

---

## 2. Project Structure

```
apps/api/
├── src/
│   ├── config/
│   │   ├── database.ts        # Prisma client singleton
│   │   ├── redis.ts           # Redis client
│   │   ├── env.ts             # Environment variables (zod-validated)
│   │   └── mailer.ts          # Nodemailer transport setup
│   │
│   ├── middleware/
│   │   ├── auth.ts            # JWT verification middleware
│   │   ├── rbac.ts            # Role-based access control guard
│   │   ├── validate.ts        # Zod request validation middleware
│   │   ├── errorHandler.ts    # Global error handler
│   │   └── requestLogger.ts   # Winston request logger
│   │
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── auth.router.ts
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   └── auth.schema.ts
│   │   ├── users/
│   │   │   ├── users.router.ts
│   │   │   ├── users.controller.ts
│   │   │   ├── users.service.ts
│   │   │   ├── users.repository.ts
│   │   │   └── users.schema.ts
│   │   ├── tasks/
│   │   │   ├── tasks.router.ts
│   │   │   ├── tasks.controller.ts
│   │   │   ├── tasks.service.ts
│   │   │   ├── tasks.repository.ts
│   │   │   └── tasks.schema.ts
│   │   ├── teams/
│   │   │   └── ...
│   │   └── notifications/
│   │       ├── notifications.router.ts
│   │       ├── notifications.controller.ts
│   │       ├── notifications.service.ts
│   │       └── notifications.repository.ts
│   │
│   ├── jobs/
│   │   ├── queues.ts          # BullMQ queue definitions
│   │   ├── emailWorker.ts     # Email job processor
│   │   └── reminderWorker.ts  # Deadline reminder scheduler
│   │
│   ├── socket/
│   │   └── socketServer.ts    # Socket.io server + event handlers
│   │
│   ├── utils/
│   │   ├── ApiError.ts        # Custom error class
│   │   ├── ApiResponse.ts     # Standardized response wrapper
│   │   ├── logger.ts          # Winston logger instance
│   │   └── dateUtils.ts       # Date helpers
│   │
│   ├── prisma/
│   │   └── schema.prisma      # Database schema
│   │
│   └── index.ts               # App entry point
│
├── tests/
│   ├── unit/
│   └── integration/
├── .env.example
├── Dockerfile
└── package.json
```

---

## 3. Database Schema (Prisma)

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role {
  ADMIN
  MANAGER
  AUDITOR
}

enum TaskStatus {
  NEW
  IN_PROGRESS
  COMPLETED
  OVERDUE
}

enum Priority {
  LOW
  MEDIUM
  HIGH
  CRITICAL
}

enum TeamName {
  IT_AUDIT
  PROJECT_AUDIT
  SYSTEM_AUDIT
  COE
}

model Team {
  id        String   @id @default(cuid())
  name      TeamName @unique
  members   User[]
  tasks     Task[]   @relation("TeamTasks")
  createdAt DateTime @default(now())
}

model User {
  id                String         @id @default(cuid())
  name              String
  email             String         @unique
  passwordHash      String
  role              Role
  teamId            String?
  team              Team?          @relation(fields: [teamId], references: [id])
  isActive          Boolean        @default(true)
  createdAt         DateTime       @default(now())
  updatedAt         DateTime       @updatedAt
  assignedTasks     TaskAssignee[]
  createdTasks      Task[]         @relation("CreatedBy")
  notifications     Notification[]
  activityLogs      ActivityLog[]
}

model Task {
  id            String         @id @default(cuid())
  title         String
  description   String
  status        TaskStatus     @default(NEW)
  priority      Priority       @default(MEDIUM)
  startDate     DateTime
  endDate       DateTime
  completedAt   DateTime?
  isEarlySubmit Boolean        @default(false)
  parentTaskId  String?
  parentTask    Task?          @relation("SubTasks", fields: [parentTaskId], references: [id])
  subTasks      Task[]         @relation("SubTasks")
  createdById   String
  createdBy     User           @relation("CreatedBy", fields: [createdById], references: [id])
  teamId        String?
  team          Team?          @relation("TeamTasks", fields: [teamId], references: [id])
  assignees     TaskAssignee[]
  notifications Notification[]
  activityLogs  ActivityLog[]
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt
}

model TaskAssignee {
  id        String   @id @default(cuid())
  taskId    String
  task      Task     @relation(fields: [taskId], references: [id], onDelete: Cascade)
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  assignedAt DateTime @default(now())

  @@unique([taskId, userId])
}

model Notification {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  taskId    String?
  task      Task?    @relation(fields: [taskId], references: [id])
  type      String   // TASK_ASSIGNED | TASK_COMPLETED | DEADLINE_REMINDER | OVERDUE_ALERT
  message   String
  read      Boolean  @default(false)
  createdAt DateTime @default(now())
}

model ActivityLog {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  taskId    String?
  task      Task?    @relation(fields: [taskId], references: [id])
  action    String   // TASK_CREATED | STATUS_CHANGED | TASK_ASSIGNED | etc.
  metadata  Json?
  createdAt DateTime @default(now())
}
```

---

## 4. API Endpoints

**Base URL:** `/api/v1`  
**Auth Header:** `Authorization: Bearer <accessToken>`

---

### 4.1 Authentication

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/login` | Public | Login with email + password |
| POST | `/auth/refresh` | Cookie | Refresh access token |
| POST | `/auth/logout` | ✅ | Invalidate refresh token |
| GET | `/auth/me` | ✅ | Get current user profile |

**POST /auth/login**
```json
// Request
{ "email": "auditor@company.com", "password": "secret123" }

// Response 200
{
  "accessToken": "eyJ...",
  "user": { "id": "cuid", "name": "John", "role": "AUDITOR", "team": "IT_AUDIT" }
}
```

---

### 4.2 Users (Admin only for write operations)

| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| GET | `/users` | Admin, Manager | List all users (with filters) |
| POST | `/users` | Admin | Create a new user |
| GET | `/users/:id` | Admin, Manager | Get user by ID |
| PATCH | `/users/:id` | Admin | Update user (role, team, status) |
| DELETE | `/users/:id` | Admin | Deactivate user |
| GET | `/users/:id/tasks` | Admin, Manager | Get user's task history |

**POST /users**
```json
// Request
{
  "name": "Jane Doe",
  "email": "jane@company.com",
  "password": "TempPass123!",
  "role": "AUDITOR",
  "teamId": "team_cuid_here"
}

// Response 201
{ "id": "cuid", "name": "Jane Doe", "email": "jane@company.com", "role": "AUDITOR" }
```

---

### 4.3 Teams

| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| GET | `/teams` | All | List all teams |
| GET | `/teams/:id` | All | Get team with members |
| GET | `/teams/:id/tasks` | Admin, Manager | Get all tasks for a team |

---

### 4.4 Tasks

| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| GET | `/tasks` | All | List tasks (filtered by role scope) |
| POST | `/tasks` | Manager, Auditor | Create a new task |
| GET | `/tasks/:id` | All (scoped) | Get task detail |
| PATCH | `/tasks/:id` | Manager, Auditor | Update task fields |
| PATCH | `/tasks/:id/status` | Auditor | Update task status |
| POST | `/tasks/:id/assign` | Manager, Auditor | Assign additional users to a task |
| DELETE | `/tasks/:id` | Admin, Manager | Archive/delete a task |

**POST /tasks**
```json
// Request
{
  "title": "Q1 IT System Compliance Review",
  "description": "Conduct a full review of...",
  "startDate": "2026-03-15",
  "endDate": "2026-03-30",
  "priority": "HIGH",
  "assigneeIds": ["user_cuid_1", "user_cuid_2"],
  "parentTaskId": null
}

// Response 201
{
  "id": "task_cuid",
  "title": "Q1 IT System Compliance Review",
  "status": "NEW",
  "assignees": [{ "id": "user_cuid_1", "name": "John" }, ...],
  "createdAt": "2026-03-09T10:00:00Z"
}
```

**PATCH /tasks/:id/status**
```json
// Request
{ "status": "IN_PROGRESS" }

// Response 200
{ "id": "task_cuid", "status": "IN_PROGRESS", "updatedAt": "..." }
```

---

### 4.5 Notifications

| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| GET | `/notifications` | All | Get current user's notifications |
| PATCH | `/notifications/:id/read` | All | Mark a notification as read |
| PATCH | `/notifications/read-all` | All | Mark all notifications as read |
| DELETE | `/notifications/:id` | All | Delete a notification |

---

## 5. Standard Response Format

```typescript
// Success
{
  "success": true,
  "data": { ... },
  "message": "Task created successfully"
}

// Error
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "End date must be after start date",
    "details": [{ "field": "endDate", "message": "..." }]
  }
}
```

---

## 6. Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Missing or invalid token |
| `FORBIDDEN` | 403 | Insufficient role permissions |
| `NOT_FOUND` | 404 | Resource does not exist |
| `VALIDATION_ERROR` | 422 | Request body validation failed |
| `CONFLICT` | 409 | Duplicate resource (e.g., email exists) |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

---

## 7. WebSocket Events (Socket.io)

```
Client connects: socket.emit('authenticate', { token })
Server validates token → joins user to private room: user:<userId>

Server → Client Events:
  'notification:new'     → { notification object }
  'task:status_changed'  → { taskId, newStatus, updatedBy }
  'task:assigned'        → { task object }

Client → Server Events:
  'authenticate'         → { token }
  'notification:read'    → { notificationId }
```

---

## 8. Background Jobs (BullMQ)

### Email Queue (`email-queue`)
| Job Name | Trigger | Payload |
|----------|---------|---------|
| `send-task-assigned` | Task created | `{ to, taskTitle, assignerName, dueDate }` |
| `send-deadline-reminder` | Cron check | `{ to, taskTitle, hoursLeft }` |
| `send-overdue-alert` | Cron check | `{ to, taskTitle, managerEmail }` |
| `send-task-completed` | Status → COMPLETED | `{ managerEmail, taskTitle, completedBy }` |

### Reminder Queue (`reminder-queue`)
- Repeatable job: every 1 hour
- Queries tasks with `endDate` within next 48 hours
- Deduplication via Redis key: `reminder:<taskId>:<window>`

---

## 9. Environment Variables

```env
# App
NODE_ENV=development
PORT=4000
FRONTEND_URL=http://localhost:5173

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/apms_db

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_ACCESS_SECRET=your_access_secret_here
JWT_REFRESH_SECRET=your_refresh_secret_here
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Email (SMTP)
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=your_smtp_password
EMAIL_FROM=noreply@apms.company.com
```

---

## 10. Security Middleware Stack

```typescript
// Applied in order on every request:
app.use(helmet())              // Security headers
app.use(cors(corsOptions))     // CORS whitelist
app.use(express.json())        // Body parser
app.use(requestLogger)         // Log all requests
app.use('/api/auth', authLimiter)  // Rate limit auth routes

// On protected routes:
router.use(authenticate)       // Verify JWT
router.use(authorize('MANAGER', 'ADMIN'))  // RBAC guard
```
