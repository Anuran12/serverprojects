# Requirements Specification
## Audit Project Management System (APMS)

**Version:** 1.0.0  
**Last Updated:** 2026-03-09  
**Type:** Functional & Non-Functional Requirements

---

## 1. Functional Requirements

### 1.1 Authentication & Authorization

| ID | Requirement | Priority |
|----|-------------|----------|
| AUTH-01 | The system shall allow users to log in using email and password | Must Have |
| AUTH-02 | The system shall issue a short-lived JWT access token (15 min) and long-lived refresh token (7 days) upon successful login | Must Have |
| AUTH-03 | The system shall automatically refresh the access token before expiry using the refresh token stored in an httpOnly cookie | Must Have |
| AUTH-04 | The system shall enforce Role-Based Access Control (RBAC) for every API endpoint and frontend route | Must Have |
| AUTH-05 | The system shall support three roles: Admin, Manager, Auditor | Must Have |
| AUTH-06 | The system shall lock out a user after 5 consecutive failed login attempts for 15 minutes | Should Have |
| AUTH-07 | Users shall be able to log out, which invalidates the refresh token | Must Have |
| AUTH-08 | Passwords shall be hashed using bcrypt with a cost factor of 12 before storage | Must Have |

---

### 1.2 User Management

| ID | Requirement | Priority |
|----|-------------|----------|
| USR-01 | Admin shall be able to create user accounts with name, email, password, role, and team assignment | Must Have |
| USR-02 | Admin shall be able to edit a user's role or team assignment | Must Have |
| USR-03 | Admin shall be able to deactivate (soft-delete) a user account | Must Have |
| USR-04 | Deactivated users shall not be able to log in | Must Have |
| USR-05 | Deactivated users' historical tasks and logs shall be retained | Must Have |
| USR-06 | All users shall be able to update their own profile (name, password) | Should Have |
| USR-07 | Admin shall be able to view a list of all users with search and filter by role and team | Must Have |

---

### 1.3 Team Management

| ID | Requirement | Priority |
|----|-------------|----------|
| TEAM-01 | The system shall support four fixed teams: IT Audit, Project Audit, System Audit, COE | Must Have |
| TEAM-02 | Each auditor shall belong to one primary team | Must Have |
| TEAM-03 | Admin shall be able to move an auditor from one team to another | Must Have |
| TEAM-04 | Managers shall be able to view all teams and their members | Must Have |
| TEAM-05 | Team membership shall be displayed on user profiles and task cards | Should Have |

---

### 1.4 Task Management

| ID | Requirement | Priority |
|----|-------------|----------|
| TASK-01 | Manager shall be able to create a task with: Project Title, Description, Start Date, End Date, Priority, Assigned Persons | Must Have |
| TASK-02 | The task creation form shall support multi-select assignment of auditors searchable by name or team | Must Have |
| TASK-03 | Manager shall be able to assign a task to auditors from any team | Must Have |
| TASK-04 | Auditor shall be able to create and assign a sub-task to one or multiple auditors from the same or different team | Must Have |
| TASK-05 | A task shall have one of four statuses: New, In Progress, Completed, Overdue | Must Have |
| TASK-06 | Auditor shall be able to update a task status from New → In Progress → Completed | Must Have |
| TASK-07 | Auditor shall be able to mark a task as complete before the end date | Must Have |
| TASK-08 | When a task is completed before the end date, it shall be flagged as "Completed Early" | Should Have |
| TASK-09 | Task end date must be equal to or later than the start date; the system shall validate this | Must Have |
| TASK-10 | Manager shall be able to edit task details (title, description, dates, priority) after creation | Should Have |
| TASK-11 | Admin and Manager shall be able to archive/delete a task | Should Have |
| TASK-12 | Tasks shall display: title, priority badge, due date, assignee avatars, team tag, and status | Must Have |
| TASK-13 | Tasks shall support parent-child relationship for sub-task delegation | Must Have |
| TASK-14 | Manager shall be able to save a task as a draft before submitting | Nice to Have |

