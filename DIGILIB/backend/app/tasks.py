from rq import Queue
import redis

from .config import settings
from .db import SessionLocal
from .ingest import ingest_audit_reports


redis_conn = redis.Redis.from_url(settings.redis_url)
queue = Queue("ingest", connection=redis_conn)


def enqueue_ingest() -> str:
    job = queue.enqueue(run_ingest)
    return job.get_id()


def run_ingest() -> dict:
    db = SessionLocal()
    try:
        stats = ingest_audit_reports(db)
        return {
            "total_pdfs": stats.total_pdfs,
            "documents": stats.documents,
            "chunks": stats.chunks,
            "skipped": stats.skipped,
            "failed": stats.failed,
            "elapsed_ms": stats.elapsed_ms,
            "errors": stats.errors,
        }
    finally:
        db.close()
