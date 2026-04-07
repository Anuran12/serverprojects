# Audit DIGILIB Search

A self-hosted audit-report search system with semantic + hybrid search, PDF rendering, and inline highlights. Designed for offline deployment (IIS + Docker) with PostgreSQL, pgvector (HNSW), ChromaDB fallback, Redis caching, and background ingestion.

## Features
- Semantic, PG Vector, Keyword, and Hybrid search
- Gmail-like results list with PDF page preview
- Phrase/Terms/Clear highlight modes (per-user, persisted)
- Admin ingestion queue (background worker)
- Audit metadata filters (Year, Division, Type, Unit, Manager)
- OCR fallback for scanned PDFs (Tesseract/PaddleOCR)
- Monitoring endpoints

## Folder Layout (PDFs)
```
Audit Report/
  2019-2021/
    IT AUDIT/
    System audit/
    Project Audit/
  2022-2024/
    ...
  2025-2027/
    ...
```

## Requirements
- Docker Desktop
- Models downloaded locally (offline)
  - `models/bge-base-en-v1.5`
  - `models/ms-marco-MiniLM-L-6-v2`

## Secrets (.env)
Create a `.env` from `.env.example` and update:
- `JWT_SECRET`
- `POSTGRES_PASSWORD`
- `PGBOUNCER_PASSWORD`

Also update `db/pgbouncer/userlist.txt` with the md5 hash for PgBouncer.

## Start (Development)
```
docker compose up --build
```

## Start (Production)
```
docker compose -f docker-compose.prod.yml up -d --build
```

## URLs
- Frontend: http://localhost:8080
- Backend: http://localhost:9000 (dev only)
- IIS reverse proxy uses `/api/*`

## Login Credentials (default)
- **Admin**: `admin@gmail.com` / `Admin@123`
- **User**: `user@gmail.com` / `User@123`

## Ingest Documents
1. Login as admin
2. Click **Ingest PDFs**
3. Backend enqueues the job
4. Check status (optional):
```
GET /ingest/status/{job_id}
```

## Search
1. Enter a query in the search bar
2. Select search mode:
   - **Semantic**: ChromaDB (vector)
   - **PG Vector**: PostgreSQL pgvector
   - **Keyword**: Full-text search
   - **Hybrid**: FTS + vector + rerank
3. Use filters (Audit Year, Division, Type, Unit, Manager)
4. View results
   - **Text View**: snippet with highlights
   - **PDF View**: inline PDF page + highlight overlay

## Highlight Modes
- **Phrase**: exact phrase across multiple lines
- **Terms**: individual word matches
- **Clear**: no highlights

## How It Works (High-Level)
1. **Ingestion**
   - Extract text from PDFs (PyMuPDF, pdfplumber, OCR fallback)
   - Split into chunks
   - Store in Postgres + ChromaDB
2. **Search**
   - Embed query
   - Run search via PG Vector / Chroma / Hybrid
   - Rerank candidates (cross-encoder)
   - Return results + page number + snippet
3. **Rendering**
   - PDF.js renders page
   - Highlights are drawn using text layer mapping

## Monitoring
- `GET /metrics` (app metrics)
- `GET /metrics/pg` (top slow queries)

## Notes
- Migration for 768-dim embeddings + FTS + HNSW:
  `db/migrations/2026_02_10_vector_fts_hnsw.sql`
- Re-run ingestion after migration.

## Troubleshooting
- If no results, confirm ingestion completed.
- Ensure models exist in `/models`.
- For offline IIS, ensure `frontend/vendor/pdfjs` is present.