---

### 1.5 Kanban Board

| ID | Requirement | Priority |
|----|-------------|----------|
| KB-01 | Each auditor shall have a personal Kanban board with three columns: New Tasks, In Progress, Completed | Must Have |
| KB-02 | Auditor shall be able to drag and drop task cards between columns to update status | Must Have |
| KB-03 | Each Kanban column shall display a task count badge | Must Have |
| KB-04 | Overdue task cards shall be visually highlighted with a red border | Must Have |
| KB-05 | Clicking a task card shall open the full task detail view | Must Have |
| KB-06 | Manager shall be able to view any auditor's Kanban board in read-only mode | Must Have |
| KB-07 | Manager shall be able to view a team's combined Kanban board | Must Have |
| KB-08 | The Kanban board shall update in real-time when task status changes | Should Have |

---

### 1.6 Notification System

| ID | Requirement | Priority |
|----|-------------|----------|
| NOTIF-01 | Auditors shall receive an in-app and email notification immediately when a task is assigned to them | Must Have |
| NOTIF-02 | Auditors shall receive a reminder notification 48 hours before a task's end date | Must Have |
| NOTIF-03 | Auditors shall receive a reminder notification 24 hours before a task's end date | Must Have |
| NOTIF-04 | Auditors shall receive a reminder notification on the day of a task's end date | Must Have |
| NOTIF-05 | Auditors shall receive a daily overdue notification if a task is not submitted past the end date | Must Have |
| NOTIF-06 | Manager shall receive a notification when a task they assigned is marked complete | Must Have |
| NOTIF-07 | Manager shall receive an overdue alert when an assigned task passes its end date without completion | Must Have |
| NOTIF-08 | Notifications shall be displayed in a bell icon dropdown in the top navigation bar | Must Have |
| NOTIF-09 | Unread notifications shall display a count badge on the bell icon | Must Have |
| NOTIF-10 | Users shall be able to mark individual notifications or all notifications as read | Must Have |
| NOTIF-11 | Clicking a notification shall navigate the user to the related task | Must Have |
| NOTIF-12 | Duplicate reminder notifications for the same task and time window shall be prevented | Must Have |

---

### 1.7 Manager Dashboard

| ID | Requirement | Priority |
|----|-------------|----------|
| MGR-01 | Manager shall see summary cards: Total Active Tasks, Overdue Tasks, Due Soon, Completed This Week | Must Have |
| MGR-02 | Manager shall be able to view tasks filtered by team | Must Have |
| MGR-03 | Manager shall be able to view tasks filtered by individual auditor | Must Have |
| MGR-04 | Manager shall be able to filter tasks by date range, priority, and status | Must Have |
| MGR-05 | Manager shall be able to see an individual auditor's completion rate and overdue count | Must Have |
| MGR-06 | Manager's dashboard data shall reflect real-time task status | Should Have |
| MGR-07 | Manager shall be able to toggle between Kanban and List view for team tasks | Should Have |

---

### 1.8 Admin Panel

| ID | Requirement | Priority |
|----|-------------|----------|
| ADM-01 | Admin shall have access to a dedicated Admin Panel | Must Have |
| ADM-02 | Admin shall be able to view system-wide activity logs with timestamp and user ID | Must Have |
| ADM-03 | Admin shall be able to filter activity logs by user, date, and action type | Should Have |
| ADM-04 | Admin shall be able to configure notification thresholds (e.g., reminder windows) | Nice to Have |
| ADM-05 | Admin shall have read access to all tasks, all teams, and all user data | Must Have |

---

## 2. Non-Functional Requirements

### 2.1 Performance

| ID | Requirement | Target |
|----|-------------|--------|
| PERF-01 | Initial page load time | < 2 seconds on standard broadband |
| PERF-02 | API response time (95th percentile) | < 500ms |
| PERF-03 | Notification delivery latency (in-app) | < 2 seconds via WebSocket |
| PERF-04 | Kanban drag-and-drop interaction | 60fps, no jank |
| PERF-05 | System shall support 200 concurrent users without degradation | Benchmark required |

