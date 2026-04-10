# Project Status Tracker
## Audit Project Management System (APMS)

**Version:** 1.0.0  
**Last Updated:** 2026-03-09  
**Overall Status:** 🟡 Planning / Pre-Development

---

## 1. Project Health Dashboard

| Dimension | Status | Notes |
|-----------|--------|-------|
| 📋 Planning | ✅ Complete | PRD, requirements, architecture documented |
| 🎨 Design | 🟡 In Progress | Design system defined; wireframes needed |
| 🏗️ Infrastructure | ⬜ Not Started | Docker, DB, Redis setup pending |
| 🔧 Backend | ⬜ Not Started | API development not yet begun |
| 💻 Frontend | ⬜ Not Started | UI development not yet begun |
| 🧪 Testing | ⬜ Not Started | Test suites not yet written |
| 🚀 Deployment | ⬜ Not Started | CI/CD pipeline not yet configured |

---

## 2. Phase Tracker

### Phase 1 — Foundation & Infrastructure
**Target Duration:** 2 weeks  
**Status:** ⬜ Not Started

| Task | Owner | Status | Notes |
|------|-------|--------|-------|
| Monorepo setup (pnpm workspaces) | Dev Lead | ⬜ | Vite + Express |
| Docker Compose (Postgres + Redis) | DevOps | ⬜ | |
| Prisma schema definition | Backend Dev | ⬜ | See backend.md schema |
| Initial DB migration | Backend Dev | ⬜ | |
| ESLint + Prettier + Husky config | Dev Lead | ⬜ | |
| GitHub Actions CI pipeline | DevOps | ⬜ | Lint + type-check + test |
| Shared types/schema package setup | Dev Lead | ⬜ | Zod schemas |
| Environment variable validation | Backend Dev | ⬜ | |

---

### Phase 2 — Authentication & User Management
**Target Duration:** 1.5 weeks  
**Status:** ⬜ Not Started

| Task | Owner | Status | Notes |
|------|-------|--------|-------|
| JWT login endpoint | Backend Dev | ⬜ | POST /auth/login |
| Refresh token endpoint | Backend Dev | ⬜ | httpOnly cookie |
| Logout + token invalidation | Backend Dev | ⬜ | Redis blacklist |
| RBAC middleware | Backend Dev | ⬜ | Admin/Manager/Auditor |
| User CRUD endpoints | Backend Dev | ⬜ | Admin only for write |
| Login page UI | Frontend Dev | ⬜ | |
| Auth store (Zustand) | Frontend Dev | ⬜ | |
| Token refresh interceptor (Axios) | Frontend Dev | ⬜ | |
| Protected route guard (React Router) | Frontend Dev | ⬜ | |
| App shell + sidebar layout | Frontend Dev | ⬜ | |
| Admin user management UI | Frontend Dev | ⬜ | |

---

### Phase 3 — Task Management Core
**Target Duration:** 2.5 weeks  
**Status:** ⬜ Not Started

| Task | Owner | Status | Notes |
|------|-------|--------|-------|
| Task CRUD API endpoints | Backend Dev | ⬜ | POST/GET/PATCH/DELETE |
| Task assignment logic (multi-user) | Backend Dev | ⬜ | |
| Sub-task (auditor→auditor) support | Backend Dev | ⬜ | parentTaskId |
| Task status transition logic | Backend Dev | ⬜ | NEW→IN_PROGRESS→COMPLETED |
| Overdue flag logic | Backend Dev | ⬜ | endDate < now |
| Early completion detection | Backend Dev | ⬜ | completedAt < endDate |
| Task creation form (Manager UI) | Frontend Dev | ⬜ | |
| AssigneeSelector component | Frontend Dev | ⬜ | Multi-select + search |
| Task detail page | Frontend Dev | ⬜ | |
| Sub-task assignment UI | Frontend Dev | ⬜ | |
| Task status action buttons | Frontend Dev | ⬜ | |

---

### Phase 4 — Kanban Board
**Target Duration:** 1.5 weeks  
**Status:** ⬜ Not Started

| Task | Owner | Status | Notes |
|------|-------|--------|-------|
| KanbanBoard component | Frontend Dev | ⬜ | @dnd-kit |
| TaskCard component | Frontend Dev | ⬜ | With all badges |
| Drag-and-drop status update | Frontend Dev | ⬜ | Optimistic + API sync |
| Auditor dashboard page | Frontend Dev | ⬜ | |
| Manager team Kanban view | Frontend Dev | ⬜ | Read-only |
| Manager individual auditor view | Frontend Dev | ⬜ | |
| Real-time Kanban updates | Frontend Dev | ⬜ | Socket.io |
| Filter/sort controls | Frontend Dev | ⬜ | By team, priority, date |

---

### Phase 5 — Notifications & Real-Time
**Target Duration:** 1.5 weeks  
**Status:** ⬜ Not Started

