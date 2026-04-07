from __future__ import annotations

import os
import time
from typing import List
import re

import chromadb
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from sqlalchemy import distinct, select, func, text
from sqlalchemy.orm import Session

from .auth import create_access_token, get_current_user, hash_password, require_admin, verify_password
from .config import settings
from .db import get_db
from .ingest import ingest_audit_reports
from .tasks import enqueue_ingest, queue
from .models import AuditChunk, AuditDocument, User
from .schemas import (
    FilterOptions,
    LoginRequest,
    SearchRequest,
    SearchResponse,
    TokenResponse,
    UserCreate,
    UserOut,
    UserUpdate,
)
from .search import (
    SearchService,
    build_metadata_filter,
    fetch_results,
    get_active_search_embedding_model_path,
    get_reranker,
)
from .cache import cache
from .metrics import metrics
from .health import startup_model_health
from .ingest import get_active_embedding_model_path


app = FastAPI(title="Audit DIGILIB Search")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def _seed_default_users(db: Session) -> None:
    defaults = [
        {
            "username": "admin@gmail.com",
            "email": "admin@gmail.com",
            "password": "Admin@123",
            "role": "admin",
            "is_active": True,
        },
        {
            "username": "user@gmail.com",
            "email": "user@gmail.com",
            "password": "User@123",
            "role": "user",
            "is_active": True,
        },
    ]

    for entry in defaults:
        exists = db.query(User).filter(User.username == entry["username"]).first()
        if exists:
            continue
        user = User(
            username=entry["username"],
            email=entry["email"],
            password_hash=hash_password(entry["password"]),
            role=entry["role"],
            is_active=entry["is_active"],
        )
        db.add(user)
    db.commit()


@app.on_event("startup")
def seed_users() -> None:
    db = next(get_db())
    try:
        _seed_default_users(db)
    finally:
        db.close()