### 2.2 Security

| ID | Requirement |
|----|-------------|
| SEC-01 | All communication shall be over HTTPS (TLS 1.2+) |
| SEC-02 | RBAC shall be enforced server-side on every API route |
| SEC-03 | Passwords shall never be stored in plain text |
| SEC-04 | Refresh tokens shall be stored in httpOnly, Secure, SameSite=Strict cookies |
| SEC-05 | All user inputs shall be validated and sanitized on both client and server |
| SEC-06 | The system shall use parameterized queries to prevent SQL injection |
| SEC-07 | Rate limiting shall be applied to authentication endpoints (max 100 req/15min/IP) |
| SEC-08 | HTTP security headers shall be set via Helmet.js (CSP, X-Frame-Options, etc.) |

### 2.3 Reliability & Availability

| ID | Requirement |
|----|-------------|
| REL-01 | System uptime shall be ≥ 99.5% (excluding planned maintenance) |
| REL-02 | Email delivery failures shall be retried up to 3 times with exponential backoff |
| REL-03 | The system shall handle WebSocket disconnections gracefully and attempt reconnection |
| REL-04 | Database transactions shall ensure ACID compliance for task status changes |

### 2.4 Usability

| ID | Requirement |
|----|-------------|
| UX-01 | The UI shall comply with WCAG 2.1 Level AA accessibility guidelines |
| UX-02 | The system shall be fully functional on Chrome, Firefox, Edge, and Safari (latest 2 versions) |
| UX-03 | All form validation errors shall be displayed inline next to the relevant field |
| UX-04 | All destructive actions (delete, deactivate) shall require a confirmation dialog |
| UX-05 | The system shall display loading skeletons during data fetching (no blank screens) |
| UX-06 | Toast notifications shall be used to confirm successful actions |

### 2.5 Scalability

| ID | Requirement |
|----|-------------|
| SCALE-01 | The architecture shall support horizontal scaling of the API layer |
| SCALE-02 | Background jobs shall be processed by a scalable BullMQ worker queue |
| SCALE-03 | The database schema shall be indexed to support queries up to 10,000 tasks efficiently |

### 2.6 Maintainability

| ID | Requirement |
|----|-------------|
| MAINT-01 | Backend code shall have ≥ 80% unit test coverage on service layer |
| MAINT-02 | All API endpoints shall be documented in this backend.md |
| MAINT-03 | Database schema changes shall be managed through Prisma migrations |
| MAINT-04 | Environment configuration shall be managed via validated .env files |
| MAINT-05 | All application errors shall be logged with severity, timestamp, and context |

### 2.7 Data Retention

| ID | Requirement |
|----|-------------|
| DATA-01 | Task records and activity logs shall be retained for a minimum of 3 years |
| DATA-02 | Soft-deleted (deactivated) users' data shall be retained |
| DATA-03 | Notification records shall be retained for 90 days |

---

## 3. Constraints

- The system must be deployed on internal infrastructure (on-premise or private cloud)
- Email delivery must use the organization's existing SMTP infrastructure
- The system must support the English language only in v1.0
- No integration with external project management tools in v1.0
- The system is intended for internal employees only; no public registration

---

## 4. Assumptions

- All employees have a valid corporate email address
- Network connectivity is reliable within the corporate intranet
- The organization's SMTP server supports outbound email delivery
- Browser JavaScript is enabled for all users
- Admins will handle initial user provisioning (no self-registration)

---

## 5. Dependencies

| Dependency | Type | Risk |
|------------|------|------|
| PostgreSQL 16 server | Infrastructure | Low (well-established) |
| Redis 7 server | Infrastructure | Low |
| Corporate SMTP relay | External | Medium (delivery reliability) |
| Node.js 20 LTS | Runtime | Low |
| Internet access for CDN fonts | External | Low (can self-host) |