| Task | Owner | Status | Notes |
|------|-------|--------|-------|
| Socket.io server setup | Backend Dev | ⬜ | |
| Notification DB model + service | Backend Dev | ⬜ | |
| BullMQ email queue + worker | Backend Dev | ⬜ | |
| Email templates (HTML) | Backend Dev | ⬜ | 4 templates |
| Deadline reminder cron job | Backend Dev | ⬜ | Hourly check |
| Overdue daily alert cron job | Backend Dev | ⬜ | Daily check |
| Notification API endpoints | Backend Dev | ⬜ | GET/PATCH/DELETE |
| NotificationDropdown component | Frontend Dev | ⬜ | Bell icon + list |
| Socket.io client + hooks | Frontend Dev | ⬜ | |
| Toast notifications (Sonner) | Frontend Dev | ⬜ | |
| Unread count badge | Frontend Dev | ⬜ | |

---

### Phase 6 — Manager Dashboard & Reports
**Target Duration:** 1 week  
**Status:** ⬜ Not Started

| Task | Owner | Status | Notes |
|------|-------|--------|-------|
| Summary stats API | Backend Dev | ⬜ | Aggregation queries |
| Team overview API | Backend Dev | ⬜ | |
| Individual auditor stats API | Backend Dev | ⬜ | Completion rate, overdue |
| Manager dashboard page | Frontend Dev | ⬜ | Summary cards |
| Team view (Kanban + List toggle) | Frontend Dev | ⬜ | |
| Individual auditor panel | Frontend Dev | ⬜ | |
| Date range + filter controls | Frontend Dev | ⬜ | |

---

### Phase 7 — Testing & QA
**Target Duration:** 2 weeks  
**Status:** ⬜ Not Started

| Task | Owner | Status | Notes |
|------|-------|--------|-------|
| Backend unit tests (Jest) | QA / Backend | ⬜ | Service layer ≥80% |
| API integration tests (Supertest) | QA / Backend | ⬜ | All endpoints |
| Frontend component tests (Vitest) | QA / Frontend | ⬜ | |
| E2E tests (Playwright) | QA | ⬜ | Critical flows |
| Security review | Security | ⬜ | RBAC, injection, XSS |
| Performance testing | QA | ⬜ | 200 concurrent users |
| UAT with stakeholders | PM | ⬜ | |
| Bug fixes from UAT | Dev Team | ⬜ | |

---

### Phase 8 — Deployment & Go-Live
**Target Duration:** 1 week  
**Status:** ⬜ Not Started

| Task | Owner | Status | Notes |
|------|-------|--------|-------|
| Production server provisioning | DevOps | ⬜ | |
| Nginx config + SSL (Let's Encrypt) | DevOps | ⬜ | |
| GitHub Actions deploy workflow | DevOps | ⬜ | |
| Production .env configuration | DevOps | ⬜ | |
| Database seeding (teams, admin user) | Backend Dev | ⬜ | |
| Smoke tests on production | QA | ⬜ | |
| User onboarding / admin training | PM | ⬜ | |
| Go-live sign-off | Stakeholders | ⬜ | |

---

## 3. Timeline Overview

```
Week  1–2  │ Phase 1: Foundation & Infrastructure
Week  3–4  │ Phase 2: Auth & User Management
Week  5–7  │ Phase 3: Task Management Core
Week  8–9  │ Phase 4: Kanban Board
Week 10–11 │ Phase 5: Notifications & Real-Time
Week   12  │ Phase 6: Manager Dashboard
Week 13–14 │ Phase 7: Testing & QA
Week   15  │ Phase 8: Deployment & Go-Live
```

**Estimated Go-Live:** ~15 weeks from kickoff

---

## 4. Issue & Risk Log

| ID | Type | Description | Severity | Status | Mitigation |
|----|------|-------------|----------|--------|------------|
| RISK-01 | Risk | SMTP relay configuration may delay email notifications | Medium | Open | Test early; use Ethereal in dev |
| RISK-02 | Risk | Drag-and-drop performance on large task lists | Low | Open | Virtualize list if >100 tasks |
| RISK-03 | Risk | WebSocket scalability with multiple server instances | Medium | Open | Use Redis adapter for Socket.io |
| RISK-04 | Risk | UAT feedback may require significant UI rework | High | Open | Early wireframe review with stakeholders |
| ISSUE-01 | Issue | — | — | — | — |

---

## 5. Milestone Dates

| Milestone | Target Date | Status |
|-----------|-------------|--------|
| 📄 Documentation Complete | 2026-03-09 | ✅ Done |
| 🏗️ Infrastructure Ready | TBD | ⬜ |
| 🔐 Auth Working (Dev) | TBD | ⬜ |
| ✅ Task CRUD Working (Dev) | TBD | ⬜ |
| 🗂️ Kanban MVP Ready | TBD | ⬜ |
| 🔔 Notifications Working | TBD | ⬜ |
| 🧪 QA Sign-off | TBD | ⬜ |
| 🚀 Production Go-Live | TBD | ⬜ |

---

## 6. Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Complete |
| 🟡 | In Progress |
| ⬜ | Not Started |
| 🔴 | Blocked |
| ❌ | Cancelled |
