# APMS (Next.js + Express + PostgreSQL)

## Stack
- Frontend: Next.js (responsive, interactive Kanban UI)
- Backend: Express + Socket.IO + PostgreSQL
- Notifications: In-app real-time alerts (no SMTP)
- ORM/Cache: None (no Prisma, no Redis)

## Run
```bash
docker compose up --build
```

## URLs
- Frontend: http://localhost:3000
- Backend health: http://localhost:4000/health

## Demo Users
- `admin@itc.in` / `Admin1234`
- `manager@itc.in` / `Manager1234`
- `auditor@itc.in` / `Auditor1234`
