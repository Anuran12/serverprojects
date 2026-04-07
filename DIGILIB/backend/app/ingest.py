from __future__ import annotations

import hashlib
import logging
import os
import re
import time
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, List

import numpy as np
import pdfplumber
from sqlalchemy.orm import Session
from sentence_transformers import SentenceTransformer
import chromadb

from .config import settings
from .models import AuditChunk, AuditDocument

try:
    import fitz  # PyMuPDF

    FITZ_AVAILABLE = True
except Exception:
    FITZ_AVAILABLE = False

try:
    import pytesseract
    from PIL import Image

    PYTESSERACT_AVAILABLE = True
except Exception:
    PYTESSERACT_AVAILABLE = False

try:
    from paddleocr import PaddleOCR

    PADDLE_AVAILABLE = True
except Exception:
    PADDLE_AVAILABLE = False

try:
    from unstructured.partition.pdf import partition_pdf

    UNSTRUCTURED_AVAILABLE = True
except Exception:
    UNSTRUCTURED_AVAILABLE = False


_paddle_ocr = None
logger = logging.getLogger(__name__)


@dataclass
class IngestStats:
    total_pdfs: int
    documents: int
    chunks: int
    skipped: int
    failed: int
    elapsed_ms: int
    errors: List[dict]


_embedding_model = None
_embedding_model_path = None

class EmbeddingService:
    def __init__(self) -> None:
        global _embedding_model, _embedding_model_path
        if _embedding_model is None:
            model_candidates = [
                settings.embedding_model_path,
                settings.fallback_embedding_model_path,
            ]
            last_error = None
            for model_path in model_candidates:
                try:
                    print(f"Loading embedding model {model_path}...")
                    _embedding_model = SentenceTransformer(model_path)
                    _embedding_model_path = model_path
                    print(f"Embedding model loaded successfully from {model_path}")
                    break
                except Exception as exc:
                    last_error = exc
                    print(f"Failed to load embedding model {model_path}: {exc}")

            if _embedding_model is None:
                raise RuntimeError(
                    f"Unable to load any embedding model from configured paths: {model_candidates}"
                ) from last_error
        self.model = _embedding_model

    def embed(self, texts: List[str]) -> List[List[float]]:
        vectors = self.model.encode(texts, convert_to_numpy=True, normalize_embeddings=True)
        vectors = vectors.astype(np.float32)
        target_dim = settings.embedding_dimensions
        current_dim = int(vectors.shape[1]) if vectors.ndim == 2 and vectors.shape else 0
        if current_dim != target_dim and current_dim > 0:
            adjusted = np.zeros((vectors.shape[0], target_dim), dtype=np.float32)
            copy_dim = min(current_dim, target_dim)
            adjusted[:, :copy_dim] = vectors[:, :copy_dim]
            vectors = adjusted
        return vectors.tolist()


def get_active_embedding_model_path() -> str | None:
    return _embedding_model_path


class ChromaService:
    def __init__(self) -> None:
        self.client = chromadb.HttpClient(host=settings.chroma_host, port=settings.chroma_port)
        self.collection = self.client.get_or_create_collection("audit_chunks")

    def upsert(self, ids: List[str], embeddings: List[List[float]], documents: List[str], metadatas: List[dict]):
        self.collection.upsert(ids=ids, embeddings=embeddings, documents=documents, metadatas=metadatas)

    def delete(self, ids: List[str]):
        if ids:
            self.collection.delete(ids=ids)


def _extract_field(text: str, label: str) -> str | None:
    for line in text.splitlines():
        if label.lower() in line.lower():
            parts = line.split(":", 1)
            if len(parts) == 2:
                return parts[1].strip()
    return None


