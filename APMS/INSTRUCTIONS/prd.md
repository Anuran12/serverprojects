# Product Requirements Document (PRD)
## Audit Project Management System (APMS)

**Version:** 1.0.0  
**Last Updated:** 2026-03-09  
**Status:** Draft  
**Primary Color:** #042E6F | Theme: Light

---

## 1. Executive Summary

The **Audit Project Management System (APMS)** is an internal web-based platform designed to streamline task assignment, tracking, and collaboration across four audit teams. The system introduces role-based access for Admins, Managers, and Auditors, enabling structured task flows, real-time notifications, deadline enforcement, and visual progress tracking through a Kanban-style dashboard.

---

## 2. Problem Statement

Currently, audit task assignments and progress tracking are handled informally (email, spreadsheets, verbal communication), leading to:

- Missed deadlines with no automated reminders
- Lack of visibility into team and individual workloads
- No centralized record of task history or audit trails
- Difficulty for managers to monitor cross-team progress
- No formal handoff or delegation mechanism between auditors

---

## 3. Goals & Objectives

| Goal | Metric |
|------|--------|
| Centralize task management | 100% of tasks created within the system |
| Reduce missed deadlines | Automated reminders ≥ 48 hrs before deadline |
| Improve manager visibility | Real-time dashboard with team & individual views |
| Enable auditor collaboration | Multi-auditor task assignment across teams |
| Provide audit trail | Full activity log per task and per user |

---

## 4. Scope

### In Scope
- User authentication and role-based access control (RBAC)
- Task creation, assignment, tracking, and completion
- Kanban board per user dashboard
- Notification system (in-app + email)
- Manager oversight dashboard (team and individual views)
- Admin user and system management panel
- Multi-team and cross-team task assignment

### Out of Scope (v1.0)
- Mobile native app (iOS/Android)
- Third-party integrations (Jira, Slack, MS Teams)
- Automated report generation / PDF exports
- Billing or payroll integration
- AI-powered task suggestions

---

## 5. User Roles & Permissions

### 5.1 Admin
- Full system access
- Create, edit, deactivate users
- Assign roles and team memberships
- View all tasks, all teams, system logs
- Configure system settings (notification templates, deadlines thresholds)
- Cannot be assigned tasks

### 5.2 Manager
- Create and assign tasks to one or multiple auditors
- View own tasks (if any)
- View team-level task board (all teams or filtered by team)
- View individual auditor activity and workload
- Receive notifications on task completions and overdue tasks
- Cannot approve/reject tasks in v1.0 (view only beyond assignment)

### 5.3 Auditor
- View personal Kanban dashboard
- Receive task assignments with notifications
- Update task status (New → In Progress → Completed)
- Assign tasks to other auditors (same team or cross-team), selecting multiple assignees
- Receive deadline reminder notifications
- Submit tasks as complete before or on deadline

---

## 6. Teams

| Team ID | Team Name |
|---------|-----------|
| T01 | IT Audit Team |
| T02 | Project Audit Team |
| T03 | System Audit Team |
| T04 | COE Team |

Each auditor belongs to one primary team. Managers can oversee one or all teams (configurable by Admin).

---

## 7. Core Features

### 7.1 Task Creation (Manager)
- **Form Fields:**
  - Project Title (required, max 120 chars)
  - Description (required, rich text, max 2000 chars)
  - Start Date (date picker, required)
  - End Date (date picker, required, must be ≥ Start Date)
  - Assign Persons (multi-select dropdown, searchable by name/team)
  - Priority Level (Low / Medium / High / Critical)
  - Team Tag (auto-populated or manually selectable)
- **Actions:** Save Draft | Submit
- On submit → assigned auditors receive in-app + email notification

### 7.2 Task Assignment (Auditor-to-Auditor)
- Auditor can create a sub-task or delegate from within a task detail view
- Select one or multiple auditors (same team or cross-team)
- Sub-tasks inherit parent task's end date by default (overridable)
- Notifications sent to newly assigned auditors

