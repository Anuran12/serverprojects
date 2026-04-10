# Tech Stack
## Audit Project Management System (APMS)

**Version:** 1.0.0  
**Last Updated:** 2026-03-09

---

## 1. Overview

The APMS is a full-stack web application built with a decoupled frontend and backend architecture. The stack prioritizes developer productivity, scalability, type safety, and maintainability.

```
┌─────────────────────────────────────────────┐
│              Client (Browser)               │
│         React + TypeScript + Vite           │
└────────────────────┬────────────────────────┘
                     │ REST API / WebSocket
┌────────────────────▼────────────────────────┐
│           Backend (Node.js / Express)        │
│         TypeScript + Prisma ORM             │
└────────────────────┬────────────────────────┘
                     │
        ┌────────────┴─────────────┐
        ▼                          ▼
┌───────────────┐        ┌──────────────────┐
│  PostgreSQL   │        │  Redis           │
│  (Primary DB) │        │  (Cache/Queue)   │
└───────────────┘        └──────────────────┘
```

---

## 2. Frontend

| Technology | Version | Purpose |
|------------|---------|---------|
| **React** | 18.x | UI component framework |
| **TypeScript** | 5.x | Type safety across the frontend |
| **Vite** | 5.x | Build tool and dev server |
| **React Router v6** | 6.x | Client-side routing |
| **TanStack Query** | 5.x | Server state, caching, background refetch |
| **Zustand** | 4.x | Lightweight global UI state management |
| **Tailwind CSS** | 3.x | Utility-first styling (primary: #042E6F) |
| **shadcn/ui** | latest | Accessible, composable UI components |
| **@dnd-kit** | 6.x | Drag-and-drop for Kanban board |
| **React Hook Form** | 7.x | Form state and validation |
| **Zod** | 3.x | Schema validation (shared with backend) |
| **date-fns** | 3.x | Date manipulation and formatting |
| **Lucide React** | latest | Icon library |
| **Sonner** | latest | Toast notifications |
| **Axios** | 1.x | HTTP client |
| **Socket.io-client** | 4.x | Real-time WebSocket notifications |

### Frontend Architecture Pattern
- Feature-based folder structure (not layer-based)
- Compound component pattern for complex UI
- Custom hooks for business logic abstraction
- API layer separated into service files

---

## 3. Backend

| Technology | Version | Purpose |
|------------|---------|---------|
| **Node.js** | 20.x LTS | JavaScript runtime |
| **Express.js** | 4.x | HTTP web framework |
| **TypeScript** | 5.x | Type safety across the backend |
| **Prisma ORM** | 5.x | Database ORM and migration tool |
| **PostgreSQL** | 16.x | Primary relational database |
| **Redis** | 7.x | Session caching, job queue backing |
| **BullMQ** | 5.x | Background job queue (reminders, emails) |
| **Socket.io** | 4.x | Real-time bidirectional communication |
| **JWT (jsonwebtoken)** | 9.x | Stateless authentication tokens |
| **bcrypt** | 5.x | Password hashing |
| **Nodemailer** | 6.x | Email delivery (SMTP) |
| **Zod** | 3.x | Request validation schemas |
| **Winston** | 3.x | Structured logging |
| **Helmet** | 7.x | HTTP security headers |
| **cors** | 2.x | Cross-Origin Resource Sharing |
| **express-rate-limit** | 7.x | API rate limiting |

### Backend Architecture Pattern
- Layered architecture: Router → Controller → Service → Repository
- Dependency injection via service constructors
- Centralized error handling middleware
- Request/response DTOs validated with Zod

---

## 4. Database

### Primary: PostgreSQL 16
- Relational schema for Users, Tasks, Teams, Notifications
- Full ACID compliance for task state transitions
- Indexed on: `user_id`, `task_id`, `team_id`, `status`, `due_date`

### Cache / Queue: Redis 7
- JWT token blacklist (on logout/revoke)
- BullMQ job queue backing store
- Rate limiting counter storage
- Session caching for frequently accessed data

---

## 5. DevOps & Infrastructure

| Tool | Purpose |
|------|---------|
| **Docker** | Containerization of all services |
| **Docker Compose** | Local multi-service orchestration |
| **GitHub Actions** | CI/CD pipeline (lint → test → build → deploy) |
| **Nginx** | Reverse proxy, SSL termination, static file serving |
| **PM2** | Node.js process management (production) |
| **Let's Encrypt** | Free SSL/TLS certificates |

### Environments
| Environment | Purpose |
|-------------|---------|
| `development` | Local dev with hot reload |
| `staging` | Pre-production UAT environment |
| `production` | Live system |

---

## 6. Testing

| Tool | Layer | Purpose |
|------|-------|---------|
| **Vitest** | Frontend | Unit & component tests |
| **React Testing Library** | Frontend | Component integration tests |
| **Jest** | Backend | Unit tests for services |
| **Supertest** | Backend | API endpoint integration tests |
| **Playwright** | E2E | Critical user flow end-to-end tests |

### Coverage Targets
- Backend services: ≥ 80% line coverage
- Frontend components: ≥ 70% line coverage
- Critical flows (task creation, notification, auth): 100%

---

## 7. Developer Tooling

| Tool | Purpose |
|------|---------|
| **ESLint** | Linting (Airbnb + TypeScript rules) |
| **Prettier** | Code formatting |
| **Husky** | Pre-commit hooks (lint + type-check) |
| **lint-staged** | Run linters only on staged files |
| **commitlint** | Conventional commit message enforcement |
| **tsx** | TypeScript execution for scripts |
| **concurrently** | Run frontend + backend dev servers together |

---

## 8. Email Service

- **Development:** Ethereal (fake SMTP for testing)
- **Production:** SMTP relay (e.g., SendGrid, AWS SES, or internal SMTP)
- Templates: HTML email templates with inline CSS
- Queue: BullMQ job for async delivery (non-blocking)

---

## 9. Security Stack

| Measure | Implementation |
|---------|----------------|
| Authentication | JWT (Access Token 15min + Refresh Token 7d) |
| Password Storage | bcrypt (cost factor 12) |
| HTTPS | Enforced via Nginx + Let's Encrypt |
| CORS | Whitelist only frontend domain |
| Rate Limiting | 100 req/15min per IP on auth endpoints |
| Input Validation | Zod schemas on all API routes |
| SQL Injection | Prisma parameterized queries |
| XSS | Helmet CSP headers + React's built-in escaping |
| RBAC | Server-side role checks on every protected route |

---

## 10. Repository Structure

```
apms/
├── apps/
│   ├── web/                  # React frontend (Vite)
│   └── api/                  # Express backend
├── packages/
│   └── shared/               # Shared Zod schemas, types, constants
├── docker-compose.yml
├── docker-compose.prod.yml
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── deploy.yml
└── README.md
```
> Monorepo managed with **pnpm workspaces**