def extract_metadata(first_page_text: str) -> dict:
    return {
        "division": _extract_field(first_page_text, "Company/Division") or _extract_field(first_page_text, "Division"),
        "auditors": _extract_field(first_page_text, "Auditors"),
        "unit": _extract_field(first_page_text, "Unit"),
        "audit_manager": _extract_field(first_page_text, "Audit Manager"),
        "audit_year": _extract_field(first_page_text, "Audit Year"),
        "man_days": _extract_field(first_page_text, "No. of Man days"),
        "working_days": _extract_field(first_page_text, "No. of Working Days"),
        "working_days_range": _extract_field(first_page_text, "Working Days"),
        "audit_period": _extract_field(first_page_text, "Audit Period"),
        "finalization_dates": _extract_field(first_page_text, "Date of Finalization"),
    }


def chunk_text(text: str, chunk_size: int = 500, overlap: int = 100) -> Iterable[str]:
    if not text:
        return []

    cleaned = " ".join(text.split())
    if not cleaned:
        return []

    if chunk_size <= 0:
        raise ValueError("chunk_size must be > 0")
    if overlap < 0:
        overlap = 0
    if overlap >= chunk_size:
        overlap = max(0, chunk_size // 5)

    chunks: List[str] = []
    start = 0
    length = len(cleaned)
    while start < length:
        end = min(start + chunk_size, length)
        chunk = cleaned[start:end].strip()
        if chunk:
            chunks.append(chunk)
        if end >= length:
            break
        start = end - overlap
    return chunks


def _extract_pages_pymupdf(file_path: str) -> List[str]:
    if not FITZ_AVAILABLE:
        return []
    texts: List[str] = []
    with fitz.open(file_path) as doc:
        for page in doc:
            texts.append(page.get_text("text") or "")
    return texts


def _extract_tables_text(page) -> str:
    try:
        tables = page.extract_tables() or []
    except Exception:
        tables = []
    table_lines = []
    for table in tables:
        for row in table:
            if not row:
                continue
            row_text = " | ".join(cell.strip() for cell in row if cell)
            if row_text:
                table_lines.append(row_text)
    return "\n".join(table_lines)


def _extract_pages_pdfplumber(file_path: str) -> List[str]:
    texts: List[str] = []
    with pdfplumber.open(file_path) as pdf:
        for page in pdf.pages:
            text = page.extract_text() or ""
            table_text = _extract_tables_text(page)
            if table_text:
                text = (text + "\n" + table_text).strip()
            texts.append(text)
    return texts


def _extract_pages_unstructured(file_path: str) -> List[str]:
    if not UNSTRUCTURED_AVAILABLE:
        return []
    elements = partition_pdf(file_path)
    pages = {}
    for element in elements:
        page_number = getattr(element.metadata, "page_number", None)
        if not page_number:
            continue
        pages.setdefault(page_number, []).append(element.text or "")
    if not pages:
        return []
    max_page = max(pages.keys())
    return ["\n".join(pages.get(i, [])).strip() for i in range(1, max_page + 1)]


def _ocr_pages(file_path: str, page_indexes: List[int]) -> dict:
    if not FITZ_AVAILABLE:
        return {}
    if not (PYTESSERACT_AVAILABLE or PADDLE_AVAILABLE):
        return {}

    ocr_texts = {}
    with fitz.open(file_path) as doc:
        for page_index in page_indexes:
            if page_index < 0 or page_index >= len(doc):
                continue
            page = doc[page_index]
            pix = page.get_pixmap(dpi=200)
            mode = "RGB" if pix.alpha == 0 else "RGBA"
            image = Image.frombytes(mode, [pix.width, pix.height], pix.samples)
            if mode == "RGBA":
                image = image.convert("RGB")

            text = ""
            if PYTESSERACT_AVAILABLE:
                text = pytesseract.image_to_string(image) or ""
            elif PADDLE_AVAILABLE:
                global _paddle_ocr
                if _paddle_ocr is None:
                    _paddle_ocr = PaddleOCR(use_angle_cls=True, lang="en", show_log=False)
                result = _paddle_ocr.ocr(np.array(image), cls=True)
                lines = []
                for block in result or []:
                    for line in block:
                        lines.append(line[1][0])
                text = "\n".join(lines)

            ocr_texts[page_index] = text
    return ocr_texts


def _extract_pages(file_path: str) -> List[str]:
    texts: List[str] = []

    for extractor in (_extract_pages_pymupdf, _extract_pages_pdfplumber, _extract_pages_unstructured):
        try:
            candidate = extractor(file_path)
        except Exception as exc:
            logger.warning("extractor failed file=%s extractor=%s error=%s", file_path, extractor.__name__, exc)
            continue
        if candidate:
            texts = candidate
            if any(text.strip() for text in candidate):
                break

    if not texts:
        texts = []

    page_indexes = [idx for idx, text in enumerate(texts) if not text.strip()]
    if not texts and FITZ_AVAILABLE:
        try:
            with fitz.open(file_path) as doc:
                page_indexes = list(range(len(doc)))
                texts = [""] * len(doc)
        except Exception as exc:
            logger.warning("failed to inspect page count for OCR file=%s error=%s", file_path, exc)
            page_indexes = []

    if page_indexes:
        ocr_results = _ocr_pages(file_path, page_indexes)
        for page_index, text in ocr_results.items():
            if page_index < len(texts):
                texts[page_index] = text

    return texts


def _file_sha256(file_path: str) -> str:
    hasher = hashlib.sha256()
    with open(file_path, "rb") as f:
        for block in iter(lambda: f.read(8192), b""):
            hasher.update(block)
    return hasher.hexdigest()


def _path_metadata(file_path: str) -> dict:
    path = Path(file_path)
    audit_type = path.parent.name if path.parent else None
    year_bucket = next((p for p in path.parts if "-" in p and any(ch.isdigit() for ch in p)), None)
    return {
        "audit_type_from_path": audit_type,
        "year_bucket": year_bucket,
        "source_file_name": path.name,
        "source_file_path": str(path),
        "source_directory": str(path.parent),
    }


def _get_existing_doc(db: Session, file_path: str) -> AuditDocument | None:
    return db.query(AuditDocument).filter(AuditDocument.file_path == file_path).first()


def _to_document_metadata(content_meta: dict, file_path: str, file_hash: str) -> dict:
    merged = {}
    merged.update(_path_metadata(file_path))
    merged.update(content_meta or {})
    merged["file_hash"] = file_hash
    return merged


def _replace_existing_document(db: Session, chroma_service: ChromaService, existing: AuditDocument) -> None:
    existing_chunks = db.query(AuditChunk).filter(AuditChunk.doc_id == existing.id).all()
    chroma_ids = [row.chroma_id for row in existing_chunks if row.chroma_id]
    if chroma_ids:
        chroma_service.delete(chroma_ids)
    db.delete(existing)
    db.flush()


def _sanitize_chroma_metadata(metadata: dict) -> dict:
    # Chroma metadata cannot contain None values.
    return {key: value for key, value in metadata.items() if value is not None}


def ingest_audit_reports(db: Session, audit_root: str | None = None) -> IngestStats:
    audit_root = audit_root or settings.audit_root
    if not os.path.isdir(audit_root):
        raise RuntimeError(f"AUDIT_ROOT does not exist or is not a directory: {audit_root}")

    embedder = EmbeddingService()
    chroma_service = ChromaService()
    batch_size = settings.ingest_batch_size

    start_time = time.time()
    pdf_files = []
    for root, _, files in os.walk(audit_root):
        for file in files:
            if file.lower().endswith(".pdf"):
                pdf_files.append(os.path.join(root, file))
    pdf_files.sort()

    total_pdfs = len(pdf_files)
    documents = 0
    chunks = 0
    skipped = 0
    failed = 0
    errors: List[dict] = []

    for file_path in pdf_files:
        file = os.path.basename(file_path)
        try:
            with db.begin_nested():
                file_hash = _file_sha256(file_path)
                existing_doc = _get_existing_doc(db, file_path)
                if existing_doc:
                    existing_hash = (existing_doc.metadata_json or {}).get("file_hash")
                    if existing_hash == file_hash:
                        skipped += 1
                        continue
                    _replace_existing_document(db, chroma_service, existing_doc)

                page_texts = _extract_pages(file_path)
                if not page_texts or all(not p.strip() for p in page_texts):
                    skipped += 1
                    continue

                first_page_text = page_texts[0] if page_texts else ""
                content_metadata = extract_metadata(first_page_text)
                metadata = _to_document_metadata(content_metadata, file_path, file_hash)

                audit_doc = AuditDocument(
                    file_path=file_path,
                    file_name=file,
                    audit_type=os.path.basename(os.path.dirname(file_path)),
                    audit_year=content_metadata.get("audit_year"),
                    division=content_metadata.get("division"),
                    unit=content_metadata.get("unit"),
                    auditors=content_metadata.get("auditors"),
                    audit_manager=content_metadata.get("audit_manager"),
                    man_days=_to_int(content_metadata.get("man_days")),
                    working_days=_to_int(content_metadata.get("working_days")),
                    working_days_range=content_metadata.get("working_days_range"),
                    audit_period=content_metadata.get("audit_period"),
                    finalization_dates=content_metadata.get("finalization_dates"),
                    metadata_json=metadata,
                )
                db.add(audit_doc)
                db.flush()

                page_meta: List[dict] = []
                chroma_ids: List[str] = []
                chunk_texts: List[str] = []
                chunk_rows: List[AuditChunk] = []

                def flush_batch():
                    nonlocal chunks
                    if not chunk_rows:
                        return
                    db.add_all(chunk_rows)
                    db.flush()
                    embeddings = embedder.embed(chunk_texts)
                    for row, emb in zip(chunk_rows, embeddings):
                        row.embedding = emb
                    chroma_service.upsert(
                        ids=chroma_ids,
                        embeddings=embeddings,
                        documents=chunk_texts,
                        metadatas=page_meta,
                    )
                    chunks += len(chunk_rows)
                    chunk_rows.clear()
                    chunk_texts.clear()
                    page_meta.clear()
                    chroma_ids.clear()

                for page_idx, text in enumerate(page_texts, start=1):
                    page_chunks = chunk_text(text)
                    for chunk_index, chunk in enumerate(page_chunks):
                        chunk_id = str(uuid.uuid4())
                        chroma_ids.append(chunk_id)
                        chunk_texts.append(chunk)
                        page_meta.append(
                            _sanitize_chroma_metadata(
                                {
                                "doc_id": str(audit_doc.id),
                                "file_name": file,
                                "file_path": file_path,
                                "audit_year": audit_doc.audit_year,
                                "division": audit_doc.division,
                                "audit_type": audit_doc.audit_type,
                                "unit": audit_doc.unit,
                                "audit_manager": audit_doc.audit_manager,
                                "page_number": page_idx,
                                "chunk_index": chunk_index,
                                }
                            )
                        )
                        chunk_row = AuditChunk(
                            doc_id=audit_doc.id,
                            page_number=page_idx,
                            chunk_index=chunk_index,
                            text=chunk,
                            chroma_id=chunk_id,
                        )
                        chunk_rows.append(chunk_row)
                        if len(chunk_rows) >= batch_size:
                            flush_batch()

                flush_batch()
                documents += 1
        except Exception as exc:
            logger.exception("ingest failed file=%s", file_path)
            failed += 1
            errors.append({"file_path": file_path, "error": str(exc)})
            continue

    db.commit()

    elapsed_ms = int((time.time() - start_time) * 1000)
    return IngestStats(
        total_pdfs=total_pdfs,
        documents=documents,
        chunks=chunks,
        skipped=skipped,
        failed=failed,
        elapsed_ms=elapsed_ms,
        errors=errors[:50],
    )


def _to_int(value: str | None) -> int | None:
    if not value:
        return None
    match = re.search(r"\d{1,9}", value)
    if not match:
        return None
    number = int(match.group(0))
    # Protect against PostgreSQL INTEGER overflow.
    return min(number, 2_147_483_647)