@app.post("/auth/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == payload.username).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_access_token(user)
    return TokenResponse(access_token=token)


@app.get("/users", response_model=List[UserOut])
def list_users(_: User = Depends(require_admin), db: Session = Depends(get_db)):
    users = db.query(User).order_by(User.username.asc()).all()
    return [
        UserOut(
            id=str(user.id),
            username=user.username,
            email=user.email,
            role=user.role,
            is_active=user.is_active,
        )
        for user in users
    ]


@app.post("/users", response_model=UserOut)
def create_user(payload: UserCreate, _: User = Depends(require_admin), db: Session = Depends(get_db)):
    user = User(
        username=payload.username,
        email=payload.email,
        password_hash=hash_password(payload.password),
        role=payload.role,
        is_active=payload.is_active,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return UserOut(
        id=str(user.id),
        username=user.username,
        email=user.email,
        role=user.role,
        is_active=user.is_active,
    )


@app.put("/users/{user_id}", response_model=UserOut)
def update_user(user_id: str, payload: UserUpdate, _: User = Depends(require_admin), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if payload.email is not None:
        user.email = payload.email
    if payload.password is not None:
        user.password_hash = hash_password(payload.password)
    if payload.role is not None:
        user.role = payload.role
    if payload.is_active is not None:
        user.is_active = payload.is_active

    db.commit()
    db.refresh(user)
    return UserOut(
        id=str(user.id),
        username=user.username,
        email=user.email,
        role=user.role,
        is_active=user.is_active,
    )


@app.delete("/users/{user_id}")
def delete_user(user_id: str, _: User = Depends(require_admin), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(user)
    db.commit()
    return {"status": "deleted"}


@app.post("/ingest")
def ingest(_: User = Depends(require_admin)):
    job_id = enqueue_ingest()
    metrics.record_ingest_job()
    return {"status": "queued", "job_id": job_id}


@app.get("/ingest/preflight")
def ingest_preflight(_: User = Depends(require_admin), db: Session = Depends(get_db)):
    audit_root = settings.audit_root
    root_exists = os.path.isdir(audit_root)
    pdf_count = 0
    if root_exists:
        for root, _, files in os.walk(audit_root):
            for name in files:
                if name.lower().endswith(".pdf"):
                    pdf_count += 1

    db_ok = True
    db_error = None
    try:
        db.execute(text("SELECT 1"))
    except Exception as exc:
        db_ok = False
        db_error = str(exc)

    chroma_ok = True
    chroma_error = None
    try:
        client = chromadb.HttpClient(host=settings.chroma_host, port=settings.chroma_port)
        client.heartbeat()
    except Exception as exc:
        chroma_ok = False
        chroma_error = str(exc)

    model_health = startup_model_health(
        active_ingest_model=get_active_embedding_model_path(),
        active_search_model=get_active_search_embedding_model_path(),
    )

    ok = root_exists and pdf_count > 0 and db_ok and chroma_ok and model_health["status"] == "ok"
    issues = []
    if not root_exists:
        issues.append(f"AUDIT_ROOT not found: {audit_root}")
    if pdf_count == 0:
        issues.append("No PDF files found under AUDIT_ROOT.")
    if not db_ok:
        issues.append(f"Database check failed: {db_error}")
    if not chroma_ok:
        issues.append(f"Chroma check failed: {chroma_error}")
    if model_health["status"] != "ok":
        issues.append("No valid embedding model candidate found.")

    return {
        "ok": ok,
        "audit_root": audit_root,
        "audit_root_exists": root_exists,
        "pdf_count": pdf_count,
        "db_ok": db_ok,
        "db_error": db_error,
        "chroma_ok": chroma_ok,
        "chroma_error": chroma_error,
        "model_health": model_health,
        "issues": issues,
    }


@app.get("/ingest/status/{job_id}")
def ingest_status(job_id: str, _: User = Depends(require_admin)):
    job = queue.fetch_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    error = None
    if job.is_failed and job.exc_info:
        error = job.exc_info.splitlines()[-1]
    return {
        "job_id": job_id,
        "status": job.get_status(),
        "result": job.result,
        "error": error,
    }


@app.post("/search", response_model=SearchResponse)
def search(payload: SearchRequest, _: User = Depends(get_current_user), db: Session = Depends(get_db)):
    start_time = time.time()
    warning = None
    cache_hit = False

    cache_key = f"search:{payload.search_type}:{payload.query}:{payload.min_score}:{payload.top_k}:{payload.offset}:{payload.filters.json()}"
    cached = cache.get(cache_key)
    if cached:
        cached["cache_hit"] = True
        metrics.record_search(0, True)
        return SearchResponse(**cached)

    if payload.search_type == "keyword":
        results, total = keyword_search(db, payload)
    elif payload.search_type == "hybrid":
        results, total = hybrid_search(db, payload)
    elif payload.search_type == "pgvector":
        results, total, warning = pgvector_search(db, payload)
    else:
        results, total, warning = semantic_search(db, payload)

    elapsed_ms = int((time.time() - start_time) * 1000)
    avg_score = sum(r["score"] for r in results) / len(results) if results else 0.0

    response = SearchResponse(
        results=results,
        total=total,
        returned=len(results),
        offset=payload.offset,
        avg_score=avg_score,
        search_time_ms=elapsed_ms,
        cache_hit=cache_hit,
        warning=warning,
    )
    cache.set(cache_key, response.dict(), settings.cache_ttl_seconds)
    metrics.record_search(elapsed_ms, cache_hit)
    return response


@app.get("/metrics")
def get_metrics(_: User = Depends(require_admin)):
    return metrics.snapshot()


@app.get("/metrics/pg")
def get_pg_metrics(_: User = Depends(require_admin), db: Session = Depends(get_db)):
    rows = db.execute(
        text(
            """
            SELECT calls, total_time, mean_time, query
            FROM pg_stat_statements
            ORDER BY total_time DESC
            LIMIT 10
            """
        )
    ).all()
    return [
        {"calls": row[0], "total_time": row[1], "mean_time": row[2], "query": row[3]}
        for row in rows
    ]


@app.get("/health/startup")
def startup_health():
    return startup_model_health(
        active_ingest_model=get_active_embedding_model_path(),
        active_search_model=get_active_search_embedding_model_path(),
    )


@app.get("/filters", response_model=FilterOptions)
def filters(_: User = Depends(get_current_user), db: Session = Depends(get_db)):
    def distinct_values(column):
        values = db.execute(select(distinct(column)).order_by(column.asc())).scalars().all()
        return [value for value in values if value]

    return FilterOptions(
        audit_year=distinct_values(AuditDocument.audit_year),
        division=distinct_values(AuditDocument.division),
        audit_type=distinct_values(AuditDocument.audit_type),
        unit=distinct_values(AuditDocument.unit),
        audit_manager=distinct_values(AuditDocument.audit_manager),
    )


@app.get("/stats")
def stats(_: User = Depends(get_current_user), db: Session = Depends(get_db)):
    total_documents = db.query(func.count(AuditDocument.id)).scalar() or 0
    total_chunks = db.query(func.count(AuditChunk.id)).scalar() or 0
    return {
        "total_documents": int(total_documents),
        "total_chunks": int(total_chunks),
    }


@app.get("/documents/{doc_id}/file")
def get_document_file(doc_id: str, _: User = Depends(get_current_user), db: Session = Depends(get_db)):
    doc = db.query(AuditDocument).filter(AuditDocument.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return FileResponse(doc.file_path, media_type="application/pdf", filename=doc.file_name)


def semantic_search(db: Session, payload: SearchRequest):
    search_service = SearchService()
    query_vector = search_service.embed_query(payload.query)
    metadata_filter = build_metadata_filter(payload.filters.dict())
    warning = None

    distance_expr = AuditChunk.embedding.cosine_distance(query_vector)
    score_expr = 1.0 - distance_expr

    count_query = (
        db.query(func.count(AuditChunk.id))
        .join(AuditDocument, AuditChunk.doc_id == AuditDocument.id)
        .filter(AuditChunk.embedding.isnot(None))
        .filter(score_expr >= payload.min_score)
    )

    filters = payload.filters
    if filters.audit_year:
        count_query = count_query.filter(AuditDocument.audit_year == filters.audit_year)
    if filters.division:
        count_query = count_query.filter(AuditDocument.division == filters.division)
    if filters.audit_type:
        count_query = count_query.filter(AuditDocument.audit_type == filters.audit_type)
    if filters.unit:
        count_query = count_query.filter(AuditDocument.unit == filters.unit)
    if filters.audit_manager:
        count_query = count_query.filter(AuditDocument.audit_manager == filters.audit_manager)

    try:
        total = count_query.scalar() or 0
    except Exception:
        total = 0
        warning = "Unable to compute exact total via pgvector; returning page results only."

    candidate_k = max(payload.top_k * 5, settings.rerank_candidates, payload.top_k + payload.offset)
    chroma_results = search_service.query(query_vector, candidate_k, metadata_filter)
    results, _ = fetch_results(db, chroma_results, payload.min_score, 0, None)

    # Fallback to pgvector rows if Chroma is empty/out-of-sync.
    if not results:
        pg_query = (
            db.query(AuditChunk, AuditDocument, score_expr.label("score"))
            .join(AuditDocument, AuditChunk.doc_id == AuditDocument.id)
            .filter(AuditChunk.embedding.isnot(None))
            .filter(score_expr >= payload.min_score)
        )
        if filters.audit_year:
            pg_query = pg_query.filter(AuditDocument.audit_year == filters.audit_year)
        if filters.division:
            pg_query = pg_query.filter(AuditDocument.division == filters.division)
        if filters.audit_type:
            pg_query = pg_query.filter(AuditDocument.audit_type == filters.audit_type)
        if filters.unit:
            pg_query = pg_query.filter(AuditDocument.unit == filters.unit)
        if filters.audit_manager:
            pg_query = pg_query.filter(AuditDocument.audit_manager == filters.audit_manager)

        rows = pg_query.order_by(distance_expr.asc()).limit(candidate_k).all()
        results = [
            {
                "doc_id": str(doc.id),
                "file_name": doc.file_name,
                "file_path": doc.file_path,
                "audit_type": doc.audit_type,
                "audit_year": doc.audit_year,
                "division": doc.division,
                "snippet": chunk.text,
                "score": float(score),
                "page_number": chunk.page_number,
                "chunk_index": chunk.chunk_index,
            }
            for chunk, doc, score in rows
        ]
        warning = "Chroma returned no matches; semantic search used pgvector fallback."

    results = rerank_results(payload.query, results, payload.offset, payload.top_k)
    return results, total, warning


def pgvector_search(db: Session, payload: SearchRequest):
    try:
        search_service = SearchService()
        query_vector = search_service.embed_query(payload.query)

        db.execute(text("SET LOCAL hnsw.ef_search = :v"), {"v": settings.hnsw_ef_search})
        distance_expr = AuditChunk.embedding.cosine_distance(query_vector)
        score_expr = 1.0 - distance_expr

        base_query = (
            db.query(AuditChunk, AuditDocument, score_expr.label("score"))
            .join(AuditDocument, AuditChunk.doc_id == AuditDocument.id)
            .filter(AuditChunk.embedding.isnot(None))
        )

        filters = payload.filters
        if filters.audit_year:
            base_query = base_query.filter(AuditDocument.audit_year == filters.audit_year)
        if filters.division:
            base_query = base_query.filter(AuditDocument.division == filters.division)
        if filters.audit_type:
            base_query = base_query.filter(AuditDocument.audit_type == filters.audit_type)
        if filters.unit:
            base_query = base_query.filter(AuditDocument.unit == filters.unit)
        if filters.audit_manager:
            base_query = base_query.filter(AuditDocument.audit_manager == filters.audit_manager)

        total = (
            base_query.filter(score_expr >= payload.min_score)
            .with_entities(func.count(AuditChunk.id))
            .scalar()
            or 0
        )

        candidate_k = max(payload.top_k * 5, settings.rerank_candidates, payload.top_k + payload.offset)
        rows = (
            base_query.filter(score_expr >= payload.min_score)
            .order_by(distance_expr.asc())
            .limit(candidate_k)
            .all()
        )

        results = []
        for chunk, doc, score in rows:
            results.append(
                {
                    "doc_id": str(doc.id),
                    "file_name": doc.file_name,
                    "file_path": doc.file_path,
                    "audit_type": doc.audit_type,
                    "audit_year": doc.audit_year,
                    "division": doc.division,
                    "snippet": chunk.text,
                    "score": float(score),
                    "page_number": chunk.page_number,
                    "chunk_index": chunk.chunk_index,
                }
            )

        results = rerank_results(payload.query, results, payload.offset, payload.top_k)
        return results, total, None
    except Exception:
        results, total, warning = semantic_search(db, payload)
        fallback_warning = "PG Vector search failed; fell back to Chroma results."
        if warning:
            fallback_warning = f"{fallback_warning} {warning}"
        return results, total, fallback_warning


def keyword_search(db: Session, payload: SearchRequest):
    query = db.query(AuditChunk, AuditDocument).join(AuditDocument, AuditChunk.doc_id == AuditDocument.id)

    filters = payload.filters
    if filters.audit_year:
        query = query.filter(AuditDocument.audit_year == filters.audit_year)
    if filters.division:
        query = query.filter(AuditDocument.division == filters.division)
    if filters.audit_type:
        query = query.filter(AuditDocument.audit_type == filters.audit_type)
    if filters.unit:
        query = query.filter(AuditDocument.unit == filters.unit)
    if filters.audit_manager:
        query = query.filter(AuditDocument.audit_manager == filters.audit_manager)

    query = query.filter(AuditChunk.tsv.op("@@")(func.plainto_tsquery("english", payload.query)))
    total = query.count()
    query = query.offset(payload.offset).limit(payload.top_k)

    results = []
    for chunk, doc in query.all():
        results.append(
            {
                "doc_id": str(doc.id),
                "file_name": doc.file_name,
                "file_path": doc.file_path,
                "audit_type": doc.audit_type,
                "audit_year": doc.audit_year,
                "division": doc.division,
                "snippet": chunk.text,
                "score": 0.75,
                "page_number": chunk.page_number,
                "chunk_index": chunk.chunk_index,
            }
        )

    return results, total


def hybrid_search(db: Session, payload: SearchRequest):
    search_service = SearchService()
    query_vector = search_service.embed_query(payload.query)

    db.execute(text("SET LOCAL hnsw.ef_search = :v"), {"v": settings.hnsw_ef_search})
    distance_expr = AuditChunk.embedding.cosine_distance(query_vector)
    score_expr = 1.0 - distance_expr

    base_query = (
        db.query(AuditChunk, AuditDocument, score_expr.label("score"))
        .join(AuditDocument, AuditChunk.doc_id == AuditDocument.id)
        .filter(AuditChunk.embedding.isnot(None))
        .filter(AuditChunk.tsv.op("@@")(func.plainto_tsquery("english", payload.query)))
    )

    filters = payload.filters
    if filters.audit_year:
        base_query = base_query.filter(AuditDocument.audit_year == filters.audit_year)
    if filters.division:
        base_query = base_query.filter(AuditDocument.division == filters.division)
    if filters.audit_type:
        base_query = base_query.filter(AuditDocument.audit_type == filters.audit_type)
    if filters.unit:
        base_query = base_query.filter(AuditDocument.unit == filters.unit)
    if filters.audit_manager:
        base_query = base_query.filter(AuditDocument.audit_manager == filters.audit_manager)

    total = (
        base_query.filter(score_expr >= payload.min_score)
        .with_entities(func.count(AuditChunk.id))
        .scalar()
        or 0
    )

    candidate_k = max(payload.top_k * 5, settings.rerank_candidates, payload.top_k + payload.offset)
    rows = (
        base_query.filter(score_expr >= payload.min_score)
        .order_by(distance_expr.asc())
        .limit(candidate_k)
        .all()
    )

    results = []
    for chunk, doc, score in rows:
        results.append(
            {
                "doc_id": str(doc.id),
                "file_name": doc.file_name,
                "file_path": doc.file_path,
                "audit_type": doc.audit_type,
                "audit_year": doc.audit_year,
                "division": doc.division,
                "snippet": chunk.text,
                "score": float(score),
                "page_number": chunk.page_number,
                "chunk_index": chunk.chunk_index,
            }
        )

    results = rerank_results(payload.query, results, payload.offset, payload.top_k)
    return results, total


def rerank_results(query: str, results: list, offset: int, limit: int):
    if not results:
        return results

    normalized_query = " ".join(query.lower().split())
    stop_words = {
        "a", "an", "the", "of", "to", "in", "on", "at", "for", "from", "by", "with",
        "and", "or", "but", "is", "are", "was", "were", "be", "been", "being", "as",
        "that", "this", "these", "those", "it", "its", "into", "about", "over", "under",
        "up", "down", "out", "off", "not", "no", "do", "does", "did", "can", "could",
        "will", "would", "should", "may", "might", "must", "have", "has", "had", "all",
    }
    raw_terms = [term for term in re.findall(r"[a-z0-9]+", normalized_query) if len(term) > 1]
    query_terms = [term for term in raw_terms if term not in stop_words]
    combinations = []
    for size in (2, 3):
        if len(query_terms) >= size:
            for idx in range(len(query_terms) - size + 1):
                combinations.append(" ".join(query_terms[idx : idx + size]))

    def lexical_score(text: str) -> float:
        snippet = (text or "").lower()
        if not snippet:
            return 0.0

        phrase_hit = 1.0 if normalized_query and normalized_query in snippet else 0.0
        combo_hits = sum(1 for combo in combinations if combo in snippet)
        combo_ratio = combo_hits / max(len(combinations), 1) if combinations else 0.0
        term_hits = sum(1 for term in query_terms if term in snippet) if query_terms else 0
        term_ratio = term_hits / max(len(query_terms), 1) if query_terms else 0.0
        return (4.0 * phrase_hit) + (2.0 * combo_ratio) + term_ratio

    for result in results:
        result["_lexical_score"] = lexical_score(result.get("snippet", ""))
        snippet = (result.get("snippet", "") or "").lower()
        result["_phrase_hit"] = bool(normalized_query and normalized_query in snippet)

    # Strict first pass: if phrase exists in any candidate, keep phrase hits only.
    if any(item["_phrase_hit"] for item in results):
        results = [item for item in results if item["_phrase_hit"]]
    # Fallback pass: otherwise keep lexical hits based on stopword-filtered term combinations.
    elif any(item["_lexical_score"] > 0 for item in results):
        results = [item for item in results if item["_lexical_score"] > 0]

    reranker = get_reranker()
    if reranker is None:
        results.sort(
            key=lambda item: (item.get("_lexical_score", 0.0), item.get("score", 0.0)),
            reverse=True,
        )
        for result in results:
            result.pop("_lexical_score", None)
            result.pop("_phrase_hit", None)
        if offset:
            results = results[offset:]
        if limit is not None:
            results = results[:limit]
        return results
    passages = [result.get("snippet", "") for result in results]
    scores = reranker.score(query, passages)
    for result, score in zip(results, scores):
        result["_rerank_score"] = score
    results.sort(
        key=lambda item: (item.get("_lexical_score", 0.0), item.get("_rerank_score", 0.0)),
        reverse=True,
    )
    for result in results:
        result.pop("_rerank_score", None)
        result.pop("_lexical_score", None)
        result.pop("_phrase_hit", None)
    if offset:
        results = results[offset:]
    if limit is not None:
        results = results[:limit]
    return results