### 7.3 Kanban Dashboard (Auditor)
- Three columns:
  - **New Tasks** – Assigned but not started
  - **In Progress** – Actively being worked on
  - **Completed** – Submitted as done
- Drag-and-drop card movement between columns
- Each card shows: Title, Priority badge, Due Date, Assignee avatars, Team tag
- Click card → Task Detail modal/page

### 7.4 Manager Oversight Dashboard
- Summary cards: Total Tasks, Overdue, In Progress, Completed (this week/month)
- Team-level view: Kanban or list per team
- Individual auditor view: workload, task history, completion rate
- Filter by: Team | Auditor | Date range | Priority | Status

### 7.5 Notification System
- **Trigger events:**
  - Task assigned (immediate)
  - Task status changed (immediate)
  - Deadline reminder (48 hrs before, 24 hrs before, day-of)
  - Task overdue (day after deadline, daily until resolved)
  - Task completed (notify assigning manager)
- **Channels:** In-app notification bell + Email

### 7.6 Task Completion & Overdue Handling
- Auditor clicks "Mark as Complete" → moves to Completed column
- If before end date → task marked "Completed Early"
- If end date passes without completion:
  - Task card flagged as "Overdue" (red border)
  - Daily reminder notification sent to auditor
  - Manager receives overdue alert

---

## 8. Non-Functional Requirements

| Category | Requirement |
|----------|-------------|
| Performance | Page load < 2s on standard broadband |
| Availability | 99.5% uptime (excluding planned maintenance) |
| Security | JWT authentication, HTTPS, RBAC enforcement server-side |
| Scalability | Support up to 500 concurrent users |
| Accessibility | WCAG 2.1 AA compliance |
| Browser Support | Chrome, Firefox, Edge, Safari (latest 2 versions) |
| Data Retention | Task history retained for 3 years |
| Audit Log | All actions logged with timestamp and user ID |

---

## 9. User Stories

### Admin
- As an Admin, I can create user accounts and assign roles and teams
- As an Admin, I can deactivate users who leave the organization
- As an Admin, I can view system-wide activity logs

### Manager
- As a Manager, I can create a task with full details and assign it to multiple auditors
- As a Manager, I can view the Kanban board for each team
- As a Manager, I can see which auditor has the most overdue tasks
- As a Manager, I receive a notification when an auditor completes a task I assigned

### Auditor
- As an Auditor, I receive an in-app and email notification when a task is assigned to me
- As an Auditor, I can drag my task card from "New" to "In Progress" to "Completed"
- As an Auditor, I can assign a task to one or more other auditors from any team
- As an Auditor, I receive a reminder 48 hours before my task deadline
- As an Auditor, I can submit a task as complete before the deadline

---

## 10. Success Criteria

- All task assignments happen within the system (0% external assignment)
- Deadline reminder delivery rate ≥ 98%
- Manager dashboard reflects real-time task status
- System handles 200 concurrent users with < 2s response time
- Zero role permission bypass incidents post-launch

---

## 11. Timeline (High-Level)

| Phase | Description | Duration |
|-------|-------------|----------|
| Phase 1 | Auth, RBAC, User Management, DB Schema | 2 weeks |
| Phase 2 | Task CRUD, Assignment, Notifications | 3 weeks |
| Phase 3 | Kanban Dashboard, Manager Dashboard | 2 weeks |
| Phase 4 | Overdue Logic, Reminder Scheduler | 1 week |
| Phase 5 | Testing, QA, UAT | 2 weeks |
| Phase 6 | Deployment & Go-Live | 1 week |

**Estimated Total:** ~11 weeks

---

## 12. Stakeholders

| Role | Name/Team | Responsibility |
|------|-----------|----------------|
| Product Owner | Management | Approvals & priorities |
| Dev Lead | Engineering | Technical decisions |
| QA Lead | QA Team | Test planning & execution |
| Admin Users | IT Dept | System configuration |
| End Users | All Auditors & Managers | UAT feedback |
